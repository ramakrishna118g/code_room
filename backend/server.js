import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Roomdata from "./models/roomdata.js";
import * as dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";
import { LeveldbPersistence } from "y-leveldb";
import cors from "cors";
import User from "./models/users.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import confData from "./models/conferencedata.js";
import mediasoup from "mediasoup";

dotenv.config();
const app = express();

app.use(cors({ origin: [process.env.FRONTEND_URL,'https://code-room-nqcmi5rke-ramakrishna118gs-projects.vercel.app/'], credentials: true }));
app.use(express.json());

app.get("/", (req, res) => res.send("API working 🚀"));

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user)
    return res.status(404).json({ success: false, message: "User Not Found" });
  const ismatch = await bcrypt.compare(password, user.password);
  if (!ismatch)
    return res.status(401).json({ success: false, message: "Invalid Credentials" });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7h" });
  res.status(200).json({ success: true, token });
});

const otpStore = new Map();

app.post("/signup", async (req, res) => {
  const { username, password, originalname, email } = req.body;
  const isused = await User.findOne({ username });
  if (isused)
    return res.status(400).json({ success: false, message: "Username already taken" });
  const otp = generateOTP();
  otpStore.set(email, {
    otp,
    expires: Date.now() + 5 * 60 * 1000,
    userData: { username, password, originalname, email },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "OTP Verification",
    text: `Your OTP is ${otp}`,
  });
  console.log("--- OTP SENT ---");
  res.json({ success: true, message: "OTP sent to email" });
});

app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const storedData = otpStore.get(email);
  if (!storedData)
    return res.status(400).json({ success: false, message: "OTP expired" });
  if (Date.now() > storedData.expires) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: "OTP expired" });
  }
  if (storedData.otp !== otp)
    return res.status(400).json({ success: false, message: "Invalid OTP" });

  const newuser = new User(storedData.userData);
  await newuser.save();
  otpStore.delete(email);
  res.status(200).json({ success: true, message: "Account created successfully" });
});

// ── HTTP + Socket.IO ──────────────────────────────────────────────────────────

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const wss = new WebSocketServer({ noServer: true });
const persistence = new LeveldbPersistence("./yjs-data");

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/yjs")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});

wss.on("connection", (conn, req) => {
  conn.on("error", (err) => {
    console.error("Yjs WS error:", err.message);
  });
  setupWSConnection(conn, req, { persistence });
});

// ── MongoDB ───────────────────────────────────────────────────────────────────

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// ── Mediasoup setup ───────────────────────────────────────────────────────────

let worker;
let router;

(async () => {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      { kind: "video", mimeType: "video/VP8",  clockRate: 90000 },
    ],
  });
  console.log("Mediasoup router ready");
})();

// keyed as `${socket.id}-send` or `${socket.id}-recv`
const transports = new Map();

// keyed by producerId → { producer, socketId, roomId }
const producers = new Map();

// track consumers so we can resume them after client attaches the track
const consumers = new Map();

// track which conference room each socket is currently in
const socketRooms = new Map();

// ── Helper: announced IP (same for both send and recv transports) ─────────────
const ANNOUNCED_IP = process.env.PUBLIC_IP || "192.168.1.39";

// ── Helper: all producer IDs in a room, excluding one socket ─────────────────
function getProducersInRoom(roomId, excludeSocketId) {
  const result = [];
  for (const [producerId, data] of producers.entries()) {
    if (data.roomId === roomId && data.socketId !== excludeSocketId) {
      result.push(producerId);
    }
  }
  return result;
}

// ── Helper: full cleanup for a socket on disconnect or leave ─────────────────
function cleanupSocket(socket, roomId) {
  const sendT = transports.get(`${socket.id}-send`);
  const recvT = transports.get(`${socket.id}-recv`);
  if (sendT) sendT.close();
  if (recvT) recvT.close();
  transports.delete(`${socket.id}-send`);
  transports.delete(`${socket.id}-recv`);

  for (const [producerId, data] of producers.entries()) {
    if (data.socketId === socket.id) {
      data.producer.close();
      producers.delete(producerId);
      if (roomId) io.to(roomId).emit("producer-closed", { producerId });
    }
  }

  socketRooms.delete(socket.id);
}

