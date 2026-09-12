import { useState, useRef } from "react";
import { X, Camera, Mail, Activity, Loader2, Check } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";

const ProfileModal = ({ onClose }) => {
  const { authUser, updateProfile } = useAuthStore();
  const [username, setUsername] = useState(authUser?.username || "");
  const [bio, setBio] = useState(authUser?.bio || "Available");
  const [status, setStatus] = useState(authUser?.status || "Available");
  const profilePic = authUser?.profilePic || "";
  const [avatarPreview, setAvatarPreview] = useState(null);
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
      let finalPicUrl = profilePic;

      if (selectedFile) {
        const uploadedUrl = await uploadToCloudinary(selectedFile);
        if (uploadedUrl) {
          finalPicUrl = uploadedUrl;
        }
      }

      const res = await updateProfile({
        username: username.trim(),
        bio: bio.trim(),
        status: status.trim(),
        profilePic: finalPicUrl,
      });

      if (res?.success) {
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 900);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--modal-backdrop)] backdrop-blur-xl p-4 animate-fadeIn">
      <div className="bg-[var(--glass-heavy)] backdrop-blur-2xl rounded-3xl w-full max-w-md shadow-glass overflow-hidden flex flex-col max-h-[90vh] border border-[var(--glass-border)] text-theme-main">
        {/* Profile Header */}
        <div className="border-b border-[var(--glass-border)] px-6 py-4 flex items-center justify-between bg-[var(--glass-hover)]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-status-online" />
            <h3 className="font-semibold text-base text-theme-main tracking-tight">Profile & Identity</h3>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] p-1.5 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Avatar Upload with Camera Overlay */}
          <div className="flex flex-col items-center justify-center pt-1 pb-2">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title="Change profile photo"
            >
              <img
                src={avatarPreview || profilePic || `https://ui-avatars.com/api/?name=${authUser?.username}&background=2563eb&color=ffffff`}
                alt="Profile Avatar"
                className="w-24 h-24 rounded-full object-cover ring-2 ring-[var(--glass-border)] group-hover:ring-accent-primary shadow-glass transition-all"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                <Camera size={20} />
                <span className="text-[10px] uppercase font-medium tracking-wider mt-1 text-white">Edit</span>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Username */}
          <div className="bg-[var(--glass-surface)] p-3 rounded-2xl border border-[var(--glass-border)] focus-within:border-accent-primary transition-all">
            <label className="text-[11px] font-medium text-theme-muted uppercase tracking-wider block mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-transparent text-sm text-theme-main focus:outline-none placeholder-theme-muted/40"
            />
          </div>

          {/* About / Bio */}
          <div className="bg-[var(--glass-surface)] p-3 rounded-2xl border border-[var(--glass-border)] focus-within:border-accent-primary transition-all">
            <label className="text-[11px] font-medium text-theme-muted uppercase tracking-wider block mb-1">
              About / Bio
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-transparent text-sm text-theme-main focus:outline-none placeholder-theme-muted/40"
            />
          </div>

          {/* Current Status Activity */}
          <div className="bg-[var(--glass-surface)] p-3 rounded-2xl border border-[var(--glass-border)] focus-within:border-accent-primary transition-all">
            <label className="text-[11px] font-medium text-theme-muted uppercase tracking-wider block mb-1">
              Focus / Status
            </label>
            <div className="relative flex items-center">
              <Activity size={14} className="text-status-online mr-2" />
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Available, Focus, Coding..."
                className="w-full bg-transparent text-sm text-theme-main focus:outline-none placeholder-theme-muted/40"
              />
            </div>
          </div>

          {/* Email (Read only) */}
          <div className="bg-[var(--glass-surface)]/60 p-3 rounded-2xl border border-[var(--glass-border)]">
            <label className="text-[11px] font-medium text-theme-muted/60 uppercase tracking-wider block mb-1">
              Registered Email
            </label>
            <div className="flex items-center text-xs text-theme-muted">
              <Mail size={13} className="mr-2 text-theme-muted/60" />
              <span>{authUser?.email}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--glass-hover)] hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main text-xs font-medium border border-[var(--glass-border)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || savedSuccess}
              className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-md shadow-accent-primary/25"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check size={14} className="text-white" />
                  <span>Saved</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
