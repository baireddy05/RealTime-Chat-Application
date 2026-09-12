import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { 
  Send, 
  X, 
  Loader, 
  Smile, 
  Mic, 
  Trash2, 
  Check, 
  Paperclip, 
  Image as ImageIcon, 
  Camera, 
  FileText, 
  User,
  Reply,
  Edit3,
  File,
  Clock,
  Flame,
  Timer,
  Calendar,
  Lock,
  Unlock,
  Bot,
  Sparkles,
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import ImageModal from "./ImageModal";

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [scheduledFor, setScheduledFor] = useState(null);
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

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
  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const mentionMenuRef = useRef(null);

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
    isE2eeEnabled,
    toggleE2ee,
  } = useChatStore();
  const { authUser, socket } = useAuthStore();

  // Populate text when editing a message
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
      setReplyingTo(null);
    }
  }, [editingMessage, setReplyingTo]);

  // Close popup menus and reset attachments when switching chats
  useEffect(() => {
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setImagePreview(null);
    setDocumentFile(null);
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
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }

      if (
        showMentionMenu &&
        mentionMenuRef.current &&
        !mentionMenuRef.current.contains(e.target)
      ) {
        setShowMentionMenu(false);
      }
    };

    if (showAttachMenu || showEmojiPicker || showMentionMenu) {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [showAttachMenu, showEmojiPicker, showMentionMenu]);

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
    setText(val);

    const mentionMatch = val.match(/@([a-zA-Z0-9_]*)$/);
    if (mentionMatch) {
      setShowMentionMenu(true);
      setMentionFilter(mentionMatch[1].toLowerCase());
    } else {
      setShowMentionMenu(false);
    }

    if (!socket || !selectedChat) return;

    socket.emit("typing", {
      targetId: selectedChat.id,
      targetType: selectedChat.type,
      username: authUser.username,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        targetId: selectedChat.id,
        targetType: selectedChat.type,
        username: authUser?.username,
      });
    }, 2000);
  };

  const insertMention = (mentionText) => {
    setText((prev) => {
      if (/@([a-zA-Z0-9_]*)$/.test(prev)) {
        return prev.replace(/@([a-zA-Z0-9_]*)$/, `${mentionText} `);
      }
      return prev ? `${prev} ${mentionText} ` : `${mentionText} `;
    });
    setShowMentionMenu(false);
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
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
            await sendMessage({
              text: "",
              audio: audioUrl,
            });
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

    if (imagePreview) {
      setIsUploading(true);
      imageUrl = await uploadToCloudinary(imagePreview.file);
      setIsUploading(false);
    }

    if (documentFile) {
      setIsUploading(true);
      const url = await uploadRawFile(documentFile);
      setIsUploading(false);
      filePayload = {
        url,
        name: documentFile.name,
        size: documentFile.size,
        fileType: documentFile.type,
      };
    }

    await sendMessage({
      text: text.trim(),
      image: imageUrl,
      file: filePayload,
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
    });

    setText("");
    removeImage();
    removeDocument();
    setShowEmojiPicker(false);
    setReplyingTo(null);
    setScheduledFor(null);
  };

  const hasContent = text.trim().length > 0 || imagePreview || documentFile;

  return (
    <div className="bg-[var(--glass-surface)] backdrop-blur-2xl border-t border-[var(--glass-border)] px-3 md:px-5 py-2 md:py-2.5 relative select-none safe-bottom flex flex-col gap-2">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-[var(--glass-hover)] border-l-2 border-accent-primary border border-[var(--glass-border)] animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-full bg-accent-primary/20 text-accent-primary flex-shrink-0">
              <Reply size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-accent-primary truncate block">
                Replying to {replyingTo.senderId?.username || replyingTo.senderName || "User"}
              </span>
              <p className="text-xs text-theme-muted truncate">
                {replyingTo.text || (replyingTo.image ? "Photo" : replyingTo.file ? replyingTo.file.name : "Attachment")}
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
              <p className="text-xs text-theme-muted truncate">{editingMessage.text}</p>
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

      {/* Full Emoji Picker Popover */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          id="emoji-picker-popover"
          className="absolute bottom-14 left-2 sm:left-4 z-50 rounded-3xl shadow-glass animate-scaleIn overflow-hidden border border-[var(--glass-border)] backdrop-blur-2xl bg-[var(--glass-heavy)] max-w-[calc(100vw-16px)]"
          style={{ width: "350px" }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-header)]">
            <div className="flex items-center gap-2">
              <Smile size={16} className="text-accent-primary" />
              <span className="text-xs font-semibold text-theme-main tracking-tight">All Emojis</span>
            </div>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              className="text-theme-muted hover:text-theme-main p-1 rounded-full hover:bg-[var(--glass-hover)] transition-colors"
              title="Close emoji picker"
            >
              <X size={14} />
            </button>
          </div>

          {/* Quick reactions strip */}
          <div className="px-2.5 py-1.5 border-b border-[var(--glass-border)] flex items-center gap-1 overflow-x-auto no-scrollbar bg-[var(--glass-surface)]">
            <span className="text-[10px] uppercase font-medium text-theme-muted px-1">Quick:</span>
            {COMMON_EMOJIS.slice(0, 10).map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEmojiSelect(emoji)}
                className="hover:scale-125 active:scale-95 transition-transform p-1 rounded-lg hover:bg-[var(--glass-hover)] text-base flex-shrink-0 flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="emoji-picker-container">
            <EmojiPicker
              theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
              onEmojiClick={(emojiData) => handleEmojiSelect(emojiData.emoji)}
              autoFocusSearch={false}
              searchPlaceHolder="Search all emojis..."
              width="100%"
              height={380}
              lazyLoadEmojis={true}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled={false}
            />
          </div>
        </div>
      )}

      {/* Attachment Menu Popover */}
      {showAttachMenu && (
        <div
          ref={attachMenuRef}
          id="attach-menu-popover"
          className="absolute bottom-14 left-4 sm:left-12 md:left-14 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-1.5 shadow-glass w-52 max-w-[calc(100vw-32px)] animate-scaleIn space-y-0.5"
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
              setText((prev) => (prev ? `${prev} 👤 Contact: ${authUser?.username}` : `👤 Contact: ${authUser?.username}`));
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <User size={14} />
            </div>
            <span>Share Contact</span>
          </button>
        </div>
      )}

      {/* Disappearing Timer Menu Popover */}
      {showTimerMenu && (
        <div className="absolute bottom-14 right-16 sm:right-24 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-2 shadow-glass w-48 animate-scaleIn space-y-1 text-theme-main text-xs">
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
        <div className="absolute bottom-14 right-8 sm:right-16 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-3 shadow-glass w-64 animate-scaleIn space-y-2 text-theme-main text-xs">
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

      {/* @pulse Mention Autocomplete Popover */}
      {showMentionMenu && (
        <div
          ref={mentionMenuRef}
          className="absolute bottom-16 left-4 sm:left-14 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-2 shadow-glass w-72 max-w-[calc(100vw-32px)] animate-scaleIn space-y-1.5 text-xs text-theme-main"
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-theme-muted uppercase tracking-wider flex items-center justify-between border-b border-[var(--glass-border)]">
            <span className="flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-400" />
              Pulse AI Mention
            </span>
            <span className="text-[9px] text-emerald-400 font-semibold">Assistant</span>
          </div>

          <button
            type="button"
            onClick={() => insertMention("@pulse")}
            className="w-full text-left p-2 rounded-xl hover:bg-[var(--glass-hover)] transition-colors flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/25 to-teal-500/25 text-emerald-400 border border-emerald-500/35 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Bot size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-emerald-400 text-xs">@pulse</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  AI Companion
                </span>
              </div>
              <p className="text-[10px] text-theme-muted truncate">
                Ask questions, summarize chat, translate languages
              </p>
            </div>
          </button>

          <div className="pt-1.5 border-t border-[var(--glass-border)] px-1">
            <span className="text-[9px] text-theme-muted font-medium block mb-1">
              Quick commands:
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "Summarize", text: "@pulse summarize" },
                { label: "Translate", text: "@pulse translate to Spanish: " },
                { label: "Explain", text: "@pulse explain " },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => insertMention(item.text)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)] hover:border-emerald-500/30 transition-colors font-medium cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick AI & Security Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => insertMention("@pulse")}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <Sparkles size={11} />
            <span>Ask @pulse</span>
          </button>
        </div>

        {isE2eeEnabled && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 animate-fadeIn">
            <Lock size={10} />
            <span>End-to-End Encrypted</span>
          </div>
        )}
      </div>

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
        <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
          {/* Emoji Trigger */}
          <button
            ref={emojiBtnRef}
            type="button"
            onClick={() => {
              setShowEmojiPicker((prev) => !prev);
              setShowAttachMenu(false);
            }}
            className={`p-2 rounded-full transition-all duration-150 active:scale-90 flex-shrink-0 ${
              showEmojiPicker ? "text-accent-primary bg-accent-primary/20" : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
            }`}
            title="Emojis"
          >
            <Smile size={19} />
          </button>

          {/* Attachment Trigger */}
          <button
            ref={attachBtnRef}
            id="attach-button"
            type="button"
            onClick={() => {
              setShowAttachMenu((prev) => !prev);
              setShowEmojiPicker(false);
            }}
            className={`p-2 rounded-full transition-all duration-150 active:scale-90 flex-shrink-0 ${
              showAttachMenu ? "text-accent-primary bg-accent-primary/20" : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
            }`}
            title="Attach"
          >
            <Paperclip size={19} className="rotate-45" />
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

          {/* Main Message Input Capsule */}
          <div className="flex-1 relative flex items-center min-w-0">
            <input
              type="text"
              className="w-full glass-input text-theme-main rounded-full pl-4 pr-24 py-2 border border-[var(--glass-border)] shadow-inner focus:outline-none focus:border-accent-primary/70 text-sm placeholder-theme-muted/50 transition-all duration-150"
              placeholder={
                scheduledFor
                  ? "Schedule a message..."
                  : isE2eeEnabled
                  ? "🔒 End-to-End Encrypted message..."
                  : disappearingTimer
                  ? `Ephemeral message (${disappearingTimer}s)...`
                  : editingMessage
                  ? "Edit message..."
                  : "Message"
              }
              value={text}
              onChange={handleTextChange}
            />

            {/* In-capsule controls: E2EE Toggle, Disappearing Timer & Schedule Button */}
            <div className="absolute right-2 flex items-center gap-0.5">
              {/* E2EE Toggle Button */}
              <button
                type="button"
                onClick={toggleE2ee}
                className={`p-1.5 rounded-full transition-all duration-200 flex items-center gap-0.5 ${
                  isE2eeEnabled
                    ? "text-emerald-400 bg-emerald-500/20 shadow-sm border border-emerald-500/35"
                    : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
                }`}
                title={
                  isE2eeEnabled
                    ? "End-to-End Encryption Enabled (AES-GCM 256-bit)"
                    : "Enable End-to-End Encryption"
                }
              >
                {isE2eeEnabled ? <Lock size={14} className="text-emerald-400" /> : <Unlock size={14} />}
              </button>

              {/* Timer button */}
              <button
                type="button"
                onClick={() => {
                  setShowTimerMenu((prev) => !prev);
                  setShowScheduleMenu(false);
                }}
                className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${
                  disappearingTimer
                    ? "text-orange-400 bg-orange-500/20 font-bold"
                    : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
                }`}
                title={disappearingTimer ? `Disappearing timer: ${disappearingTimer}s` : "Set Disappearing Message Timer"}
              >
                <Flame size={14} className={disappearingTimer ? "animate-pulse" : ""} />
                {disappearingTimer && (
                  <span className="text-[10px] pr-0.5">{disappearingTimer < 60 ? `${disappearingTimer}s` : `${Math.floor(disappearingTimer / 60)}m`}</span>
                )}
              </button>

              {/* Schedule button */}
              <button
                type="button"
                onClick={() => {
                  setShowScheduleMenu((prev) => !prev);
                  setShowTimerMenu(false);
                }}
                className={`p-1.5 rounded-full transition-colors ${
                  scheduledFor
                    ? "text-accent-primary bg-accent-primary/20"
                    : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
                }`}
                title="Schedule Message"
              >
                <Clock size={14} />
              </button>
            </div>
          </div>

          {/* Send / Mic / Save Button */}
          {editingMessage ? (
            <button
              type="submit"
              disabled={isSending || !text.trim()}
              className="p-2 rounded-full bg-accent-primary hover:bg-accent-primary/80 text-white flex items-center justify-center transition-all duration-150 shadow-md shadow-accent-primary/25 flex-shrink-0 active:scale-90 disabled:opacity-40"
              title="Save edit"
            >
              <Check size={16} />
            </button>
          ) : hasContent ? (
            <button
              type="submit"
              disabled={isSending || isUploading}
              className="p-2 rounded-full bg-accent-primary hover:bg-accent-primary/80 text-white flex items-center justify-center transition-all duration-150 shadow-md shadow-accent-primary/30 flex-shrink-0 active:scale-90 disabled:opacity-40"
              title="Send"
            >
              {isSending || isUploading ? (
                <Loader size={16} className="animate-spin text-white" />
              ) : (
                <Send size={15} className="ml-0.5 text-white" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-2 rounded-full text-theme-muted hover:text-accent-primary hover:bg-[var(--glass-hover)] flex items-center justify-center transition-all duration-150 flex-shrink-0 active:scale-90"
              title="Record voice memo"
            >
              <Mic size={19} />
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default MessageInput;