// ── Socket.IO auth middleware ─────────────────────────────────────────────────

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token provided"));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// ── Socket.IO events ──────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  // ── CodeRoom ──────────────────────────────────────────────────

  socket.on("create-room", async (data) => {
    const roomId = uuidv4();
    socket.join(roomId);
    const newroom = new Roomdata({
      roomid: roomId,
      password: data.password,
      hostid: socket.id,
      roomtype: data.type,
    });
    await newroom.save();
    socket.emit("room-created", roomId);
  });

  socket.on("join-room", async (data) => {
    const dbroom = await Roomdata.findOne({ roomid: data.roomId, password: data.pass });
    if (!dbroom) return socket.emit("error", "Invalid Room ID or password");
    socket.join(data.roomId);
    socket.to(data.roomId).emit("user-joined", socket.id);
    socket.emit("joined-success", data.roomId);
  });

  socket.on("message", ({ roomId, data }) => {
    socket.to(roomId).emit("message", { from: socket.id, data });
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user-left", socket.id);
  });

  // ── Conference: Create ────────────────────────────────────────

  socket.on("create-conference", async ({ type, password }, callback) => {
  const roomId = uuidv4();
  socket.join(roomId);
  socketRooms.set(socket.id, roomId);
  const nconf = new confData({ conftype: type, confid: roomId, hostid: socket.user.userId, password });
  await nconf.save();
  console.log("conf created:", roomId);
  callback({ roomId }); // ✅ ack instead of socket.emit
});

  // ── Conference: Join ──────────────────────────────────────────

  socket.on("join-conference", async ({ roomId, password }, callback) => {
  const conf = await confData.findOne({ confid: roomId, password });
  if (!conf) return callback({ error: "Wrong Room ID or password" });

  // ✅ Clean up any stale transports from previous failed attempts
  const oldSend = transports.get(`${socket.id}-send`);
  const oldRecv = transports.get(`${socket.id}-recv`);
  if (oldSend) { oldSend.close(); transports.delete(`${socket.id}-send`); }
  if (oldRecv) { oldRecv.close(); transports.delete(`${socket.id}-recv`); }

  socket.join(roomId);
  socketRooms.set(socket.id, roomId);
  callback({ type: conf.conftype });
});
  // ── Mediasoup: Router capabilities ───────────────────────────

  socket.on("getRouterRtpCapabilities", (callback) => {
    callback(router.rtpCapabilities);
  });

  // ── Mediasoup: Send transport ─────────────────────────────────

  socket.on("createTransport", async (_, callback) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: ANNOUNCED_IP }], // ✅ uses shared constant
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transports.set(`${socket.id}-send`, transport);

    callback({
      id:             transport.id,
      iceParameters:  transport.iceParameters,
      iceCandidates:  transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on("connectTransport", async ({ dtlsParameters }, callback) => {
    try {
      const transport = transports.get(`${socket.id}-send`);
      await transport.connect({ dtlsParameters });
    } catch (err) {
      if (!err.message.includes("already called")) throw err;
    }
    callback();
  });

  // ── Mediasoup: Recv transport ─────────────────────────────────

  socket.on("createRecvTransport", async (_, callback) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: ANNOUNCED_IP }], // ✅ fixed: was "127.0.0.1"
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transports.set(`${socket.id}-recv`, transport);

    callback({
      id:             transport.id,
      iceParameters:  transport.iceParameters,
      iceCandidates:  transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on("connectRecvTransport", async ({ dtlsParameters }, callback) => {
    try {
      const transport = transports.get(`${socket.id}-recv`);
      await transport.connect({ dtlsParameters });
    } catch (err) {
      if (!err.message.includes("already called")) throw err;
    }
    callback();
  });

  // ── Mediasoup: Produce ────────────────────────────────────────

  socket.on("produce", async ({ kind, rtpParameters }, callback) => {
  try {
    const transport = transports.get(`${socket.id}-send`);
    const roomId = socketRooms.get(socket.id);

    // ✅ ADD THIS — without it, new-producer is emitted to undefined room
    if (!roomId) {
      console.warn("produce called but socket has no roomId:", socket.id);
      return callback({ error: "not in a room" });
    }

    const producer = await transport.produce({ kind, rtpParameters });
    producers.set(producer.id, { producer, socketId: socket.id, roomId });
    callback({ id: producer.id });
    socket.to(roomId).emit("new-producer", { producerId: producer.id });

  } catch (err) {
    if (err.message.includes("MID already exists")) {
      console.warn("Duplicate produce ignored for socket:", socket.id);
      return callback({ error: "duplicate" });
    }
    throw err;
  }
});

  // ── Mediasoup: Get existing producers ────────────────────────

  socket.on("getProducers", (callback) => {
    const roomId = socketRooms.get(socket.id);
    const ids = getProducersInRoom(roomId, socket.id);
    callback(ids);
  });

  // ── Mediasoup: Consume ────────────────────────────────────────

  socket.on("consume", async ({ producerId, rtpCapabilities }, callback) => {
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      return callback({ error: "Cannot consume" });
    }

    const transport = transports.get(`${socket.id}-recv`);
    if (!transport) return callback({ error: "No recv transport" });

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    consumers.set(consumer.id, consumer);

    callback({
      id:            consumer.id,
      producerId,
      kind:          consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  socket.on("consumer-resume", async ({ consumerId }) => {
    const consumer = consumers.get(consumerId);
    if (consumer) await consumer.resume();
  });

  // ── Conference: Leave ─────────────────────────────────────────

  socket.on("leave-conference", ({ roomId }) => {
    cleanupSocket(socket, roomId);
    socket.leave(roomId);
  });

  // ── Disconnect ────────────────────────────────────────────────

  socket.on("disconnect", () => {
    const roomId = socketRooms.get(socket.id);
    cleanupSocket(socket, roomId);
    console.log("User disconnected:", socket.id);
  });
});

// ── Start server ──────────────────────────────────────────────────────────────

server.listen(1234, '0.0.0.0', () => {
  console.log("Server running on port 1234");
  console.log("Express API  → http://localhost:1234");
  console.log("Socket.io    → http://localhost:1234");
  console.log("Yjs WS       → ws://localhost:1234/yjs");
});
