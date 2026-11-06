import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Send, ChevronRight, ChevronLeft, Trash2, Image as ImageIcon, Video, MessageCircle, Eye, Loader } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { axiosInstance } from "../lib/axios";

const STATUS_BG_COLORS = [
  "bg-gradient-to-tr from-sky-500 to-indigo-600",
  "bg-gradient-to-tr from-violet-500 to-fuchsia-600",
  "bg-gradient-to-tr from-emerald-400 to-teal-600",
  "bg-gradient-to-tr from-amber-400 to-orange-500",
  "bg-gradient-to-tr from-cyan-500 to-blue-600",
];

const StatusModal = ({ onClose, initialViewer = null }) => {
  const { authUser } = useAuthStore();
  const { networkStatuses: networkPersons, myStatuses: myStories, uploadStatus, deleteStatus, getStatuses, viewStatus, getStatusViewers, setSelectedChat } = useChatStore();

  useEffect(() => {
    getStatuses();
  }, [getStatuses]);

  const [activeViewer, setActiveViewer] = useState(initialViewer);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const [newStatusText, setNewStatusText] = useState("");
  const [selectedBg, setSelectedBg] = useState(STATUS_BG_COLORS[0]);

  // If opened directly to view a story, closing or finishing the story closes the modal
  useEffect(() => {
    if (!activeViewer || !activeStory) {
      onClose();
    }
  }, [activeViewer, activeStory, onClose]);

  if (!activeViewer || !activePerson || !activeStory) {
    return null;
  }

  // Photo/video status composer state
  const [mediaFile, setMediaFile] = useState(null); // { file, preview, type: 'image'|'video' }
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const mediaInputRef = useRef(null);
  const [mediaPickerType, setMediaPickerType] = useState("image");

  // Object URLs must be revoked or every picked photo leaks blob memory.
  // All preview resets go through here (remove, replace, posted, unmount).
  const mediaFileRef = useRef(null);
  const clearMediaFile = () => {
    try {
      if (mediaFileRef.current?.preview) URL.revokeObjectURL(mediaFileRef.current.preview);
    } catch {}
    mediaFileRef.current = null;
    setMediaFile(null);
  };
  useEffect(() => {
    return () => {
      try {
        if (mediaFileRef.current?.preview) URL.revokeObjectURL(mediaFileRef.current.preview);
      } catch {}
    };
  }, []);

  // Viewers panel state (own stories)
  const [showViewers, setShowViewers] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const activePerson = activeViewer
    ? activeViewer.type === "my"
      ? {
          id: "my-status",
          user: authUser?.username || "You",
          avatar:
            authUser?.profilePic ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=2563eb&color=ffffff`,
          stories: Array.isArray(myStories) ? myStories : [],
        }
      : networkPersons[activeViewer.personIndex] || null
    : null;

  const personStories = Array.isArray(activePerson?.stories) ? activePerson.stories : [];
  const activeStory = personStories[activeViewer?.storyIndex] || null;

  const goToNextStory = useCallback(() => {
    if (!activeViewer) return;

    const currentStories =
      activeViewer.type === "my"
        ? (Array.isArray(myStories) ? myStories : [])
        : networkPersons[activeViewer.personIndex]?.stories || [];

    if (activeViewer.storyIndex < currentStories.length - 1) {
      setActiveViewer((curr) => ({
        ...curr,
        storyIndex: curr.storyIndex + 1,
      }));
      setStoryProgress(0);
    } else {
      if (activeViewer.type === "my") {
        if (networkPersons.length > 0) {
          const firstWithStories = networkPersons.findIndex(
            (p) => Array.isArray(p?.stories) && p.stories.length > 0
          );
          if (firstWithStories === -1) {
            setActiveViewer(null);
          } else {
            setActiveViewer({
              type: "network",
              personIndex: firstWithStories,
              storyIndex: 0,
            });
          }
          setStoryProgress(0);
        } else {
          setActiveViewer(null);
          setStoryProgress(0);
        }
      } else {
        // Skip persons whose stories emptied (deleted while viewing).
        let next = activeViewer.personIndex + 1;
        while (next < networkPersons.length && !(networkPersons[next]?.stories || []).length) {
          next++;
        }
        if (next < networkPersons.length) {
          setActiveViewer({
            type: "network",
            personIndex: next,
            storyIndex: 0,
          });
          setStoryProgress(0);
        } else {
          setActiveViewer(null);
          setStoryProgress(0);
        }
      }
    }
  }, [activeViewer, myStories, networkPersons]);

  const goToPrevStory = useCallback(() => {
    if (!activeViewer) return;

    if (activeViewer.storyIndex > 0) {
      setActiveViewer((curr) => ({
        ...curr,
        storyIndex: curr.storyIndex - 1,
      }));
      setStoryProgress(0);
    } else {
      if (activeViewer.type === "network") {
        if (activeViewer.personIndex > 0) {
          const prevPersonIndex = activeViewer.personIndex - 1;
          const prevPersonStories = networkPersons[prevPersonIndex]?.stories || [];
          if (prevPersonStories.length === 0) return;
          setActiveViewer({
            type: "network",
            personIndex: prevPersonIndex,
            storyIndex: prevPersonStories.length - 1,
          });
          setStoryProgress(0);
        } else if ((myStories || []).length > 0) {
          setActiveViewer({
            type: "my",
            personIndex: 0,
            storyIndex: myStories.length - 1,
          });
          setStoryProgress(0);
        }
      }
    }
  }, [activeViewer, myStories, networkPersons]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (activeViewer) {
          setActiveViewer(null);
          setStoryProgress(0);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowRight" && activeViewer) {
        goToNextStory();
      } else if (e.key === "ArrowLeft" && activeViewer) {
        goToPrevStory();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeViewer, onClose, goToNextStory, goToPrevStory]);

  useEffect(() => {
    // Paused while the viewers panel is open, so the story doesn't advance
    // underneath the "Viewed by" list.
    if (!activeViewer || !activeStory || isPaused || showViewers) return;

    if (activeViewer.type === "network" && activeStory.id) {
      try {
        const viewed = JSON.parse(localStorage.getItem("viewedStories") || "[]");
        if (!viewed.includes(activeStory.id)) {
          viewed.push(activeStory.id);
          localStorage.setItem("viewedStories", JSON.stringify(viewed));
          window.dispatchEvent(new Event("pulse:story-viewed"));
        }
      } catch {}
      // Record the view server-side for the owner's viewers list
      viewStatus(activeStory.id);
    }

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          goToNextStory();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [activeViewer, activeStory, isPaused, showViewers, goToNextStory, viewStatus]);

  // Reset the viewers panel whenever the viewed story changes
  useEffect(() => {
    setShowViewers(false);
    setViewersList([]);
  }, [activeStory?.id]);

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    if (!newStatusText.trim() && !mediaFile) return;

    setIsCreatingStatus(true);
    try {
      let media = null;
      if (mediaFile) {
        setIsUploadingMedia(true);
        const mediaUrl = await uploadStatusMedia(mediaFile.file, mediaFile.type);
        setIsUploadingMedia(false);
        if (!mediaUrl) {
          setIsCreatingStatus(false);
          return;
        }
        media = { mediaUrl, mediaType: mediaFile.type };
      }
      await uploadStatus(newStatusText.trim(), selectedBg, media);
      setNewStatusText("");
      clearMediaFile();
    } catch (error) {
      console.error("Failed to upload status", error);
    } finally {
      setIsCreatingStatus(false);
      setIsUploadingMedia(false);
    }
  };

  const uploadStatusMedia = async (file, type) => {
    try {
      const { data } = await axiosInstance.get("/upload/signature");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", data.apiKey);
      formData.append("timestamp", data.timestamp);
      formData.append("signature", data.signature);
      const endpoint =
        type === "video"
          ? `https://api.cloudinary.com/v1_1/${data.cloudName}/video/upload`
          : `https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`;
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const uploadData = await res.json();
      return uploadData.secure_url || null;
    } catch (error) {
      console.error("Status media upload failed", error);
      return null;
    }
  };

  const handleMediaPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("video/") ? "video" : "image";
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Please select a photo or video file");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      alert("Status media must be under 30MB");
      return;
    }
    try {
      if (mediaFileRef.current?.preview) URL.revokeObjectURL(mediaFileRef.current.preview);
    } catch {}
    const next = { file, preview: URL.createObjectURL(file), type };
    mediaFileRef.current = next;
    setMediaFile(next);
    setIsCreatingStatus(true);
  };

  const handleReplyToStory = () => {
    if (activeViewer?.type !== "network" || !activePerson) return;
    setSelectedChat({
      id: activePerson.id,
      name: activePerson.user,
      type: "user",
      profilePic: activePerson.avatar,
    });
    onClose();
  };

  const toggleViewers = async () => {
    if (showViewers) {
      setShowViewers(false);
      return;
    }
    setShowViewers(true);
    setViewersLoading(true);
    const list = await getStatusViewers(activeStory?.id);
    setViewersList(list);
    setViewersLoading(false);
  };

  const handleDeleteMyStory = async (storyId, e) => {
    e?.stopPropagation();
    try {
      await deleteStatus(storyId);
      const updated = myStories.filter((s) => s.id !== storyId);
      if (updated.length === 0) {
        setActiveViewer(null);
        setStoryProgress(0);
      } else if (activeViewer?.storyIndex >= updated.length) {
        setActiveViewer((curr) => ({
          ...curr,
          storyIndex: updated.length - 1,
        }));
        setStoryProgress(0);
      }
    } catch (error) {
      console.error("Failed to delete status", error);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center animate-fadeIn p-4 max-md:p-0 select-none"
      onClick={onClose}
    >
      {/* Story Viewer Overlay */}
      {activeViewer && activePerson && activeStory ? (
        <div
          className="relative w-full max-w-sm h-[580px] max-h-[88vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-5 md:p-6 animate-scaleIn select-none max-md:max-w-none max-md:w-full max-md:h-full max-md:max-h-full max-md:rounded-none"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Background: photo/video fills the frame, else gradient */}
          {activeStory.mediaUrl ? (
            <>
              {activeStory.mediaType === "video" ? (
                <video
                  src={activeStory.mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <img
                  src={activeStory.mediaUrl}
                  alt="Status"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />
            </>
          ) : (
            <div className={`absolute inset-0 ${activeStory.bg} -z-10 transition-colors duration-500`} />
          )}

          {/* Progress Bars */}
          <div className="flex gap-1.5 w-full z-20">
            {activePerson.stories.map((s, idx) => (
              <div key={s.id} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-[width] duration-100 ease-linear"
                  style={{
                    width:
                      idx < activeViewer.storyIndex
                        ? "100%"
                        : idx === activeViewer.storyIndex
                        ? `${storyProgress}%`
                        : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top User Info & Actions */}
          <div className="flex items-center justify-between mt-3 text-white z-20">
            <div className="flex items-center gap-2.5">
              <img
                src={activePerson.avatar}
                alt={activePerson.user}
                className="w-9 h-9 rounded-full border border-white/40 object-cover shadow-md"
              />
              <div>
                <p className="font-semibold text-xs leading-tight text-white">{activePerson.user}</p>
                <p className="text-[10px] text-white/80">
                  {activeStory.time}
                  {activePerson.stories.length > 1 && (
                    <span className="ml-1 text-white/70">
                      • {activeViewer.storyIndex + 1}/{activePerson.stories.length}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {activeViewer.type === "my" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleViewers();
                  }}
                  className="p-1.5 rounded-full hover:bg-black/25 text-white/80 hover:text-white transition-colors flex items-center gap-1"
                  title="Seen by"
                >
                  <Eye size={15} />
                  {(activeStory.viewersCount ?? 0) > 0 && (
                    <span className="text-[10px] font-bold">{activeStory.viewersCount}</span>
                  )}
                </button>
              )}
              {activeViewer.type === "my" && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteMyStory(activeStory.id, e)}
                  className="p-1.5 rounded-full hover:bg-black/25 text-white/80 hover:text-red-300 transition-colors"
                  title="Delete this status update"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActiveViewer(null);
                  setStoryProgress(0);
                }}
                className="p-1.5 rounded-full hover:bg-black/25 text-white transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Story Text Content with click-to-navigate touch zones */}
          <div className="flex-1 relative flex items-center justify-center text-center px-4 z-10 my-4">
            <div
              className="absolute left-0 top-0 bottom-0 w-[30%] cursor-pointer z-10"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevStory();
              }}
              title="Previous"
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-[70%] cursor-pointer z-10"
              onClick={(e) => {
                e.stopPropagation();
                goToNextStory();
              }}
              title="Next"
            />

            <p className="text-white text-xl md:text-2xl font-medium leading-relaxed drop-shadow-md pointer-events-none">
              {activeStory.mediaUrl ? "" : activeStory.text}
            </p>
            {activeStory.mediaUrl && activeStory.text ? (
              <div className="absolute bottom-1 inset-x-2 z-10 text-center pointer-events-none">
                <p className="inline-block text-white text-sm leading-relaxed drop-shadow-md bg-black/35 backdrop-blur-sm px-3 py-1.5 rounded-2xl">
                  {activeStory.text}
                </p>
              </div>
            ) : null}
          </div>

          {/* Bottom Navigation Controls */}
          <div className="flex justify-between items-center z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevStory();
              }}
              disabled={activeViewer.type === "my" && activeViewer.storyIndex === 0}
              className="p-2 rounded-full bg-black/25 text-white disabled:opacity-20 hover:bg-black/40 transition-colors"
              title="Previous story"
            >
              <ChevronLeft size={18} />
            </button>

            <span className="text-[11px] text-white/70 font-medium">
              {activePerson.stories.length > 1
                ? `${activeViewer.storyIndex + 1} of ${activePerson.stories.length}`
                : "1 status update"}
            </span>

            <div className="flex items-center gap-2">
              {activeViewer.type === "network" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReplyToStory();
                  }}
                  className="p-2 rounded-full bg-black/25 text-white hover:bg-black/40 transition-colors"
                  title="Reply to story"
                >
                  <MessageCircle size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextStory();
                }}
                className="p-2 rounded-full bg-black/25 text-white hover:bg-black/40 transition-colors"
                title="Next story"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Viewers bottom sheet (own stories) */}
          {showViewers && activeViewer.type === "my" && (
            <div
              className="absolute inset-x-0 bottom-0 z-30 max-h-[48%] overflow-y-auto bg-black/75 backdrop-blur-xl rounded-t-3xl p-4 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Eye size={13} /> Viewed by
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowViewers(false);
                  }}
                  className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {viewersLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-white/70">
                  <Loader size={16} className="animate-spin" />
                  <span className="text-xs">Loading…</span>
                </div>
              ) : viewersList.length === 0 ? (
                <p className="text-xs text-white/60 text-center py-4">No views yet.</p>
              ) : (
                <div className="space-y-1">
                  {viewersList.map((v) => (
                    <div key={v._id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={v.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.username || "User")}&background=27272a&color=ffffff`}
                          alt={v.username}
                          className="w-8 h-8 rounded-full object-cover border border-white/20"
                        />
                        <span className="text-xs font-semibold text-white truncate">{v.username}</span>
                      </div>
                      <span className="text-[10px] text-white/60 shrink-0">
                        {v.at ? new Date(v.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default StatusModal;
