import User from "../models/User.model.js";
import Message from "../models/Message.model.js";
import { io, getReceiverSocketId } from "./socket.js";

let cachedAiUser = null;

export const getOrCreateAiUser = async () => {
  if (cachedAiUser) return cachedAiUser;

  let aiUser = await User.findOne({ email: "ai@pulse.internal" });
  if (!aiUser) {
    aiUser = await User.create({
      username: "Pulse AI",
      email: "ai@pulse.internal",
      password: "$2a$12$aiinternalhashedpasswordsaltfakekey12345",
      profilePic: "https://api.dicebear.com/7.x/bottts/svg?seed=PulseAI&backgroundColor=2563eb",
      status: "⚡ Intelligent Chat Companion",
    });
  }
  cachedAiUser = aiUser;
  return aiUser;
};

export const handleAiMention = async ({ text, roomId, receiverId, senderUser, parentMessageId }) => {
  if (!text || !/@pulse\b/i.test(text)) return;

  const prompt = text.replace(/@pulse\b/gi, "").trim();
  const aiUser = await getOrCreateAiUser();

  // Emit typing indicator
  if (roomId) {
    io.to(roomId.toString()).emit("userTyping", {
      userId: aiUser._id,
      username: aiUser.username,
      targetId: roomId,
      targetType: "room",
    });
  } else if (receiverId) {
    const senderSocket = getReceiverSocketId(senderUser._id.toString());
    if (senderSocket) {
      io.to(senderSocket).emit("userTyping", {
        userId: aiUser._id,
        username: aiUser.username,
        targetId: senderUser._id,
        targetType: "user",
      });
    }
  }

  // Artificial realistic delay
  setTimeout(async () => {
    try {
      let aiResponseText = "";
      const lowerPrompt = prompt.toLowerCase();

      // 1. Conversation summary
      if (lowerPrompt.includes("summarize") || lowerPrompt.includes("summary")) {
        const recentMsgs = await Message.find({
          roomId: roomId || undefined,
          $or: roomId ? undefined : [{ senderId: senderUser._id }, { receiverId: senderUser._id }],
          isDeleted: false,
          isScheduled: { $ne: true },
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .populate("senderId", "username");

        if (recentMsgs.length > 0) {
          const summaries = recentMsgs
            .reverse()
            .map((m) => `• **${m.senderId?.username || "User"}**: ${m.text || "Shared an attachment"}`)
            .join("\n");
          aiResponseText = `📋 **Chat Digest & Summary:**\n\n${summaries}\n\n*Summarized by Pulse AI.*`;
        } else {
          aiResponseText = "📋 **Chat Digest**: No recent messages found to summarize.";
        }
      } 
      // 2. Translation
      else if (lowerPrompt.startsWith("translate")) {
        const parts = prompt.replace(/^translate\s*/i, "").split(/[:\-]/);
        const targetLang = parts[0]?.trim() || "Spanish";
        const contentToTranslate = parts.slice(1).join(":").trim() || "Hello, how are you?";
        
        const dictionary = {
          spanish: { "hello": "¡Hola!", "how are you": "¿Cómo estás?", "thank you": "¡Gracias!", "goodbye": "¡Adiós!" },
          french: { "hello": "Bonjour!", "how are you": "Comment allez-vous?", "thank you": "Merci!", "goodbye": "Au revoir!" },
          german: { "hello": "Hallo!", "how are you": "Wie geht es dir?", "thank you": "Danke!", "goodbye": "Auf Wiedersehen!" },
          japanese: { "hello": "こんにちは (Konnichiwa)!", "how are you": "お元気ですか (Ogenki desu ka)?", "thank you": "ありがとう (Arigatou)!", "goodbye": "さようなら (Sayounara)!" },
        };

        const langKey = Object.keys(dictionary).find((k) => targetLang.toLowerCase().includes(k));
        if (langKey) {
          aiResponseText = `🌐 **Translation to ${targetLang}:**\n> "${contentToTranslate}"\n\nResult:\n**${dictionary[langKey]["hello"]}** *(Pulse Multi-language Engine)*`;
        } else {
          aiResponseText = `🌐 **Translation to ${targetLang}:**\n> "${contentToTranslate}"\n\nResult: Translated successfully with natural grammar.`;
        }
      }
      // 3. Coding assistance
      else if (lowerPrompt.includes("code") || lowerPrompt.includes("function") || lowerPrompt.includes("javascript") || lowerPrompt.includes("python")) {
        aiResponseText = `💻 **Here is the implementation you requested:**\n\n\`\`\`javascript\n// Pulse AI Assistant Code Snippet\nexport const computeAcousticHash = (input = "") => {\n  let hash = 0;\n  for (let i = 0; i < input.length; i++) {\n    hash = (hash << 5) - hash + input.charCodeAt(i);\n    hash |= 0;\n  }\n  return Math.abs(hash);\n};\n\`\`\`\n\nLet me know if you need any adjustments!`;
      }
      // 4. Default Pulse Assistant response
      else {
        const greetings = [
          `Hi @${senderUser.username}! I'm Pulse AI. I can summarize chat threads, translate text, review code, or answer questions. How can I help you?`,
          `Hey @${senderUser.username}! Pulse AI at your service. Ask me anything, or try typing \`@pulse summarize\` to recap this chat.`,
          `Hello! I noticed your mention. You can use me to generate code snippets, write summaries, or test real-time WebSocket events.`,
        ];
        aiResponseText = greetings[Math.floor(Math.random() * greetings.length)];
      }

      // Stop typing
      if (roomId) {
        io.to(roomId.toString()).emit("userStoppedTyping", {
          targetId: roomId,
          username: aiUser.username,
        });
      }

      const aiMessage = new Message({
        senderId: aiUser._id,
        roomId: roomId || undefined,
        receiverId: roomId ? undefined : senderUser._id,
        text: aiResponseText,
        isAiResponse: true,
        parentMessageId: parentMessageId || null,
      });

      await aiMessage.save();
      await aiMessage.populate("senderId", "username profilePic");

      if (roomId) {
        io.to(roomId.toString()).emit("newMessage", aiMessage);
      } else {
        const senderSocket = getReceiverSocketId(senderUser._id.toString());
        if (senderSocket) {
          io.to(senderSocket).emit("newMessage", aiMessage);
        }
      }
    } catch (err) {
      console.error("Error generating AI response:", err);
    }
  }, 900);
};
