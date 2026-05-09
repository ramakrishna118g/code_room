import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_BACKEND_URL, {
      auth: { token: localStorage.getItem("code-roomtoken") }
    });
  }
  return socket;
}