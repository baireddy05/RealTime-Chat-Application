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
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import ImageModal from "./ImageModal";
const GifPicker = lazy(() => import("./GifPicker"));
const EmojiPicker = lazy(() => import("emoji-picker-react"));
import ContactModal from "./ContactModal";
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
  const [scheduledFor, setScheduledFor] = useState(null);
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTypingPulse, setIsTypingPulse] = useState(false);
  const pulseTimeoutRef = useRef(null);

  // Mobile Back Navigation handlers for input popups and previews
  useBackHandler(showMediaPicker, () => setShowMediaPicker(false), "input-media-picker");
  useBackHandler(showAttachMenu, () => setShowAttachMenu(false), "input-attach-menu");
  useBackHandler(showTimerMenu, () => setShowTimerMenu(false), "input-timer-menu");
  useBackHandler(showScheduleMenu, () => setShowScheduleMenu(false), "input-schedule-menu");
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
  } = useChatStore();
  const { authUser, socket } = useAuthStore();

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

  // Close popup menus and reset attachments when switching chats
  useEffect(() => {
    queueMicrotask(() => {
      setShowAttachMenu(false);
      setShowMediaPicker(false);
      setImagePreview(null);
      setDocumentFile(null);
    });
  }, [selectedChat?.id]);

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

      socket.emit("typing", {
        targetId: selectedChat.id,
        targetType: selectedChat.type,
        username: authUser?.username || "User",
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try {
          socket.emit("stopTyping", {
            targetId: selectedChat.id,
            targetType: selectedChat.type,
            username: authUser?.username || "User",
          });
        } catch {}
      }, 2000);
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

  const uploadRawFile = async (fileObj) => {
    try {
      const { data } = await axiosInstance.get("/upload/signature");
      const formData = new FormData();
      formData.append("file", fileObj.file);
      formData.append("api_key", data.apiKey);
      formData.append("timestamp", data.timestamp);
      formData.append("signature", data.signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await res.json();
      if (uploadData.secure_url) {
        return uploadData.secure_url;
      }
      return fileObj.dataUrl;
    } catch {
      // Fallback to dataUrl
      return fileObj.dataUrl;
    }
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

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0) {
          setIsUploading(true);
          const audioUrl = await uploadAudioToCloudinary(audioBlob);
          setIsUploading(false);

          if (audioUrl) {
            window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
            await sendMessage({
              text: "",
              audio: audioUrl,
            });
            window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
          }
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        audioChunksRef.current = [];
        setIsRecording(false);
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

  const handleSendMessage = async (e) => {
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

    if (!text.trim() && !imagePreview && !documentFile) return;

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
    const currentText = text.trim();
    const currentImage = imagePreview;
    const currentDoc = documentFile;
    const currentSchedule = scheduledFor;
    const currentReply = replyingTo;

    if (sendBtnRef.current) {
      emitPulseShockwave(sendBtnRef.current);
    } else if (inputRef.current) {
      emitPulseShockwave(inputRef.current);
    }
    
    setText("");
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    removeImage();
    removeDocument();
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
      imageUrl = await uploadToCloudinary(currentImage.file);
      setIsUploading(false);
    }

    if (currentDoc) {
      setIsUploading(true);
      const url = await uploadRawFile(currentDoc);
      setIsUploading(false);
      filePayload = {
        url,
        name: currentDoc.name,
        size: currentDoc.size,
        fileType: currentDoc.type,
      };
    }

    window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
    await sendMessage({
      text: currentText,
      image: imageUrl,
      file: filePayload,
      scheduledFor: currentSchedule ? new Date(currentSchedule).toISOString() : undefined,
      replyTo: currentReply ? {
        messageId: currentReply._id,
        senderName: currentReply.senderId?.username || currentReply.senderName || "User",
        text: currentReply.decryptedText || currentReply.text || (currentReply.image ? "📷 Photo" : currentReply.file ? `📎 ${currentReply.file.name}` : "Attachment"),
        image: currentReply.image || null,
        file: currentReply.file || null,
      } : undefined,
    });
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
          <span className="text-xs text-theme-muted pr-2">Photo attached</span>
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
        <ContactModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          onSendContact={async (contact) => {
            window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
            await sendMessage({ contact, text: "" });
            window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
          }}
        />
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
    </div>
  );
};

export default MessageInput;
