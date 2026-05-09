import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getSocket } from "./socket.js";
import Sidebar from "./homenavbar.jsx";
import { Device } from "mediasoup-client";
import "./conferenceroom.css";

function ConferenceRoom() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const socket = getSocket();

  const [type, setType] = useState(state?.type || "audio");
  const password = state?.password || "";

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [status, setStatus] = useState("Connecting...");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const deviceRef = useRef(null);
  const recvTransportRef = useRef(null);
  const sendTransportRef = useRef(null);
  const audioProducerRef = useRef(null);
  const videoProducerRef = useRef(null);
  const setupDoneRef = useRef(false);

  useEffect(() => {
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    setupRoom();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      socket.emit("leave-conference", { roomId });
      socket.off("new-producer");
      socket.off("producer-closed");
    };
  }, []);

  // ✅ FIX 3: added [] dep array — was running on every render
  useEffect(() => {
    if (localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
    }
  }, []);

  async function setupRoom() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Camera/mic not available. Please use HTTPS or allow insecure origin in Chrome flags.");
        return;
      }

      setStatus("Joining room...");
      const joinResult = await new Promise((res) => {
        socket.emit("join-conference", { roomId, password }, res);
      });

      if (joinResult?.error) {
        setStatus("Join failed: " + joinResult.error);
        return;
      }

      // ✅ FIX 1: use a local variable instead of relying on state update
      // setType() is async — using `type` after this would still be the old value
      const resolvedType = joinResult?.type || type;
      if (joinResult?.type) setType(joinResult.type);

      setStatus("Setting up media...");
      console.log("Step 1: creating device");
      const device = new Device();
      deviceRef.current = device;

      console.log("Step 2: getting RTP capabilities");
      const routerRtpCapabilities = await new Promise((res) => {
        socket.emit("getRouterRtpCapabilities", res);
      });

      console.log("Step 3: loading device");
      await device.load({ routerRtpCapabilities });

      console.log("Step 4: creating send transport");
      const sendParams = await new Promise((res) => {
        socket.emit("createTransport", {}, res);
      });

      console.log("Step 5: send transport created");
      const sendTransport = device.createSendTransport(sendParams);
      sendTransportRef.current = sendTransport;

      sendTransport.on("connect", ({ dtlsParameters }, callback) => {
        if (sendTransport._connectionState === "connected") return callback();
        socket.emit("connectTransport", { dtlsParameters }, callback);
      });

      // ✅ FIX 2: added errback as 3rd argument
      // Without errback, any produce error causes the promise to hang forever
      // which means setupRecvTransport never gets called → nobody sees video
      sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
        socket.emit("produce", { kind, rtpParameters }, ({ id, error }) => {
          if (error) return errback(new Error(error));
          callback({ id });
        });
      });

      console.log("Step 6: getting user media");
      // ✅ FIX 1 applied here — use resolvedType, NOT type
      const stream = await navigator.mediaDevices.getUserMedia({
        video: resolvedType === "video",
        audio: true,
      });

      console.log("Step 7: got stream");
      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioProducerRef.current = await sendTransport.produce({ track: audioTrack });
      }
      console.log("Step 8: audio producing");

      // ✅ FIX 1 applied here too — use resolvedType
      if (resolvedType === "video") {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoProducerRef.current = await sendTransport.produce({ track: videoTrack });
        }
      }
      console.log("Step 9: done producing");

      setStatus("Connected ✓");
      await setupRecvTransport(device);

    } catch (err) {
      console.error(err);
      setStatus("Failed: " + err.message);
    }
  }

  async function setupRecvTransport(device) {
    const params = await new Promise((res) => {
      socket.emit("createRecvTransport", {}, res);
    });
    const recvTransport = device.createRecvTransport(params);
    recvTransportRef.current = recvTransport;

    recvTransport.on("connect", ({ dtlsParameters }, callback) => {
      if (recvTransport._connectionState === "connected") return callback();
      socket.emit("connectRecvTransport", { dtlsParameters }, callback);
    });

    const existingProducers = await new Promise((res) => {
      socket.emit("getProducers", res);
    });

    console.log("existing producers:", existingProducers);

    for (const producerId of existingProducers) {
      await consumeProducer(producerId);
    }

    socket.off("new-producer");
    socket.off("producer-closed");

    socket.on("new-producer", async ({ producerId }) => {
      console.log("new-producer received:", producerId);
      await consumeProducer(producerId);
    });

    socket.on("producer-closed", ({ producerId }) => {
      setRemoteStreams((prev) => prev.filter((s) => s.producerId !== producerId));
    });
  }

  async function consumeProducer(producerId) {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) return;

    const consumerParams = await new Promise((res) => {
      socket.emit("consume", { producerId, rtpCapabilities: device.rtpCapabilities }, res);
    });

    console.log("consume params:", consumerParams);

    if (!consumerParams || consumerParams.error) return;

    const consumer = await recvTransport.consume(consumerParams);

    console.log("consumer kind:", consumer.kind, "track:", consumer.track);

    socket.emit("consumer-resume", { consumerId: consumer.id });

    const stream = new MediaStream([consumer.track]);
    setRemoteStreams((prev) => [
      ...prev.filter((s) => s.id !== consumer.id),
      { id: consumer.id, producerId, stream, kind: consumer.kind },
    ]);
  }

  function toggleMute() {
    const producer = audioProducerRef.current;
    if (!producer) return;
    if (muted) {
      producer.resume();
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    } else {
      producer.pause();
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    }
    setMuted((m) => !m);
  }

  function toggleCam() {
    const producer = videoProducerRef.current;
    if (!producer) return;
    if (camOff) {
      producer.resume();
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = true));
    } else {
      producer.pause();
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
    }
    setCamOff((c) => !c);
  }

  function leaveRoom() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    socket.emit("leave-conference", { roomId });
    navigate("/conference");
  }

  const remoteVideos = remoteStreams.filter((s) => s.kind === "video");
  const remoteAudios = remoteStreams.filter((s) => s.kind === "audio");

  return (
    <div id="layout">
      <Sidebar />

      <div id="conference-container">

        <div id="room-bar">
          <span id="room-id">Room: <strong>{roomId}</strong></span>
          <span id="room-status" className={status.startsWith("Failed") ? "status-error" : "status-ok"}>
            {status}
          </span>
        </div>

        <div id="video-grid">

          {type === "video" && (
            <div className="video-tile local-tile">
              {/* ✅ FIX 4: added playsInline — required for Safari/iOS autoplay */}
              <video ref={localVideoRef} autoPlay muted playsInline id="local-video" />
              <span className="video-label">You {camOff ? "📵" : "🟢"}</span>
            </div>
          )}

          {remoteVideos.map(({ id, stream }) => (
            <RemoteVideo key={id} id={id} stream={stream} />
          ))}

          {remoteAudios.map(({ id, stream }) => (
            <RemoteAudio key={id} id={id} stream={stream} />
          ))}

          {type === "audio" && (
            <div id="audio-room-indicator">
              <div id="audio-pulse" />
              <span>Audio Room Active</span>
              <p>{remoteAudios.length} participant(s) connected</p>
            </div>
          )}

        </div>

        <div id="controls">
          <button onClick={toggleMute} className={`ctrl-btn ${muted ? "active" : ""}`}>
            {muted ? "🔇 Unmute" : "🎙 Mute"}
          </button>

          {type === "video" && (
            <button onClick={toggleCam} className={`ctrl-btn ${camOff ? "active" : ""}`}>
              {camOff ? "📵 Show Cam" : "📷 Hide Cam"}
            </button>
          )}

          <button onClick={leaveRoom} id="leave-btn">
            🚪 Leave
          </button>
        </div>

      </div>
    </div>
  );
}

function RemoteVideo({ id, stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-tile">
      {/* ✅ FIX 4: added playsInline */}
      <video ref={ref} autoPlay playsInline id={`remote-video-${id}`} />
      <span className="video-label">Participant 🔵</span>
    </div>
  );
}

function RemoteAudio({ id, stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return <audio ref={ref} autoPlay id={`audio-${id}`} style={{ display: "none" }} />;
}

export default ConferenceRoom;