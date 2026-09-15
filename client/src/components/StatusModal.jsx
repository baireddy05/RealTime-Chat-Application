import { useState, useEffect, useCallback } from "react";
import { X, Plus, Send, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const STATUS_BG_COLORS = [
  "bg-gradient-to-tr from-sky-500 to-indigo-600",
  "bg-gradient-to-tr from-violet-500 to-fuchsia-600",
  "bg-gradient-to-tr from-emerald-400 to-teal-600",
  "bg-gradient-to-tr from-amber-400 to-orange-500",
  "bg-gradient-to-tr from-cyan-500 to-blue-600",
];

const StatusModal = ({ onClose }) => {
  const { authUser } = useAuthStore();
  const { networkStatuses: networkPersons, myStatuses: myStories, uploadStatus, deleteStatus, getStatuses } = useChatStore();

  useEffect(() => {
    getStatuses();
  }, [getStatuses]);

  const [activeViewer, setActiveViewer] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const [newStatusText, setNewStatusText] = useState("");
  const [selectedBg, setSelectedBg] = useState(STATUS_BG_COLORS[0]);

  const activePerson = activeViewer
    ? activeViewer.type === "my"
      ? {
          id: "my-status",
          user: authUser?.username || "You",
          avatar:
            authUser?.profilePic ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=2563eb&color=ffffff`,
          stories: myStories,
        }
      : networkPersons[activeViewer.personIndex]
    : null;

  const activeStory = activePerson?.stories?.[activeViewer?.storyIndex] || null;

  const goToNextStory = useCallback(() => {
    if (!activeViewer) return;

    const currentStories =
      activeViewer.type === "my"
        ? myStories
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
          setActiveViewer({
            type: "network",
            personIndex: 0,
            storyIndex: 0,
          });
          setStoryProgress(0);
        } else {
          setActiveViewer(null);
          setStoryProgress(0);
        }
      } else {
        if (activeViewer.personIndex < networkPersons.length - 1) {
          setActiveViewer({
            type: "network",
            personIndex: activeViewer.personIndex + 1,
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
          const prevPersonStories = networkPersons[prevPersonIndex].stories;
          setActiveViewer({
            type: "network",
            personIndex: prevPersonIndex,
            storyIndex: prevPersonStories.length - 1,
          });
          setStoryProgress(0);
        } else if (myStories.length > 0) {
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
    if (!activeViewer || !activeStory || isPaused) return;

    if (activeViewer.type === "network" && activeStory.id) {
      try {
        const viewed = JSON.parse(localStorage.getItem("viewedStories") || "[]");
        if (!viewed.includes(activeStory.id)) {
          viewed.push(activeStory.id);
          localStorage.setItem("viewedStories", JSON.stringify(viewed));
          window.dispatchEvent(new Event("pulse:story-viewed"));
        }
      } catch (e) {}
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
  }, [activeViewer, activeStory, isPaused, goToNextStory]);

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    if (!newStatusText.trim()) return;

    setIsCreatingStatus(true);
    try {
      await uploadStatus(newStatusText.trim(), selectedBg);
      setNewStatusText("");
    } catch (error) {
      console.error("Failed to upload status", error);
    } finally {
      setIsCreatingStatus(false);
    }
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center animate-fadeIn p-4 select-none"
      onClick={onClose}
    >
      {/* Story Viewer Overlay */}
      {activeViewer && activePerson && activeStory ? (
        <div
          className="relative w-full max-w-sm h-[580px] max-h-[88vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-5 md:p-6 animate-scaleIn select-none"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Background Gradient */}
          <div className={`absolute inset-0 ${activeStory.bg} -z-10 transition-colors duration-500`} />

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
              {activeStory.text}
            </p>
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
      ) : (
        /* Status List & Creator Modal */
        <div 
          className="w-full max-w-md bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl shadow-glass overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn text-theme-main"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-[var(--glass-border)] px-5 py-4 flex items-center justify-between bg-[var(--glass-hover)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-online" />
              <h3 className="font-semibold text-sm text-theme-main">Stories & Status</h3>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-full hover:bg-[var(--glass-hover)] transition-colors text-theme-muted hover:text-theme-main"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 overflow-y-auto space-y-5">
            {/* My Status Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider">
                  My Status
                </span>
                <button
                  onClick={() => setIsCreatingStatus(!isCreatingStatus)}
                  className="text-xs font-medium text-accent-primary hover:underline flex items-center gap-1 transition-colors"
                >
                  <Plus size={13} />
                  <span>{isCreatingStatus ? "Cancel" : myStories.length > 0 ? "Add Status" : "Share"}</span>
                </button>
              </div>

              {isCreatingStatus ? (
                <form onSubmit={handleCreateStatus} className="bg-[var(--glass-surface)] border border-[var(--glass-border)] p-3.5 rounded-2xl space-y-3">
                  <textarea
                    rows={2}
                    placeholder="Share an update with your contacts..."
                    value={newStatusText}
                    onChange={(e) => setNewStatusText(e.target.value)}
                    autoFocus
                    className="w-full glass-input rounded-xl p-2.5 text-xs text-theme-main placeholder-theme-muted/40 focus:outline-none focus:border-accent-primary/60 border border-[var(--glass-border)] resize-none"
                  />

                  {/* Background Color Picker with Palette */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-2">
                      {STATUS_BG_COLORS.map((bg, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedBg(bg)}
                          className={`w-5 h-5 rounded-full ${bg} transition-transform ${
                            selectedBg === bg ? "scale-125 ring-2 ring-accent-primary" : "opacity-70 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={!newStatusText.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-accent-primary hover:bg-accent-primary/80 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-accent-primary/25 transition-all disabled:opacity-40"
                    >
                      <Send size={12} />
                      <span>Post</span>
                    </button>
                  </div>
                </form>
              ) : myStories.length > 0 ? (
                <div className="flex items-center justify-between p-2 rounded-2xl bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] transition-colors group">
                  <div
                    onClick={() => {
                      setActiveViewer({ type: "my", personIndex: 0, storyIndex: 0 });
                      setStoryProgress(0);
                    }}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={
                          authUser?.profilePic ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=2563eb&color=ffffff`
                        }
                        alt="My Status"
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-accent-primary p-0.5"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-theme-main">My Story</p>
                      <p className="text-[10px] text-theme-muted">
                        {myStories.length} {myStories.length === 1 ? "update" : "updates"} • {myStories[0].time}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsCreatingStatus(true)}
                    className="p-1.5 rounded-xl text-accent-primary hover:bg-accent-primary/20 transition-colors text-xs font-medium flex items-center gap-1"
                    title="Add another status update"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setIsCreatingStatus(true)}
                  className="flex items-center gap-3 p-2 rounded-2xl bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] cursor-pointer transition-colors"
                >
                  <div className="relative">
                    <img
                      src={
                        authUser?.profilePic ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=2563eb&color=ffffff`
                      }
                      alt="My Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-[var(--glass-border)]"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-primary text-white flex items-center justify-center font-bold shadow">
                      <Plus size={10} strokeWidth={3} />
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-xs text-theme-main">My Story</p>
                    <p className="text-[10px] text-theme-muted">Tap to share an update</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Updates from Network Friends */}
            <div>
              <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block mb-2">
                Recent Updates
              </span>

              {networkPersons && networkPersons.length > 0 ? (
                <div className="space-y-1">
                  {networkPersons.map((person, pIdx) => (
                    <div
                      key={person.id}
                      onClick={() => {
                        setActiveViewer({
                          type: "network",
                          personIndex: pIdx,
                          storyIndex: 0,
                        });
                        setStoryProgress(0);
                      }}
                      className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--glass-hover)] cursor-pointer transition-colors"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={person.avatar}
                          alt={person.user}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-accent-secondary p-0.5"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs text-theme-main truncate">{person.user}</p>
                        <p className="text-[10px] text-theme-muted truncate">
                          {person.stories.length > 1
                            ? `${person.stories.length} updates • ${person.stories[0].time}`
                            : person.stories[0].time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-5 px-4 text-center text-theme-muted text-xs bg-[var(--glass-surface)] rounded-2xl border border-[var(--glass-border)]">
                  No recent status updates from contacts.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusModal;
