import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "./socket.js";
import Sidebar from "./homenavbar.jsx";
import "./conference.css";

function Conference() {
  const navigate = useNavigate();
  const sk = getSocket();

  const [tab, setTab] = useState("create");
  const [type, setType] = useState("audio");
  const [password, setPassword] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [status, setStatus] = useState("");

  // ── Create room ──────────────────────────────────────────────
 function handleCreate() {
    if (!password) { setStatus("Enter a password"); return; }
    setStatus("Creating...");

    sk.emit("create-conference", { type, password }, ({ roomId, error }) => {
      if (error) { setStatus(error || "Failed to create room"); return; }
      navigate(`/conference/${roomId}`, {
        state: { type, password },  // ← remove isHost entirely, not needed anymore
      });
    });
  }

  function handleJoin() {
    if (!joinRoomId) { setStatus("Enter a Room ID"); return; }
    if (!joinPassword) { setStatus("Enter the password"); return; }

    navigate(`/conference/${joinRoomId}`, {
      state: { type: "audio", password: joinPassword }, // type gets corrected by server
    });
  }
  
  return (
    <div id="layout">
      <Sidebar />

      <div id="conference-container">
        <div id="conference-box">

          {/* Tab toggle */}
          <div id="tab-row">
            <button
              className={tab === "create" ? "tab active" : "tab"}
              onClick={() => { setTab("create"); setStatus(""); }}
            >
              Create Room
            </button>
            <button
              className={tab === "join" ? "tab active" : "tab"}
              onClick={() => { setTab("join"); setStatus(""); }}
            >
              Join Room
            </button>
          </div>

          {/* ── Create form ── */}
          {tab === "create" && (
            <>
            <b >Create New Room</b>
              <p>Select type</p>
              <select onChange={(e) => setType(e.target.value)} value={type}>
                <option value="audio">Audio ☎</option>
                <option value="video">Video 📱</option>
              </select>

              <p>Room Password</p>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button onClick={handleCreate}>Create</button>
            </>
          )}

          {/* ── Join form ── */}
          {tab === "join" && (
            <>
              <b>Join Room</b>
              <p>Room ID</p>
              <input
                type="text"
                placeholder="e.g. abc-123"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
              />

              <p>Room Password</p>
              <input
                type="password"
                placeholder="••••••"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
              />

              <button onClick={handleJoin}>Join</button>
            </>
          )}

          {status && <p id="status-msg">{status}</p>}

        </div>
      </div>
    </div>
  );
}

export default Conference;