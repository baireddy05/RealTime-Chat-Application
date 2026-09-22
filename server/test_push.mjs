// Push pipeline test: validation, subscribe/unsubscribe roundtrip,
// offline-DM push attempt (graceful failure), 410 dead-sub pruning via a
// mock push server, and device-token endpoints.
//
// NOTE: web-push always speaks HTTPS (real push services are HTTPS-only),
// so the mock push service below is a local HTTPS server with a throwaway
// self-signed cert; verification is disabled for the test process only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import https from "https";
import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";
import selfsigned from "selfsigned";

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
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.json;
};

// Mock push service: always answers 410 Gone (expired subscription)
const pems = await selfsigned.generate([{ name: "commonName", value: "127.0.0.1" }], { days: 1 });
const mockPush = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(410, { "Content-Type": "text/plain" });
    res.end("gone");
  });
});
await new Promise((r) => mockPush.listen(0, "127.0.0.1", r));
const mockPort = mockPush.address().port;

// Real P-256 receiver keys so web-push encryption succeeds client-side
const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
const p256dh = ecdh.getPublicKey(null, "uncompressed").toString("base64url");
const auth = crypto.randomBytes(16).toString("base64url");

const user1 = await login("user1@example.com");
const user2 = await login("user2@example.com");

await mongoose.connect(process.env.MONGODB_URI);
const subCount = async () =>
  mongoose.connection.db.collection("pushsubscriptions").countDocuments({ userId: new mongoose.Types.ObjectId(user1._id) });

// 1. validation
let r = await api("POST", "/api/push/subscribe", user1.token, { subscription: { endpoint: "nope" } });
check("reject malformed subscription", r.status === 400, `status=${r.status}`);
r = await api("POST", "/api/push/subscribe", null, { subscription: { endpoint: "https://x.test/", keys: { p256dh, auth } } });
check("reject unauthenticated subscribe", r.status === 401, `status=${r.status}`);

// 2. subscribe with 410-mock endpoint (https, like all real push services)
const mockSub = {
  endpoint: `https://127.0.0.1:${mockPort}/push/abc123`,
  keys: { p256dh, auth },
};
r = await api("POST", "/api/push/subscribe", user1.token, { subscription: mockSub, userAgent: "push-test/1.0" });
check("subscribe dead-endpoint sub", r.status === 201, `status=${r.status}`);
// idempotent re-subscribe
r = await api("POST", "/api/push/subscribe", user1.token, { subscription: mockSub });
check("re-subscribe idempotent", r.status === 201, `status=${r.status}`);

// 3. DM to offline user1 triggers push attempt + prunes the 410 sub.
// user1 has no socket here (only REST), so notifyNewMessage fires.
check("sub stored before DM", (await subCount()) === 1, `count=${await subCount()}`);
r = await api("POST", `/api/chat/send/${user1._id}`, user2.token, { text: "push test hello" });
check("DM send succeeds despite dead push sub", r.status === 201, `status=${r.status}`);
// Push fan-out is fire-and-forget after the 201, so poll for the prune
let prunedCount = 1;
for (let i = 0; i < 20 && prunedCount !== 0; i++) {
  await new Promise((r2) => setTimeout(r2, 500));
  prunedCount = await subCount();
}
check("410 sub pruned after failed push", prunedCount === 0, `count=${prunedCount}`);

// 4. device token roundtrip
r = await api("POST", "/api/push/device-token", user1.token, { platform: "android", token: "fcm-test-token-1234567890" });
check("register device token", r.status === 201, `status=${r.status}`);
r = await api("POST", "/api/push/device-token", user1.token, { platform: "android", token: "x" });
check("reject short device token", r.status === 400, `status=${r.status}`);
r = await api("DELETE", "/api/push/device-token", user1.token, { token: "fcm-test-token-1234567890" });
check("unregister device token", r.status === 200, `status=${r.status}`);

// 5. unsubscribe (sub already pruned by the 410 path — assert idempotent success)
r = await api("POST", "/api/push/unsubscribe", user1.token, { endpoint: mockSub.endpoint });
check("unsubscribe ok", r.status === 200, `status=${r.status}`);

mockPush.close();
await mongoose.disconnect();
console.log(failures === 0 ? "ALL PUSH TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
