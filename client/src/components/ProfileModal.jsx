import { useState, useRef } from "react";
import { X, Camera, Mail, Loader2, Check, User, Info, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";

// Clean, sleek monochromatic avatar presets
const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
];

const STATUS_PRESETS = [
  { emoji: "💻", title: "Coding", desc: "Building cool features" },
  { emoji: "🎧", title: "In the zone", desc: "Headphones on, focus" },
  { emoji: "☕", title: "Coffee break", desc: "Recharging & sipping" },
  { emoji: "🚀", title: "Shipping", desc: "Pushing to prod" },
  { emoji: "🌴", title: "AFK / Away", desc: "Stepped away briefly" },
  { emoji: "⚡", title: "Quick replies", desc: "Rapid response open" },
  { emoji: "🥪", title: "Lunch break", desc: "Grabbing some food" },
  { emoji: "😴", title: "Do Not Disturb", desc: "Notifications muted" },
];

const parseStatus = (raw) => {
  if (!raw) return { emoji: "💻", title: "Coding", detail: "Available" };
  if (raw.includes(":")) {
    const parts = raw.split(":");
    const prefix = parts[0].trim();
    const detail = parts.slice(1).join(":").trim();
    const emojiMatch = prefix.match(/\p{Extended_Pictographic}/u);
    if (emojiMatch) {
      return {
        emoji: emojiMatch[0],
        title: prefix.replace(emojiMatch[0], "").trim() || "Status",
        detail: detail || "Available",
      };
    }
    return { emoji: "⚡", title: prefix || "Status", detail: detail || "Available" };
  }
  const emojiMatch = raw.match(/\p{Extended_Pictographic}/u);
  if (emojiMatch) {
    return {
      emoji: emojiMatch[0],
      title: "Status",
      detail: raw.replace(emojiMatch[0], "").trim() || "Available",
    };
  }
  return { emoji: "⚡", title: "Status", detail: raw || "Available" };
};

const cleanInitialAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=27272a&color=ffffff&bold=true&size=150`;

const ProfileModal = ({ onClose }) => {
  const { authUser, updateProfile } = useAuthStore();
  const [username, setUsername] = useState(authUser?.username || "");
  const [bio, setBio] = useState(authUser?.bio || "Hey there! I am using Pulse.");
  
  const initialStatus = parseStatus(authUser?.status);
  const [statusEmoji, setStatusEmoji] = useState(initialStatus.emoji);
  const [statusTitle, setStatusTitle] = useState(initialStatus.title);
  const [statusDetail, setStatusDetail] = useState(initialStatus.detail);
  
  // Clean initial photo if it contains the old distressed avatar
  const initialPic = authUser?.profilePic?.includes("avataaars")
    ? cleanInitialAvatar(authUser?.username)
    : authUser?.profilePic || cleanInitialAvatar(authUser?.username);

  const [avatarPreview, setAvatarPreview] = useState(initialPic);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const selectPresetAvatar = (url) => {
    setSelectedFile(null);
    setAvatarPreview(url);
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
      console.error("Upload avatar failed", error);
      return null;
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSaving(true);

    try {
      let finalPicUrl = avatarPreview;

      if (selectedFile) {
        const uploadedUrl = await uploadToCloudinary(selectedFile);
        if (uploadedUrl) {
          finalPicUrl = uploadedUrl;
        }
      }

      const fullStatus = `${statusEmoji} ${statusTitle}: ${statusDetail.trim() || "Available"}`;

      const res = await updateProfile({
        username: username.trim(),
        bio: bio.trim(),
        status: fullStatus,
        profilePic: finalPicUrl,
      });

      if (res?.success) {
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 800);
      } else {
        setErrorMessage(res?.message || "Failed to update profile");
      }
    } catch {
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--modal-backdrop)] backdrop-blur-md sm:p-4 animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-3xl rounded-t-3xl sm:rounded-3xl rounded-b-none sm:rounded-b-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] border border-[var(--glass-border)] text-theme-main animate-scaleIn"
      >
        {/* Profile Header */}
        <div className="border-b border-[var(--glass-divider)] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between bg-[var(--glass-header)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-accent-primary/15 text-accent-primary flex items-center justify-center font-bold shadow-sm shrink-0">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-theme-main tracking-tight leading-tight">Profile & Identity</h3>
              <p className="text-[11px] text-theme-muted truncate">Your profile presence and details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] p-2 rounded-xl transition-colors shrink-0"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Content */}
        <form id="profile-form" onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium animate-fadeIn">
              {errorMessage}
            </div>
          )}

          {/* Avatar Upload with Camera Badge */}
          <div className="flex flex-col items-center justify-center pt-1 pb-2">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload profile photo"
            >
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-accent-primary to-accent-secondary shadow-xl">
                <img
                  src={avatarPreview}
                  alt="Profile Avatar"
                  className="w-full h-full rounded-full object-cover border-2 border-[rgb(var(--bg-app-rgb))]"
                />
              </div>
              
              {/* Camera Hover Overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                <Camera size={22} />
                <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-white">Change</span>
              </div>

              {/* Floating Camera Badge */}
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] flex items-center justify-center shadow-lg border-2 border-[rgb(var(--bg-app-rgb))] group-hover:scale-110 transition-transform">
                <Camera size={13} strokeWidth={2.5} />
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              className="hidden"
            />

            {/* Quick Avatar Presets */}
            <div className="flex items-center gap-2 mt-3.5">
              <span className="text-[10px] text-theme-muted font-medium">Presets:</span>
              {AVATAR_PRESETS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectPresetAvatar(url)}
                  className={`w-6 h-6 rounded-full overflow-hidden border transition-all ${
                    avatarPreview === url
                      ? "ring-2 ring-accent-primary border-transparent scale-110"
                      : "border-[var(--glass-border)] opacity-70 hover:opacity-100 hover:scale-105"
                  }`}
                  title={`Preset ${idx + 1}`}
                >
                  <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => selectPresetAvatar(cleanInitialAvatar(username))}
                className="px-2 py-0.5 rounded-full bg-[var(--glass-hover)] hover:bg-[var(--glass-active)] text-[10px] text-theme-muted hover:text-theme-main font-mono transition-colors"
                title="Use Initials"
              >
                Initials
              </button>
            </div>
          </div>

          {/* Display Name Field */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
              Display Name
            </label>
            <div className="relative flex items-center bg-[var(--glass-input)] border border-[var(--glass-border)] hover:border-accent-primary/40 focus-within:border-accent-primary rounded-2xl transition-all shadow-inner">
              <span className="pl-3.5 text-theme-muted">
                <User size={15} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={30}
                className="w-full bg-transparent px-3 py-2.5 text-xs text-theme-main placeholder:text-theme-muted focus:outline-none font-medium"
                placeholder="Your Name"
              />
            </div>
            <p className="text-[10px] text-theme-muted pl-1">
              This name will be visible to your contacts.
            </p>
          </div>

          {/* About / Bio Field */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
              About / Bio
            </label>
            <div className="relative flex items-center bg-[var(--glass-input)] border border-[var(--glass-border)] hover:border-accent-primary/40 focus-within:border-accent-primary rounded-2xl transition-all shadow-inner">
              <span className="pl-3.5 text-theme-muted">
                <Info size={15} />
              </span>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                className="w-full bg-transparent px-3 py-2.5 text-xs text-theme-main placeholder:text-theme-muted focus:outline-none"
                placeholder="Hey there! I am using Pulse."
              />
            </div>
          </div>

          {/* Presence Status Section (Migrated from Sidebar header into Profile section) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
                Presence Status & Mood
              </label>
              <span className="text-[10px] text-theme-muted">Visible to contacts</span>
            </div>

            {/* Live Presence Status Pill (Matches exact aesthetic from user's request) */}
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-[var(--glass-input)] border border-[var(--glass-border)] shadow-sm transition-all group">
              <div className="flex items-center gap-2 truncate">
                <span className="text-base shrink-0">{statusEmoji}</span>
                <div className="truncate">
                  <span className="text-xs font-semibold text-theme-main mr-1.5">{statusTitle}:</span>
                  <span className="text-xs text-theme-muted">{statusDetail}</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-xs text-theme-muted shrink-0 ml-2">
                edit
              </span>
            </div>

            {/* Quick Mood Presets */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[10px] text-theme-muted font-medium">Quick Moods:</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_PRESETS.map((preset, idx) => {
                  const isActive = statusEmoji === preset.emoji && statusTitle === preset.title;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setStatusEmoji(preset.emoji);
                        setStatusTitle(preset.title);
                        setStatusDetail(preset.desc);
                      }}
                      title={preset.desc}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs transition-all active:scale-95 ${
                        isActive
                          ? "bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] border border-[var(--pill-active-border)] font-semibold shadow-sm scale-[1.02]"
                          : "bg-[var(--glass-hover)] hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main border border-[var(--glass-border)]"
                      }`}
                    >
                      <span>{preset.emoji}</span>
                      <span>{preset.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Status Inputs */}
            <div className="flex items-center gap-2 pt-1">
              <div className="w-12 relative flex items-center justify-center bg-[var(--glass-input)] border border-[var(--glass-border)] focus-within:border-accent-primary rounded-2xl py-2 shrink-0 transition-colors" title="Emoji">
                <input
                  type="text"
                  value={statusEmoji}
                  onChange={(e) => setStatusEmoji(e.target.value)}
                  className="w-full text-center bg-transparent text-sm text-theme-main focus:outline-none"
                  maxLength={4}
                  title="Emoji"
                />
              </div>
              <div className="w-28 relative flex items-center bg-[var(--glass-input)] border border-[var(--glass-border)] focus-within:border-accent-primary rounded-2xl shrink-0 transition-colors">
                <input
                  type="text"
                  value={statusTitle}
                  onChange={(e) => setStatusTitle(e.target.value)}
                  placeholder="Category"
                  maxLength={30}
                  className="w-full bg-transparent px-3 py-2 text-xs text-theme-main placeholder:text-theme-muted focus:outline-none font-semibold"
                />
              </div>
              <div className="flex-1 relative flex items-center bg-[var(--glass-input)] border border-[var(--glass-border)] focus-within:border-accent-primary rounded-2xl transition-colors">
                <input
                  type="text"
                  value={statusDetail}
                  onChange={(e) => setStatusDetail(e.target.value)}
                  placeholder="Status message or detail..."
                  maxLength={140}
                  className="w-full bg-transparent px-3 py-2 text-xs text-theme-main placeholder:text-theme-muted focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Email (Read only) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider block">
              Registered Email
            </label>
            <div className="flex items-center bg-[var(--glass-panel)] border border-[var(--glass-border)] rounded-2xl px-3.5 py-2.5 text-xs text-theme-muted">
              <Mail size={14} className="mr-2 text-theme-muted shrink-0" />
              <span className="truncate font-mono text-[11px]">{authUser?.email || "user@example.com"}</span>
            </div>
          </div>
        </form>

        {/* Footer Action Buttons (fixed card footer — never overlaps content) */}
        <div className="px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[var(--glass-divider)] flex justify-end items-center gap-2.5 bg-[var(--glass-header)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-form"
            disabled={isSaving || savedSuccess}
            className="px-6 py-2.5 rounded-full text-xs font-bold bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] hover:opacity-90 active:scale-95 shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check size={14} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
