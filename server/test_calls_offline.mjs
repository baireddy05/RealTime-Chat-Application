// Offline-call test: caller rings an offline callee -> no instant
// "offline" message (WhatsApp-style ringing), CallLog created as missed,
// and the callee gets a live incomingCall when they connect within 45s.
import mongoose from "mongoose";
import dotenv from "dotenv";
import { io } from "socket.io-client";

dotenv.config();

const BASE = "http://localhost:5000";
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  [${extra}]` : ""}`);
  if (!cond) failures += 1;
};

const api = async (method, path, token, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

const login = async (email) => {
  const r = await api("POST", "/api/auth/login", null, { email, password: "password123" });
  if (r.status !== 200) throw new Error(`login failed for ${email}`);
  return r.json;
};

const caller = await login("user1@example.com");
const callee = await login("user2@example.com");

await mongoose.connect(process.env.MONGODB_URI);
const logCount = async () =>
  mongoose.connection.db.collection("calllogs").countDocuments({
    callerId: new mongoose.Types.ObjectId(caller._id),
    receiverId: new mongoose.Types.ObjectId(callee._id),
  });

// Callee stays fully offline. Caller connects and dials.
const sock = io(BASE.replace("http", "ws"), { auth: { token: caller.token } });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("socket connect timeout")), 10000);
  sock.on("connect", () => { clearTimeout(t); res(); });
});
let unavailableMsg = null;
sock.on("callUnavailable", (d) => { unavailableMsg = d; });
sock.emit("callUser", {
  userToCall: callee._id,
  callType: "audio",
  signalData: { type: "offer", sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" },
  callerInfo: { username: caller.username },
});
await new Promise((r) => setTimeout(r, 2500));

check("no instant offline message to caller", unavailableMsg === null, JSON.stringify(unavailableMsg));
check("missed-pending call logged", (await logCount()) >= 1, `count=${await logCount()}`);

// Callee comes online within the window -> should be rung live
const calleeSock = io(BASE.replace("http", "ws"), { auth: { token: callee.token } });
const rung = await new Promise((resolve) => {
  const t = setTimeout(() => resolve(null), 8000);
  calleeSock.on("incomingCall", (data) => { clearTimeout(t); resolve(data); });
});
check("callee re-rung live on connect", !!rung && rung.from === caller._id, rung ? `from ok` : "no incomingCall");

// Cleanup: callee rejects, log settles to rejected
if (rung) {
  calleeSock.emit("rejectCall", { to: caller._id });
  await new Promise((r) => setTimeout(r, 1500));
  const log = await mongoose.connection.db.collection("calllogs")
    .find({ callerId: new mongoose.Types.ObjectId(caller._id) })
    .sort({ _id: -1 }).limit(1).toArray();
  check("rejected call settled", log[0]?.status === "rejected", `status=${log[0]?.status}`);
}

sock.disconnect();
calleeSock.disconnect();
await mongoose.disconnect();
console.log(failures === 0 ? "ALL CALL TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
