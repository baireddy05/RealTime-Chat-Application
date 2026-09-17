const io = require("socket.io-client");
const axios = require("axios");
const crypto = require("crypto");

async function runTest() {
  try {
    // 1. Log in with an account
    const loginRes = await axios.post("http://localhost:5000/api/auth/login", {
      username: "byreddy", // Assuming this user exists
      password: "password123" // Or whatever password
    });
    
    const token = loginRes.data.token;
    console.log("Logged in:", loginRes.data.username);

    // 2. Connect Mobile socket
    const mobileSocket = io("http://localhost:5000", {
      auth: { token }
    });

    mobileSocket.on("connect", () => {
      console.log("Mobile connected:", mobileSocket.id);
    });

    mobileSocket.on("newMessage", (msg) => {
      console.log("Mobile received newMessage:", msg.text);
      process.exit(0);
    });

    // 3. Connect Laptop socket
    const laptopSocket = io("http://localhost:5000", {
      auth: { token }
    });

    laptopSocket.on("connect", () => {
      console.log("Laptop connected:", laptopSocket.id);
    });

    laptopSocket.on("newMessage", (msg) => {
      console.log("Laptop received newMessage:", msg.text);
    });

    // Wait for connections
    await new Promise(r => setTimeout(r, 1000));

    // 4. Laptop sends a message via API
    // Get another user to send to
    const usersRes = await axios.get("http://localhost:5000/api/chat/users", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const targetUserId = usersRes.data[0]?._id;

    if (!targetUserId) {
      console.log("No other user to send to");
      process.exit(1);
    }

    console.log("Laptop sending message to:", targetUserId);
    await axios.post(`http://localhost:5000/api/chat/send/${targetUserId}`, {
      text: "Hello from Laptop"
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("Message sent by API. Waiting for sockets...");

    setTimeout(() => {
      console.log("Timeout. Mobile did not receive message.");
      process.exit(1);
    }, 5000);

  } catch (err) {
    console.error("Test failed:", err.response?.data || err.message);
    process.exit(1);
  }
}

runTest();
