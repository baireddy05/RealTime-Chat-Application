import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { 
  X, 
  Loader, 
  Smile, 
  Trash2, 
  Check, 
  Image as ImageIcon, 
  Camera, 
  FileText, 
  User,
  Reply,
  Edit3,
  File,
  Clock,
  Flame,
  Delete,
  Sparkles,
  MapPin,
  MonitorPlay,
  PenTool,
  Code2,
  Mic,
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import ImageModal from "./ImageModal";
const GifPicker = lazy(() => import("./GifPicker"));
const EmojiPicker = lazy(() => import("emoji-picker-react"));
// Heavy composer modals are code-split: their chunks load only on first open,
// keeping the main chat bundle (and first paint) lean.
const DrawSketchModal = lazy(() => import("./DrawSketchModal"));
const CodeSnippetModal = lazy(() => import("./CodeSnippetModal"));
const ContactModal = lazy(() => import("./ContactModal"));
const CreatePollModal = lazy(() => import("./CreatePollModal"));
import { emitPulseShockwave } from "../lib/pulseShockwave";
import { useBackHandler } from "../lib/backNavigation";

const COMMON_EMOJIS = [
  "😀", "😂", "😍", "🔥", "👍", "❤️", "🎉", "🚀", 
  "💯", "👏", "✨", "🤔", "🥳", "😎", "🙌", "🙏", 
  "💪", "👀", "⭐", "💡", "☕", "🍕", "🎈", "✅"
];

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const MessageInput = ({ droppedFile, onClearDroppedFile }) => {
  const { theme } = useThemeStore();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [documentFile, setDocumentFile] = useState(null); // { file, name, size, type, dataUrl }
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaTab, setMediaTab] = useState("emojis"); // "emojis" | "gifs" | "stickers"
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(null);
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTypingPulse, setIsTypingPulse] = useState(false);
  const [isWhisperMode, setIsWhisperMode] = useState(false);
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [isHD, setIsHD] = useState(false);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const speechRecognitionRef = useRef(null);
  const pulseTimeoutRef = useRef(null);

  // Mobile Back Navigation handlers for input popups and previews
  useBackHandler(showMediaPicker, () => setShowMediaPicker(false), "input-media-picker");
  useBackHandler(showAttachMenu, () => setShowAttachMenu(false), "input-attach-menu");
  useBackHandler(showTimerMenu, () => setShowTimerMenu(false), "input-timer-menu");
  useBackHandler(showScheduleMenu, () => setShowScheduleMenu(false), "input-schedule-menu");
  useBackHandler(showDrawModal, () => setShowDrawModal(false), "input-draw-modal");
  useBackHandler(showCodeModal, () => setShowCodeModal(false), "input-code-modal");
  useBackHandler(!!previewModalImage, () => setPreviewModalImage(null), "input-preview-modal");
  useBackHandler(!!imagePreview, () => setImagePreview(null), "input-image-preview");
  useBackHandler(!!documentFile, () => setDocumentFile(null), "input-doc-preview");

  useEffect(() => {
    if (!droppedFile) return;
    if (droppedFile.type && droppedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview({ file: droppedFile, preview: reader.result });
      };
      reader.readAsDataURL(droppedFile);
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentFile({
          file: droppedFile,
          name: droppedFile.name,
          size: droppedFile.size,
          type: droppedFile.type || "application/octet-stream",
          dataUrl: reader.result,
        });
      };
      reader.readAsDataURL(droppedFile);
    }
    onClearDroppedFile?.();
  }, [droppedFile, onClearDroppedFile]);

  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const TYPING_EMIT_THROTTLE_MS = 1500;
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  const attachMenuRef = useRef(null);
  const attachBtnRef = useRef(null);
  const mediaPickerRef = useRef(null);
  const mediaBtnRef = useRef(null);
  const timerMenuRef = useRef(null);
  const timerBtnRef = useRef(null);
  const scheduleMenuRef = useRef(null);
  const scheduleBtnRef = useRef(null);
  const inputRef = useRef(null);
  const sendBtnRef = useRef(null);

  const {
    sendMessage,
    editMessage,
    isSending,
    selectedChat,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    disappearingTimer,
    setDisappearingTimer,
    setChatDisappearing,
    drafts,
    setDraft,
    updateLiveLocation,
    stopLiveLocation,
  } = useChatStore();
  const { authUser, socket } = useAuthStore();

  // Live location sharing session (GPS watch pushing fixes to our live message)
  const [showLiveMenu, setShowLiveMenu] = useState(false);
  const [liveShare, setLiveShare] = useState(null); // { messageId }
  const liveWatchIdRef = useRef(null);
  const liveLastPushRef = useRef(0);
  const liveShareRef = useRef(null);
  liveShareRef.current = liveShare;

  const clearLiveWatch = () => {
    if (liveWatchIdRef.current !== null && navigator.geolocation?.clearWatch) {
      try {
        navigator.geolocation.clearWatch(liveWatchIdRef.current);
      } catch {}
    }
    liveWatchIdRef.current = null;
  };

  // Stop pushing fixes on unmount; the share itself stays live server-side
  // until it expires or is stopped explicitly.
  useEffect(() => {
    return () => {
      if (liveWatchIdRef.current !== null && navigator.geolocation?.clearWatch) {
        try {
          navigator.geolocation.clearWatch(liveWatchIdRef.current);
        } catch {}
      }
    };
  }, []);

  useBackHandler(showLiveMenu, () => setShowLiveMenu(false), "input-live-menu");

  // Populate text when editing a message
  useEffect(() => {
    if (editingMessage) {
      queueMicrotask(() => {
        setText(editingMessage.decryptedText || editingMessage.text || "");
        setReplyingTo(null);
      });
    }
  }, [editingMessage, setReplyingTo]);

  // Auto-focus input when replying to a message or on swipe-reply
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    const handleFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("pulse:focus-input", handleFocus);
    return () => window.removeEventListener("pulse:focus-input", handleFocus);
  }, []);

  // Close popup menus, reset attachments, and load draft when switching chats
  useEffect(() => {
    queueMicrotask(() => {
      setShowAttachMenu(false);
      setShowMediaPicker(false);
      setImagePreview(null);
      setDocumentFile(null);
      setIsViewOnce(false);
      
      if (selectedChat?.id && !editingMessage) {
        const savedDraft = drafts[selectedChat.id];
        setText(savedDraft || "");
      }
    });
  }, [selectedChat?.id, editingMessage, drafts]);

  // Save draft on text change
  useEffect(() => {
    if (selectedChat?.id && !editingMessage && !isSending) {
      const timeout = setTimeout(() => {
        setDraft(selectedChat.id, text);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [text, selectedChat?.id, editingMessage, setDraft, isSending]);

  // Global outside click handler to close popups
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showAttachMenu &&
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target) &&
        attachBtnRef.current &&
        !attachBtnRef.current.contains(e.target)
      ) {
        setShowAttachMenu(false);
      }

      if (
        showMediaPicker &&
        mediaPickerRef.current &&
        !mediaPickerRef.current.contains(e.target) &&
        mediaBtnRef.current &&
        !mediaBtnRef.current.contains(e.target)
      ) {
        setShowMediaPicker(false);
      }

      if (
        showTimerMenu &&
        timerMenuRef.current &&
        !timerMenuRef.current.contains(e.target) &&
        timerBtnRef.current &&
        !timerBtnRef.current.contains(e.target)
      ) {
        setShowTimerMenu(false);
      }

      if (
        showScheduleMenu &&
        scheduleMenuRef.current &&
        !scheduleMenuRef.current.contains(e.target) &&
        scheduleBtnRef.current &&
        !scheduleBtnRef.current.contains(e.target)
      ) {
        setShowScheduleMenu(false);
      }
    };

    if (showAttachMenu || showMediaPicker || showTimerMenu || showScheduleMenu) {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [showAttachMenu, showMediaPicker, showTimerMenu, showScheduleMenu]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleTextChange = (e) => {
    const val = e.target.value;
    const isAddingChar = val.length > text.length;
    setText(val);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    // Satisfying, localized tactile keystroke pulse
    setIsTypingPulse(true);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      setIsTypingPulse(false);
    }, 280);

    // Subtle micro-haptic tick on supported mobile devices
    if (isAddingChar && typeof window !== "undefined" && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(6);
      } catch {}
    }

    try {
      if (!socket || !selectedChat) return;

      // Throttle `typing` emits: at most one per 1.5s while typing.
      // Previously every keystroke emitted, flooding the socket server and
      // re-rendering every client on each keypress.
      const now = Date.now();
      if (now - lastTypingEmitRef.current >= TYPING_EMIT_THROTTLE_MS) {
        lastTypingEmitRef.current = now;
        socket.emit("typing", {
          targetId: selectedChat.id,
          targetType: selectedChat.type,
          username: authUser?.username || "User",
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try {
          socket.emit("stopTyping", {
            targetId: selectedChat.id,
            targetType: selectedChat.type,
            username: authUser?.username || "User",
          });
        } catch {}
      }, 1500);
    } catch {}
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    if (inputRef.current) emitPulseShockwave(inputRef.current);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview({ file, preview: reader.result });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setDocumentFile({
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: reader.result,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeDocument = () => {
    setDocumentFile(null);
    if (documentInputRef.current) documentInputRef.current.value = "";
  };

  const compressImage = (file, hd) => {
    return new Promise((resolve) => {
      if (hd) return resolve(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          // if already small enough, just return original
          if (width === img.width && height === img.height) {
             return resolve(file);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            const newFile = new File([blob], file.name, { type: "image/jpeg" });
            resolve(newFile);
          }, "image/jpeg", 0.7);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadToCloudinary = async (file) => {
    try {
      const { data } = await axiosInstance.get("/upload/signature");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", data.apiKey);
      formData.append("timestamp", data.timestamp);
      formData.append("signature", data.signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await res.json();
      return uploadData.secure_url;
    } catch (error) {
      console.error("Upload failed", error);
      return null;
    }
  };

  // Documents go to our own backend store (Cloudinary blocks document
  // delivery with 401s, producing links that can never be downloaded again).
  // Returns { url, fileId }. Throws when the file cannot be stored, so the
  // sender knows instead of sending a dead link.
  const uploadRawFile = async (fileObj) => {
    const formData = new FormData();
    formData.append("file", fileObj.file, fileObj.name || "document");
    try {
      const { data } = await axiosInstance.post("/upload/document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      if (data?.url) {
        return { url: data.url, fileId: data.fileId || null };
      }
    } catch (err) {
      console.warn("Backend document upload failed:", err?.response?.data || err.message);
    }
    // Last resort for tiny files only: embed as data URL (must fit the ~1MB
    // JSON body limit or the message send itself will fail).
    const approxBytes = Math.floor((fileObj.dataUrl?.length || 0) * 0.75);
    if (fileObj.dataUrl && approxBytes > 0 && approxBytes < 700 * 1024) {
      return { url: fileObj.dataUrl, fileId: null };
    }
    throw new Error("couldn't upload the document (check your connection and retry)");
  };

  const uploadAudioToCloudinary = async (audioBlob) => {
    try {
      const { data } = await axiosInstance.get("/upload/signature");
      const formData = new FormData();
      formData.append("file", audioBlob, "voice-note.webm");
      formData.append("api_key", data.apiKey);
      formData.append("timestamp", data.timestamp);
      formData.append("signature", data.signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/video/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await res.json();
      return uploadData.secure_url;
    } catch (error) {
      console.error("Audio upload failed", error);
      return null;
    }
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to access microphone", err);
      alert("Microphone permission was denied or is not available.");
    }
  };

  const startVideoRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsRecordingVideo(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to access camera/microphone", err);
      alert("Camera/Microphone permission was denied or is not available.");
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    setIsRecordingVideo(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      const tracks = mediaRecorderRef.current.stream?.getTracks();
      if (tracks) {
        tracks.forEach(track => track.stop());
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
  };

  const handleShareLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
        await sendMessage({ text: "", location: { lat: latitude, lng: longitude } });
        window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
      },
      (error) => {
        alert("Unable to retrieve your location: " + error.message);
      }
    );
  };

  const startLiveShare = (minutes) => {
    setShowLiveMenu(false);
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    if (liveShare) {
      alert("You are already sharing live location. Stop it first to start a new share.");
      return;
    }
    const liveUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
        const res = await sendMessage({
          text: "",
          location: { lat: latitude, lng: longitude },
          liveUntil,
        });
        window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
        const messageId = res?.data?._id;
        if (!res.success || !messageId) return;
        setLiveShare({ messageId });
        liveLastPushRef.current = Date.now();
        try {
          liveWatchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
              // Throttle fixes to one push per 8s
              if (Date.now() - liveLastPushRef.current < 8000) return;
              liveLastPushRef.current = Date.now();
              const id = liveShareRef.current?.messageId;
              if (!id) return;
              const out = await updateLiveLocation(id, pos.coords.latitude, pos.coords.longitude);
              if (!out.success && out.expired) {
                clearLiveWatch();
                setLiveShare(null);
              }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
          );
        } catch {}
      },
      (error) => {
        alert("Unable to retrieve your location: " + error.message);
      }
    );
  };

  const stopLiveShare = async () => {
    const id = liveShare?.messageId;
    clearLiveWatch();
    setLiveShare(null);
    setShowLiveMenu(false);
    if (id) await stopLiveLocation(id);
  };

  const handleSendSketch = async (dataUrl) => {
    window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
    await sendMessage({ text: "", image: dataUrl });
    window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
  };

  const handleSendCodeSnippet = async (formattedCode) => {
    window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
    await sendMessage({ text: formattedCode });
    window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
  };

  const toggleDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice typing is not supported in this browser. Please try Chrome or Edge.");
      return;
    }
    if (isDictating) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setText((prev) => {
            const separator = prev && !prev.endsWith(" ") ? " " : "";
            return prev + separator + transcript.trim();
          });
        }
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
    } catch (err) {
      console.error("Failed to start voice dictation:", err);
      setIsDictating(false);
    }
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const mimeType = isRecordingVideo ? "video/webm" : "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          setIsUploading(true);
          const mediaUrl = await uploadAudioToCloudinary(audioBlob);
          setIsUploading(false);

          if (mediaUrl) {
            window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
            const payload = { text: "" };
            if (isRecordingVideo) {
              payload.videoNote = mediaUrl;
            } else {
              payload.audio = mediaUrl;
            }
            await sendMessage(payload);
            window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
          }
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        audioChunksRef.current = [];
        setIsRecording(false);
        setIsRecordingVideo(false);
        setRecordingSeconds(0);
      };

      mediaRecorderRef.current.stop();
    }
  };

  const formatRecordingTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSendMessage = async (e, presetText) => {
    e?.preventDefault();
    if (isSending) return; // Prevent rapid fire sending duplicates

    // If editing existing message
    if (editingMessage) {
      if (!text.trim()) return;
      await editMessage(editingMessage._id, text.trim());
      setText("");
      setEditingMessage(null);
      return;
    }

    if (!text.trim() && !imagePreview && !documentFile && !presetText) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket && selectedChat) {
      socket.emit("stopTyping", {
        targetId: selectedChat.id,
        targetType: selectedChat.type,
        username: authUser?.username,
      });
    }

    let imageUrl = null;
    let filePayload = null;
    
    // Save current values and clear UI synchronously to prevent race conditions during rapid typing
    // A presetText (smart quick reply) always wins over attachments/drafts.
    const currentText = (presetText || text).trim();
    const currentImage = presetText ? null : imagePreview;
    const currentDoc = presetText ? null : documentFile;
    const currentSchedule = scheduledFor;
    const currentReply = replyingTo;

    if (sendBtnRef.current) {
      emitPulseShockwave(sendBtnRef.current);
    } else if (inputRef.current) {
      emitPulseShockwave(inputRef.current);
    }
    
    setText("");
    if (selectedChat?.id) {
      setDraft(selectedChat.id, "");
    }
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    removeImage();
    removeDocument();
    setIsViewOnce(false);
    setShowMediaPicker(false);
    setReplyingTo(null);
    setScheduledFor(null);

    // Keep mobile virtual keyboard open and input field focused
    inputRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    if (currentImage) {
      setIsUploading(true);
      const finalFile = await compressImage(currentImage.file, isHD);
      imageUrl = await uploadToCloudinary(finalFile);
      setIsUploading(false);
    }

    if (currentDoc) {
      setIsUploading(true);
      try {
        const uploaded = await uploadRawFile(currentDoc);
        const url = typeof uploaded === "string" ? uploaded : uploaded?.url;
        const fileId = typeof uploaded === "object" ? uploaded?.fileId || null : null;
        if (!url) throw new Error("upload failed");
        filePayload = {
          url,
          ...(fileId ? { fileId } : {}),
          name: currentDoc.name,
          size: currentDoc.size,
          fileType: currentDoc.type,
        };
      } catch (err) {
        setIsUploading(false);
        alert(`Couldn't send "${currentDoc.name || "document"}": ${err?.message || "upload failed"}`);
        return;
      }
      setIsUploading(false);
    }

    window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
    await sendMessage({
      text: currentText,
      image: imageUrl,
      viewOnce: !!currentImage && isViewOnce,
      file: filePayload,
      scheduledFor: currentSchedule ? new Date(currentSchedule).toISOString() : undefined,
      replyTo: currentReply ? {
        messageId: currentReply._id,
        senderName: currentReply.senderId?.username || currentReply.senderName || "User",
        text: currentReply.decryptedText || currentReply.text || (currentReply.image ? "📷 Photo" : currentReply.file ? `📎️ ${currentReply.file.name}` : "Attachment"),
        image: currentReply.image || null,
        file: currentReply.file || null,
      } : undefined,
      isWhisper: isWhisperMode,
      isAnnouncement: isAnnouncementMode,
    });

    // Reset whisper mode
    if (isWhisperMode) setIsWhisperMode(false);
    // Reset announcement mode
    if (isAnnouncementMode) setIsAnnouncementMode(false);

    // Fire after React state updates the DOM
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
    }, 100);
  };

  const hasContent = text.trim().length > 0 || imagePreview || documentFile;

  return (
    <div className="bg-transparent px-2 sm:px-4 md:px-5 pb-2 sm:pb-3 pt-1 relative select-none safe-bottom flex flex-col gap-2 shrink-0 z-30">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-[var(--glass-hover)] border-l-2 border-accent-primary border border-[var(--glass-border)] animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            {replyingTo.image ? (
              <img src={replyingTo.image} alt="Reply preview" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-black/10 dark:bg-white/10" />
            ) : (
              <div className="p-1 rounded-full bg-accent-primary/20 text-accent-primary flex-shrink-0">
                <Reply size={12} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-accent-primary truncate block">
                Replying to {replyingTo.senderId?.username || replyingTo.senderName || "User"}
              </span>
              <p className="text-xs text-theme-muted truncate">
                {replyingTo.decryptedText || replyingTo.text || (replyingTo.image ? "Photo" : replyingTo.file ? replyingTo.file.name : "Attachment")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-theme-muted/50 hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-[var(--glass-hover)] border-l-2 border-accent-secondary border border-[var(--glass-border)] animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-full bg-accent-secondary/20 text-accent-secondary flex-shrink-0">
              <Edit3 size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-accent-secondary block">Editing message</span>
              <p className="text-xs text-theme-muted truncate">{editingMessage.decryptedText || editingMessage.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMessage(null);
              setText("");
            }}
            className="p-1 rounded-full text-theme-muted/50 hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Announcement Banner */}
      {isAnnouncementMode && (
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border-l-2 border-amber-500 border border-[var(--glass-border)] animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-full bg-amber-500/20 text-amber-500 flex-shrink-0">
              <span className="material-symbols-outlined text-[14px]">campaign</span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-amber-500 block">Announcement — visible to the whole group</span>
              <p className="text-xs text-theme-muted truncate">Only admins can post announcements</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAnnouncementMode(false)}
            className="p-1 rounded-full text-theme-muted/50 hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Document File Attachment Preview Card */}
      {documentFile && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-theme-main max-w-sm animate-fadeIn shadow-glass">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-accent-primary/20 text-accent-primary flex-shrink-0">
              <File size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-theme-main truncate">{documentFile.name}</p>
              <p className="text-[10px] text-theme-muted">{formatBytes(documentFile.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={removeDocument}
            className="p-1 text-theme-muted hover:text-red-400 rounded-full transition-colors ml-2"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Selected Image Thumbnail Preview */}
      {imagePreview && (
        <div className="flex items-center gap-2.5 bg-[var(--glass-hover)] p-1.5 rounded-2xl border border-[var(--glass-border)] w-fit shadow-glass">
          <div className="relative inline-block group/thumb">
            <img
              src={imagePreview.preview}
              alt="Preview"
              onClick={() => setPreviewModalImage(imagePreview.preview)}
              className="w-14 h-14 object-cover rounded-xl border border-[var(--glass-border)] cursor-pointer hover:opacity-80 transition-opacity"
              title="Click to expand"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow"
            >
              <X size={10} />
            </button>
          </div>
          <div className="flex flex-col gap-1 pr-2">
            <span className="text-xs text-theme-muted font-medium">Photo attached</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsHD(!isHD)}
                className={`w-fit px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide transition-all shadow-sm ${
                  isHD
                    ? "bg-accent-primary text-white ring-1 ring-accent-primary"
                    : "bg-black/10 text-zinc-500 dark:bg-white/10 dark:text-zinc-400 hover:bg-black/20 dark:hover:bg-white/20"
                }`}
                title={isHD ? "Sending in High Quality" : "Sending compressed"}
              >
                HD
              </button>
              <button
                type="button"
                onClick={() => setIsViewOnce((v) => !v)}
                className={`w-fit px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide transition-all shadow-sm flex items-center gap-0.5 ${
                  isViewOnce
                    ? "bg-accent-primary text-white ring-1 ring-accent-primary"
                    : "bg-black/10 text-zinc-500 dark:bg-white/10 dark:text-zinc-400 hover:bg-black/20 dark:hover:bg-white/20"
                }`}
                title={isViewOnce ? "View-once ON: photo vanishes after opening" : "Send as view-once photo"}
              >
                <span className="material-symbols-outlined text-[12px]">counter_1</span>
                1×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Emojis, GIFs & Stickers Popover */}
      {showMediaPicker && (
        <div
          ref={mediaPickerRef}
          id="media-picker-popover"
          className="absolute bottom-full mb-2 left-2 right-2 sm:left-4 sm:right-auto sm:w-[360px] sm:max-w-[370px] z-50 rounded-3xl shadow-glass animate-scaleIn overflow-hidden border border-[var(--glass-border)] backdrop-blur-2xl bg-[var(--glass-heavy)]"
        >
          {/* Unified Header with 3 Segmented Tabs & Controls */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-header)]">
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex-1">
              <button
                type="button"
                onClick={() => setMediaTab("emojis")}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  mediaTab === "emojis"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm"
                    : "text-theme-muted hover:text-theme-main"
                }`}
              >
                <Smile size={14} />
                <span>Emoji</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaTab("gifs")}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  mediaTab === "gifs"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm"
                    : "text-theme-muted hover:text-theme-main"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">gif_box</span>
                <span>GIFs</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaTab("stickers")}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  mediaTab === "stickers"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm"
                    : "text-theme-muted hover:text-theme-main"
                }`}
              >
                <Sparkles size={13} />
                <span>Stickers</span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {mediaTab === "emojis" && (
                <button
                  type="button"
                  onClick={() => {
                    setText((prev) => {
                      const chars = Array.from(prev);
                      chars.pop();
                      return chars.join('');
                    });
                    if (inputRef.current) emitPulseShockwave(inputRef.current);
                  }}
                  className="text-theme-muted hover:text-red-400 p-1 rounded-full hover:bg-[var(--glass-hover)] transition-colors"
                  title="Backspace"
                >
                  <Delete size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="text-theme-muted hover:text-theme-main p-1 rounded-full hover:bg-[var(--glass-hover)] transition-colors"
                title="Close picker"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Tab 1: Emojis */}
          {mediaTab === "emojis" && (
            <div className="flex flex-col">
              {/* Quick reactions strip */}
              <div className="px-2.5 py-1.5 border-b border-[var(--glass-border)] flex items-center gap-1 overflow-x-auto no-scrollbar bg-[var(--glass-surface)]">
                <span className="text-[10px] uppercase font-medium text-theme-muted px-1">Quick:</span>
                {COMMON_EMOJIS.slice(0, 10).map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                    className="hover:scale-125 active:scale-95 transition-transform p-1 rounded-lg hover:bg-[var(--glass-hover)] text-base flex-shrink-0 flex items-center justify-center emoji-text"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="emoji-picker-container w-full overflow-hidden">
                <Suspense fallback={<div className="flex flex-col items-center justify-center h-[300px] sm:h-[380px]"><Loader className="size-6 animate-spin text-theme-muted mb-2" /><span className="text-xs text-theme-muted">Loading emojis...</span></div>}>
                  <EmojiPicker
                    theme={theme === "dark" ? "dark" : "light"}
                    onEmojiClick={(emojiData) => handleEmojiSelect(emojiData.emoji)}
                    autoFocusSearch={false}
                    searchPlaceHolder="Search all emojis..."
                    width="100%"
                    height={typeof window !== "undefined" && window.innerWidth < 640 ? 300 : 380}
                    lazyLoadEmojis={true}
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled={false}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {/* Tab 2 & 3: GIFs & Stickers */}
          {(mediaTab === "gifs" || mediaTab === "stickers") && (
            <Suspense fallback={<div className="flex flex-col items-center justify-center h-[300px] sm:h-[380px]"><Loader className="size-6 animate-spin text-theme-muted mb-2" /><span className="text-xs text-theme-muted">Loading {mediaTab}...</span></div>}>
              <GifPicker
                key={mediaTab}
                initialTab={mediaTab}
                hideTopTabs={true}
                onGifSelect={async (gifUrl) => {
                  const isSticker = mediaTab === "stickers" || (gifUrl && (gifUrl.includes("/stickers/") || gifUrl.includes("sticker")));
                  setShowMediaPicker(false);
                  window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
                  await sendMessage({ text: "", image: gifUrl, isSticker });
                  window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
                }}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* Attachment Menu Popover */}
      {showAttachMenu && (
        <div
          ref={attachMenuRef}
          id="attach-menu-popover"
          className="absolute bottom-full mb-2 left-2 sm:left-12 md:left-14 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-1.5 shadow-glass w-52 max-w-[calc(100vw-16px)] animate-scaleIn space-y-0.5"
        >
          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <ImageIcon size={14} />
            </div>
            <span>Photos & Videos</span>
          </button>
          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-accent-secondary/20 text-accent-secondary flex items-center justify-center">
              <Camera size={14} />
            </div>
            <span>Camera</span>
          </button>
          <button
            type="button"
            onClick={() => {
              documentInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-[var(--glass-hover)] text-theme-muted flex items-center justify-center">
              <FileText size={14} />
            </div>
            <span>Document</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowContactModal(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <User size={14} />
            </div>
            <span>Share Contact</span>
          </button>
          <button
            type="button"
            onClick={handleShareLocation}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-green-500/20 text-green-500 flex items-center justify-center">
              <MapPin size={14} />
            </div>
            <span>Share Location</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLiveMenu(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px]">share_location</span>
            </div>
            <span>Share Live Location</span>
          </button>
          <div className="h-px bg-[var(--glass-border)] my-1" />
          <button
            type="button"
            onClick={() => {
              setShowTimerMenu(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <Flame size={14} />
            </div>
            <span>Disappearing Timer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowScheduleMenu(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Clock size={14} />
            </div>
            <span>Schedule Message</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsWhisperMode(!isWhisperMode);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isWhisperMode ? 'bg-red-500/20 text-red-500' : 'bg-pink-500/20 text-pink-500'}`}>
              <span className="material-symbols-outlined text-[15px]">{isWhisperMode ? "visibility_off" : "visibility"}</span>
            </div>
            <span>{isWhisperMode ? "Whisper Mode (ON)" : "Send as Whisper"}</span>
          </button>
          {(() => {
            const myId = authUser?._id?.toString();
            const admins = selectedChat?.admins || [];
            const creatorId = (selectedChat?.createdBy?._id || selectedChat?.createdBy)?.toString();
            const amIAdmin = selectedChat?.type === "room" && (
              creatorId === myId || admins.some((a) => (a?._id || a)?.toString() === myId)
            );
            if (!amIAdmin) return null;
            return (
              <button
                type="button"
                onClick={() => {
                  setIsAnnouncementMode(!isAnnouncementMode);
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isAnnouncementMode ? 'bg-amber-500/25 text-amber-500' : 'bg-amber-500/15 text-amber-400'}`}>
                  <span className="material-symbols-outlined text-[15px]">campaign</span>
                </div>
                <span>{isAnnouncementMode ? "Announcement (ON)" : "Post as Announcement"}</span>
              </button>
            );
          })()}
          <button
            type="button"
            onClick={() => {
              setShowPollModal(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">poll</span>
            </div>
            <span>Poll</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDrawModal(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <PenTool size={14} />
            </div>
            <span>Draw & Sketch</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCodeModal(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Code2 size={14} />
            </div>
            <span>Code Snippet</span>
          </button>
        </div>
      )}

      {/* Live Location Duration Picker */}
      {showLiveMenu && (
        <div className="absolute bottom-full mb-2 left-2 sm:left-12 md:left-14 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-2 shadow-glass w-56 max-w-[calc(100vw-16px)] animate-scaleIn space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-theme-muted uppercase tracking-wider flex items-center justify-between">
            <span>Share live location for</span>
            <button
              type="button"
              onClick={() => setShowLiveMenu(false)}
              className="text-theme-muted hover:text-theme-main transition-colors"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
          {[
            { label: "15 minutes", minutes: 15 },
            { label: "1 hour", minutes: 60 },
            { label: "8 hours", minutes: 480 },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => startLiveShare(opt.minutes)}
              className="w-full text-left px-2.5 py-2 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors flex items-center justify-between"
            >
              <span>{opt.label}</span>
              <span className="material-symbols-outlined text-[15px] text-red-500">share_location</span>
            </button>
          ))}
          <p className="px-2.5 pb-1 text-[10px] text-theme-muted">
            Your position updates live until time runs out or you stop it.
          </p>
        </div>
      )}

      {/* Active live-share banner */}
      {liveShare && (
        <div className="mb-2 px-3 py-1.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs text-red-400 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Sharing live location</span>
          </div>
          <button
            type="button"
            onClick={stopLiveShare}
            className="px-2.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 font-bold transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Disappearing Timer Menu Popover */}
      {showTimerMenu && (
        <div ref={timerMenuRef} className="absolute bottom-full mb-2 right-2 sm:right-24 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-2 shadow-glass w-48 max-w-[calc(100vw-16px)] animate-scaleIn space-y-1 text-theme-main text-xs">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-theme-muted uppercase tracking-wider flex items-center justify-between">
            <span>Disappearing Timer</span>
            <Flame size={12} className="text-orange-400" />
          </div>
          {[
            { label: "Off", value: null },
            { label: "5 seconds (burn)", value: 5 },
            { label: "1 minute", value: 60 },
            { label: "1 hour", value: 3600 },
            { label: "24 hours", value: 86400 },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setDisappearingTimer(option.value);
                setShowTimerMenu(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-all flex items-center justify-between ${
                disappearingTimer === option.value
                  ? "bg-orange-500/20 text-orange-400 font-semibold"
                  : "hover:bg-[var(--glass-hover)] text-theme-main"
              }`}
            >
              <span>{option.label}</span>
              {disappearingTimer === option.value && <Check size={12} strokeWidth={3} />}
            </button>
          ))}
          <div className="h-px bg-[var(--glass-border)] my-1" />
          {(() => {
            const chatDefault = authUser?.chatPreferences?.[selectedChat?.id]?.disappearing ?? null;
            const labelFor = (v) =>
              v === 5 ? "5 seconds" : v === 60 ? "1 minute" : v === 3600 ? "1 hour" : v === 86400 ? "24 hours" : null;
            return (
              <>
                {chatDefault && chatDefault !== disappearingTimer && (
                  <p className="px-2.5 py-1 text-[10px] text-theme-muted">
                    Chat default: {labelFor(chatDefault) || `${chatDefault}s`}
                  </p>
                )}
                <button
                  type="button"
                  disabled={!selectedChat?.id}
                  onClick={async () => {
                    if (selectedChat?.id) await setChatDisappearing(selectedChat.id, disappearingTimer);
                    setShowTimerMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl transition-all flex items-center justify-between hover:bg-[var(--glass-hover)] text-theme-main disabled:opacity-40"
                >
                  <span>
                    {chatDefault === disappearingTimer && disappearingTimer
                      ? "✓ Default for this chat"
                      : "Set as default for this chat"}
                  </span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Schedule Message Popover */}
      {showScheduleMenu && (
        <div ref={scheduleMenuRef} className="absolute bottom-full mb-2 right-2 sm:right-16 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-3 shadow-glass w-64 max-w-[calc(100vw-16px)] animate-scaleIn space-y-2 text-theme-main text-xs">
          <div className="px-1 text-[11px] font-semibold text-accent-primary flex items-center justify-between">
            <span>Schedule Send</span>
            <Clock size={12} />
          </div>
          <div className="space-y-1">
            {[
              {
                label: "In 15 minutes",
                getTime: () => new Date(Date.now() + 15 * 60 * 1000),
              },
              {
                label: "In 1 hour",
                getTime: () => new Date(Date.now() + 60 * 60 * 1000),
              },
              {
                label: "Tomorrow 9:00 AM",
                getTime: () => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(9, 0, 0, 0);
                  return d;
                },
              },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setScheduledFor(preset.getTime());
                  setShowScheduleMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[var(--glass-hover)] text-theme-main transition-colors flex items-center justify-between"
              >
                <span>{preset.label}</span>
                <Clock size={11} className="text-theme-muted" />
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-[var(--glass-border)]">
            <label className="block text-[10px] text-theme-muted mb-1">Or Pick Date & Time:</label>
            <div className="flex gap-1.5">
              <input
                type="datetime-local"
                value={customScheduleDate}
                onChange={(e) => setCustomScheduleDate(e.target.value)}
                className="w-full glass-input rounded-xl px-2 py-1 text-[11px] text-theme-main border border-[var(--glass-border)]"
              />
              <button
                type="button"
                disabled={!customScheduleDate}
                onClick={() => {
                  setScheduledFor(new Date(customScheduleDate));
                  setShowScheduleMenu(false);
                  setCustomScheduleDate("");
                }}
                className="px-2.5 py-1 rounded-xl bg-accent-primary text-white text-[11px] font-medium disabled:opacity-40"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled message badge if active */}
      {scheduledFor && (
        <div className="mb-2 px-3 py-1.5 rounded-2xl bg-accent-primary/15 border border-accent-primary/30 flex items-center justify-between text-xs text-accent-primary animate-fadeIn">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock size={13} />
            <span>
              Will send:{" "}
              {new Date(scheduledFor).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setScheduledFor(null)}
            className="p-1 text-accent-primary hover:text-red-400 transition-colors"
            title="Cancel schedule"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {previewModalImage && (
        <ImageModal
          imageUrl={previewModalImage}
          onClose={() => setPreviewModalImage(null)}
        />
      )}

      {showContactModal && (
        <Suspense fallback={null}>
          <ContactModal
            isOpen={showContactModal}
            onClose={() => setShowContactModal(false)}
            onSendContact={async (contact) => {
              window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
              await sendMessage({ contact, text: "" });
              window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
            }}
          />
        </Suspense>
      )}

      {showPollModal && (
        <Suspense fallback={null}>
          <CreatePollModal
            isOpen={showPollModal}
            onClose={() => setShowPollModal(false)}
            onSubmit={async (pollData) => {
              window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
              await sendMessage({ text: "", poll: pollData });
              window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
            }}
          />
        </Suspense>
      )}

      {/* Voice Recording Bar UI */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-[var(--glass-surface)] border border-red-500/30 rounded-full px-4 py-2 shadow-glass animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-medium text-red-400">Recording audio...</span>
            <span className="text-xs text-theme-main font-mono bg-[var(--glass-hover)] px-2 py-0.5 rounded-full border border-[var(--glass-border)]">
              {formatRecordingTime(recordingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-1.5 rounded-full bg-[var(--glass-hover)] hover:bg-red-500/20 text-theme-muted hover:text-red-400 transition-colors"
              title="Discard"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-3.5 py-1 rounded-full bg-accent-primary hover:bg-accent-primary/80 text-white font-medium text-xs flex items-center gap-1 shadow-md shadow-accent-primary/25 transition-transform active:scale-95"
              title="Send voice note"
            >
              <Check size={14} />
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="flex flex-col gap-1.5">
          <div className={`flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-full glass-heavy border border-[var(--glass-border)] border-t-[var(--glass-border-top)] shadow-glass capsule-typing-pulse ${
            isTypingPulse ? "active" : ""
          }`}>
            {/* Attachment Button */}
            <button
              ref={attachBtnRef}
              id="attach-button"
              type="button"
              onClick={() => {
                setShowAttachMenu((prev) => !prev);
                setShowMediaPicker(false);
              }}
              className="p-1.5 sm:p-2 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors ml-0.5 shrink-0"
              title="Attach file or media"
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
            </button>

            {/* Unified Emoji, GIF & Sticker Trigger Button */}
            <button
              ref={mediaBtnRef}
              id="media-picker-button"
              type="button"
              onClick={() => {
                setShowMediaPicker((prev) => !prev);
                setShowAttachMenu(false);
              }}
              className={`p-1.5 sm:p-2 rounded-full transition-colors shrink-0 ${
                showMediaPicker
                  ? "text-accent-primary bg-accent-primary/15"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10"
              }`}
              title="Emojis, GIFs & Stickers"
            >
              <span className="material-symbols-outlined text-xl">mood</span>
            </button>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />

            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.zip,.csv,.xlsx,.json,.js,.py,.html,.css"
              className="hidden"
              ref={documentInputRef}
              onChange={handleDocumentChange}
            />

            {/* Text Input Field with Typing Rhythm Indicator - MAX HORIZONTAL WIDTH */}
            <div className="flex-1 flex items-center px-1.5 sm:px-2 min-w-0 relative">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full bg-transparent py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[14.5px] leading-snug focus:outline-none resize-none overflow-y-auto max-h-[120px] custom-scrollbar"
                placeholder={
                  scheduledFor
                    ? "Schedule a message..."
                    : disappearingTimer
                    ? `Ephemeral (${disappearingTimer}s)...`
                    : editingMessage
                    ? "Edit message..."
                    : "Type a message..."
                }
                value={text}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim() || imagePreview || documentFile) {
                      handleSendMessage(e);
                    }
                  }
                }}
              />
              {isWhisperMode && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center pointer-events-none" title="Whisper Mode ON">
                  <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                </div>
              )}
              {text.length > 0 && (
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-full mx-1 shrink-0 transition-all duration-200 pointer-events-none ${
                    isTypingPulse
                      ? "bg-zinc-900 dark:bg-white scale-125 opacity-80 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                      : "bg-zinc-400 dark:bg-zinc-600 scale-90 opacity-25"
                  }`}
                />
              )}
            </div>

            {/* In-capsule controls: Timer, Schedule, Mic & Send */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Disappearing Timer (shown if active, or on tablet/desktop) */}
              <button
                ref={timerBtnRef}
                type="button"
                onClick={() => {
                  setShowTimerMenu((prev) => !prev);
                  setShowScheduleMenu(false);
                }}
                className={`p-1.5 sm:p-2 rounded-full transition-colors items-center gap-1 ${
                  disappearingTimer
                    ? "flex text-amber-500 bg-amber-500/15 dark:text-amber-400 dark:bg-amber-500/20 font-bold"
                    : "hidden sm:flex text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10"
                }`}
                title={disappearingTimer ? `Disappearing timer: ${disappearingTimer}s` : "Set Disappearing Message Timer"}
              >
                <Flame size={15} className={disappearingTimer ? "animate-pulse" : ""} />
                {disappearingTimer && (
                  <span className="text-[10px] pr-0.5">{disappearingTimer < 60 ? `${disappearingTimer}s` : `${Math.floor(disappearingTimer / 60)}m`}</span>
                )}
              </button>

              {/* Schedule Button (hidden on mobile, accessible via Attach menu) */}
              <button
                ref={scheduleBtnRef}
                type="button"
                onClick={() => {
                  setShowScheduleMenu((prev) => !prev);
                  setShowTimerMenu(false);
                }}
                className={`p-1.5 sm:p-2 rounded-full transition-colors hidden sm:flex ${
                  scheduledFor
                    ? "text-zinc-900 bg-black/10 dark:text-white dark:bg-white/20 font-bold"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10"
                }`}
                title="Schedule Message"
              >
                <Clock size={15} />
              </button>

              {/* Video Memo: visible on mobile only when text is empty */}
              <button
                type="button"
                onClick={startVideoRecording}
                className={`p-1.5 sm:p-2 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors ${
                  hasContent || editingMessage ? "hidden sm:flex" : "flex"
                }`}
                title="Record Video Note"
              >
                <MonitorPlay size={18} />
              </button>

              {/* Voice Memo: visible on mobile only when text is empty */}
              <button
                type="button"
                onClick={startRecording}
                className={`p-1.5 sm:p-2 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors ${
                  hasContent || editingMessage ? "hidden sm:flex" : "flex"
                }`}
                title="Record Audio Note"
              >
                <span className="material-symbols-outlined text-xl">mic</span>
              </button>

              {/* Voice Typing / Dictation Button */}
              <button
                type="button"
                onClick={toggleDictation}
                className={`p-1.5 sm:p-2 rounded-full transition-all shrink-0 cursor-pointer ${
                  isDictating
                    ? "bg-red-500 text-white animate-pulse shadow-glow ring-2 ring-red-400"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10"
                } ${hasContent && !isDictating ? "hidden sm:flex" : "flex"}`}
                title={isDictating ? "Listening... Click to stop" : "Voice Typing (Speech-to-Text)"}
              >
                <Mic size={18} className={isDictating ? "animate-bounce" : ""} />
              </button>

              {/* Send Button: visible on mobile when text/media has content */}
              <button
                ref={sendBtnRef}
                type="submit"
                aria-disabled={!hasContent && !editingMessage}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onTouchEnd={() => {
                  inputRef.current?.focus({ preventScroll: true });
                }}
                onClick={(e) => {
                  if (!hasContent && !editingMessage) {
                    e.preventDefault();
                    return;
                  }
                  inputRef.current?.focus({ preventScroll: true });
                }}
                className={`items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] transition-all duration-200 mr-0.5 ${
                  hasContent || editingMessage
                    ? "flex scale-100 opacity-100 shadow-[0_4px_16px_rgba(0,0,0,0.25)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 cursor-pointer"
                    : "hidden sm:flex scale-95 opacity-30 cursor-default shadow-none"
                }`}
                title="Send message"
              >
                {isSending || isUploading ? (
                  <Loader size={16} className="animate-spin text-white dark:text-black" />
                ) : (
                  <span className="material-symbols-outlined text-[19px] text-white dark:text-[#0d0c11] font-bold">send</span>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Interactive Whiteboard / Drawing Modal (lazy chunk, mounts only when opened) */}
      {showDrawModal && (
        <Suspense fallback={null}>
          <DrawSketchModal
            isOpen={showDrawModal}
            onClose={() => setShowDrawModal(false)}
            onSendSketch={handleSendSketch}
          />
        </Suspense>
      )}

      {/* Syntax-Highlighted Code Snippet Composer Modal (lazy chunk, mounts only when opened) */}
      {showCodeModal && (
        <Suspense fallback={null}>
          <CodeSnippetModal
            isOpen={showCodeModal}
            onClose={() => setShowCodeModal(false)}
            onSendSnippet={handleSendCodeSnippet}
          />
        </Suspense>
      )}
    </div>
  );
};

export default MessageInput;
