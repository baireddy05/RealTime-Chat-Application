import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.JWT_SECRET = "test-secret-key";
process.env.PORT = "5057";

// index.js has side effects on import (connects DB, listens); import for side effects:
await import("../index.js");

const BASE = "http://localhost:5057/api";
await new Promise((r) => setTimeout(r, 1500));

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const api = async (method, path, token, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

// signup two users
const u1 = await api("POST", "/auth/signup", null, { username: "ann1", email: "ann1@t.com", password: "password123" });
const u2 = await api("POST", "/auth/signup", null, { username: "ann2", email: "ann2@t.com", password: "password123" });
check("signup x2", u1.status === 201 && u2.status === 201, `${u1.status}/${u2.status}`);
const t1 = u1.data.token, t2 = u2.data.token;

// create room with u2 as member
const room = await api("POST", "/chat/rooms", t1, { name: "FeatRoom", description: "d", memberIds: [u2.data._id] });
check("create room", room.status === 201, room.status);
const roomId = room.data._id;

// 1. announcement by non-admin -> 403
const annFail = await api("POST", "/chat/send", t2, { text: "hello", roomId, isAnnouncement: true });
check("non-admin announcement blocked", annFail.status === 403, annFail.status);

// 2. announcement by admin (creator) -> 201 + flag
const ann = await api("POST", "/chat/send", t1, { text: "big news", roomId, isAnnouncement: true });
check("admin announcement ok", ann.status === 201 && ann.data.isAnnouncement === true, `${ann.status} ${JSON.stringify(ann.data)?.slice(0,80)}`);

// 3. list announcements
const anns = await api("GET", `/chat/rooms/${roomId}/announcements`, t2);
check("list announcements", anns.status === 200 && anns.data.length === 1, `${anns.status} len=${anns.data?.length}`);

// 4. events CRUD + RSVP
const ev = await api("POST", "/chat/events", t2, { roomId, title: "Sprint planning", startsAt: new Date(Date.now() + 86400000).toISOString(), location: "Room A" });
check("create event", ev.status === 201, ev.status);
const evList = await api("GET", `/chat/rooms/${roomId}/events`, t1);
check("list events", evList.status === 200 && evList.data.length === 1, `${evList.status}`);
const rsvp = await api("POST", `/chat/events/${ev.data._id}/rsvp`, t1, { status: "maybe" });
check("rsvp", rsvp.status === 200 && rsvp.data.rsvps.some((r) => r.status === "maybe"), rsvp.status);
const rsvpBad = await api("POST", `/chat/events/${ev.data._id}/rsvp`, t1, { status: "nope" });
check("rsvp invalid rejected", rsvpBad.status === 400, rsvpBad.status);
const evDel = await api("DELETE", `/chat/events/${ev.data._id}`, t2);
check("organizer cancels event", evDel.status === 200, evDel.status);

// 5. tasks
const task = await api("POST", "/chat/tasks", t1, { title: "Write docs", roomId, assignees: [u2.data._id], priority: "high" });
check("create task", task.status === 201, task.status);
const taskBad = await api("POST", "/chat/tasks", t1, { title: "x", roomId, assignees: ["000000000000000000000000"] });
check("non-member assignee rejected", taskBad.status === 400, taskBad.status);
const tasks = await api("GET", `/chat/tasks?roomId=${roomId}`, t2);
check("list room tasks", tasks.status === 200 && tasks.data.length === 1, `${tasks.status}`);
const mine = await api("GET", `/chat/tasks?scope=mine`, t2);
check("assignee sees task in mine", mine.status === 200 && mine.data.length === 1, `${mine.status} len=${mine.data?.length}`);
const tog = await api("POST", `/chat/tasks/${task.data._id}/toggle`, t2);
check("toggle task done", tog.status === 200 && tog.data.isDone === true, tog.status);
const del = await api("DELETE", `/chat/tasks/${task.data._id}`, t1);
check("delete task", del.status === 200, del.status);

// 6. labels
const lab = await api("POST", "/chat/labels", t1, { name: "Work" });
check("create label", lab.status === 201, lab.status);
const labDup = await api("POST", "/chat/labels", t1, { name: "work" });
check("duplicate label rejected", labDup.status === 400, labDup.status);
const setL = await api("PUT", `/chat/labels/chat/${roomId}`, t1, { labelIds: [lab.data._id] });
check("assign label to chat", setL.status === 200, setL.status);
const setLBad = await api("PUT", `/chat/labels/chat/${roomId}`, t1, { labelIds: ["000000000000000000000000"] });
check("unknown label rejected", setLBad.status === 400, setLBad.status);
const labs = await api("GET", "/chat/labels", t1);
check("get labels", labs.status === 200 && labs.data.labels.length === 1 && (labs.data.chatLabels[roomId] || []).length === 1, labs.status);

// 7. search
await api("POST", "/chat/send", t1, { text: "the quarterly roadmap discussion", roomId });
const s1 = await api("GET", `/chat/search?query=roadmap`, t2);
check("global search finds message", s1.status === 200 && s1.data.length >= 1, `${s1.status} len=${s1.data?.length}`);
const s2 = await api("GET", `/chat/search`, t2);
check("empty search rejected", s2.status === 400, s2.status);

console.log(`\nDONE pass=${pass} fail=${fail}`);
await mongod.stop();
process.exit(fail ? 1 : 0);
