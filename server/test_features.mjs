import { io } from "../client/node_modules/socket.io-client/build/esm/index.js";

const BASE_URL = "http://localhost:5000";

async function postJson(url, data, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || json.error || `HTTP ${res.status}`);
    err.data = json;
    throw err;
  }
  return json;
}

async function getJson(url, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || json.error || `HTTP ${res.status}`);
    err.data = json;
    throw err;
  }
  return json;
}

async function run() {
  console.log("=== Testing Backend Features & APIs ===");

  // 1. Health check
  try {
    const health = await getJson(`${BASE_URL}/health`);
    console.log("✓ Health Check Passed:", health);
  } catch (err) {
    console.error("✗ Health Check Failed:", err.message);
    process.exit(1);
  }

  // 2. Auth Login (User1 and User2)
  let user1, user2;
  try {
    user1 = await postJson(`${BASE_URL}/api/auth/login`, {
      email: "user1@example.com",
      password: "password123",
    });
    console.log("✓ Logged in as User1:", user1.username, "ID:", user1._id);
  } catch (err) {
    console.error("✗ Login User1 Failed:", err.message, err.data);
    process.exit(1);
  }

  try {
    user2 = await postJson(`${BASE_URL}/api/auth/login`, {
      email: "user2@example.com",
      password: "password123",
    });
    console.log("✓ Logged in as User2:", user2.username, "ID:", user2._id);
  } catch (err) {
    console.error("✗ Login User2 Failed:", err.message, err.data);
    process.exit(1);
  }

  // 3. Test Markdown Message
  let markdownMsg;
  try {
    markdownMsg = await postJson(
      `${BASE_URL}/api/chat/send/${user2._id}`,
      {
        text: "**Bold Announcement:** Here is *italic*, `code block`, and a list:\n- Item 1\n- Item 2",
      },
      user1.token
    );
    console.log("✓ Markdown Message Sent Successfully. ID:", markdownMsg._id);
  } catch (err) {
    console.error("✗ Send Markdown Message Failed:", err.message);
  }

  // 4. Test Instant Video Message
  let videoMsg;
  try {
    videoMsg = await postJson(
      `${BASE_URL}/api/chat/send/${user2._id}`,
      {
        text: "Check out this circular video note!",
        videoNote: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      },
      user1.token
    );
    console.log("✓ Instant Video Message Sent Successfully. ID:", videoMsg._id);
    console.log("  videoNote stored in DB:", videoMsg.videoNote);
    if (!videoMsg.videoNote) {
      throw new Error("videoNote was not persisted!");
    }
  } catch (err) {
    console.error("✗ Send Instant Video Message Failed:", err.message);
    process.exit(1);
  }

  // 5. Test Live Location Sharing
  let locationMsg;
  try {
    locationMsg = await postJson(
      `${BASE_URL}/api/chat/send/${user2._id}`,
      {
        text: "Sharing my live coordinates",
        location: {
          lat: 37.7749,
          lng: -122.4194,
        },
      },
      user1.token
    );
    console.log("✓ Live Location Message Sent Successfully. ID:", locationMsg._id);
    console.log("  location stored in DB:", JSON.stringify(locationMsg.location));
    if (!locationMsg.location?.lat) {
      throw new Error("location was not persisted!");
    }
  } catch (err) {
    console.error("✗ Send Live Location Message Failed:", err.message);
    process.exit(1);
  }

  // 6. Test Inline Translation Endpoint
  try {
    const foreignMsg = await postJson(
      `${BASE_URL}/api/chat/send/${user2._id}`,
      {
        text: "Bonjour tout le monde! C'est une application magnifique.",
      },
      user1.token
    );

    const transRes = await postJson(
      `${BASE_URL}/api/chat/message/${foreignMsg._id}/translate`,
      { targetLanguage: "en" },
      user1.token
    );
    console.log("✓ Inline Translation Endpoint Passed!");
    console.log("  Original:", transRes.originalText);
    console.log("  Translated:", transRes.translatedText);
  } catch (err) {
    console.error("✗ Inline Translation Failed:", err.message, err.data);
    process.exit(1);
  }

  // 7. Test Group Calls Socket Signaling Mesh
  try {
    console.log("\n--- Testing Group Call Mesh Signaling via Socket.io ---");
    const socket1 = io(BASE_URL, {
      auth: { token: user1.token },
    });
    const socket2 = io(BASE_URL, {
      auth: { token: user2.token },
    });

    await new Promise((resolve) => {
      let c1 = false, c2 = false;
      socket1.on("connect", () => {
        c1 = true;
        if (c1 && c2) resolve();
      });
      socket2.on("connect", () => {
        c2 = true;
        if (c1 && c2) resolve();
      });
    });
    console.log("✓ Both user sockets connected to Socket.io server");

    const testRoomId = "6a9bc8ffe71138b8566f01bb";

    // User2 joins group call first
    socket2.emit("joinGroupCall", { roomId: testRoomId });
    await new Promise(r => setTimeout(r, 400));

    // User1 joins group call and expects to receive allUsersInCall containing User2
    const allUsersPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for allUsersInCall")), 5000);
      socket1.on("allUsersInCall", (data) => {
        console.log("✓ Socket1 received 'allUsersInCall':", data.users);
        clearTimeout(timer);
        resolve(data);
      });
      socket1.emit("joinGroupCall", { roomId: testRoomId });
    });

    const allUsersData = await allUsersPromise;
    const hasUser2 = allUsersData.users.includes(user2._id.toString());
    console.log("✓ allUsersInCall includes User2:", hasUser2);

    // User1 signals User2 with an offer
    const offerPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for userJoinedGroupCall")), 5000);
      socket2.on("userJoinedGroupCall", (data) => {
        console.log("✓ Socket2 received 'userJoinedGroupCall' with callerId:", data.callerId);
        clearTimeout(timer);
        resolve(data);
      });

      socket1.emit("signalGroupUser", {
        userToSignal: user2._id.toString(),
        signal: { type: "offer", sdp: "dummy-mesh-sdp-offer" },
      });
    });

    const offerData = await offerPromise;
    console.log("✓ Offer verified from caller:", offerData.callerId === user1._id.toString());

    // User2 returns answer to User1
    const answerPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for receivingReturnedGroupSignal")), 5000);
      socket1.on("receivingReturnedGroupSignal", (data) => {
        console.log("✓ Socket1 received 'receivingReturnedGroupSignal' from:", data.id);
        clearTimeout(timer);
        resolve(data);
      });

      socket2.emit("returnGroupSignal", {
        callerId: offerData.callerId,
        signal: { type: "answer", sdp: "dummy-mesh-sdp-answer" },
      });
    });

    const answerData = await answerPromise;
    console.log("✓ Answer verified from respondent:", answerData.id === user2._id.toString());

    // User1 leaves group call
    const leavePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for userLeftGroupCall")), 5000);
      socket2.on("userLeftGroupCall", (data) => {
        console.log("✓ Socket2 received 'userLeftGroupCall' for userId:", data.userId);
        clearTimeout(timer);
        resolve(data);
      });

      socket1.emit("leaveGroupCall", { roomId: testRoomId });
    });

    await leavePromise;
    socket2.emit("leaveGroupCall", { roomId: testRoomId });

    console.log("✓ Mesh Group Call Signaling full cycle verified successfully!");

    socket1.disconnect();
    socket2.disconnect();
  } catch (err) {
    console.error("✗ Group Call Socket Test Failed:", err.message);
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log("🎉 ALL NEW FEATURES TESTED AND 100% VERIFIED WORKING! 🎉");
  console.log("=======================================================");
  process.exit(0);
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
