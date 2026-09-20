import { useEffect, useMemo, useState } from "react";
import { X, Loader, Trash2, Plus, Check, CalendarClock, Flag, User as UserIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useBackHandler } from "../lib/backNavigation";

const PRIORITIES = [
  { id: "low", label: "Low", dot: "bg-emerald-500" },
  { id: "medium", label: "Med", dot: "bg-amber-500" },
  { id: "high", label: "High", dot: "bg-red-500" },
];

const formatDue = (d) => {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const overdue = date < now;
  const label = date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return { label, overdue };
};

const TasksDrawer = ({ onClose, prefill, onClearPrefill }) => {
  const {
    selectedChat,
    tasks,
    tasksScope,
    setTasksScope,
    getTasks,
    createTask,
    toggleTask,
    deleteTask,
  } = useChatStore();
  const { authUser } = useAuthStore();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignees, setAssignees] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);

  useBackHandler(true, onClose, "tasks-drawer");

  const scopeParams = useMemo(() => {
    if (!selectedChat) return tasksScope === "mine" ? { scope: "mine" } : null;
    if (selectedChat.type === "room") return { roomId: selectedChat.id };
    return { peerId: selectedChat.id };
  }, [selectedChat, tasksScope]);

  useEffect(() => {
    if (tasksScope === "mine") {
      getTasks({ scope: "mine", showDone });
    } else if (scopeParams) {
      getTasks({ ...scopeParams, showDone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id, tasksScope, showDone]);

  // Prefill from a message ("Create Task" menu action)
  useEffect(() => {
    if (prefill) {
      const text = prefill.decryptedText || prefill.text || "";
      setTitle(text.slice(0, 120));
      setDescription(text.length > 120 ? text : "");
      setShowForm(true);
    }
  }, [prefill]);

  const members = useMemo(() => {
    if (selectedChat?.type === "room") {
      return (selectedChat.members || []).map((m) => ({
        id: (m._id || m)?.toString(),
        username: m.username || "Member",
        profilePic: m.profilePic,
      })).filter((m) => m.id);
    }
    return [];
  }, [selectedChat]);

  const toggleAssignee = (id) => {
    setAssignees((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Give the task a title");
      return;
    }
    setIsSaving(true);
    setError("");
    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueAt: dueAt || undefined,
      assignees,
      ...(selectedChat?.type === "room"
        ? { roomId: selectedChat.id }
        : selectedChat
        ? { peerId: selectedChat.id }
        : {}),
    };
    if (prefill?._id && !String(prefill._id).startsWith("temp_")) {
      payload.sourceMessageId = prefill._id;
    }
    const res = await createTask(payload);
    setIsSaving(false);
    if (res.success) {
      setTitle("");
      setDescription("");
      setDueAt("");
      setPriority("medium");
      setAssignees([]);
      setShowForm(false);
      onClearPrefill?.();
      if (tasksScope === "mine") getTasks({ scope: "mine", showDone });
      else if (scopeParams) getTasks({ ...scopeParams, showDone });
    } else {
      setError(res.error || "Could not create task");
    }
  };

  const openTasks = tasks.filter((t) => !t.isDone);
  const doneTasks = tasks.filter((t) => t.isDone);

  const renderTask = (task) => {
    const due = formatDue(task.dueAt);
    const canDelete =
      task.createdBy?._id?.toString() === authUser?._id?.toString() ||
      task.createdBy?.toString() === authUser?._id?.toString();
    return (
      <div
        key={task._id}
        className="bg-[var(--glass-surface)] rounded-2xl p-3.5 border border-[var(--glass-border)] shadow-sm"
      >
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => toggleTask(task._id)}
            className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              task.isDone
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-[var(--glass-border)] hover:border-emerald-500"
            }`}
            title={task.isDone ? "Reopen task" : "Mark done"}
          >
            {task.isDone && <Check size={13} strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-medium text-theme-main leading-snug ${task.isDone ? "line-through opacity-60" : ""}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-[11px] text-theme-muted mt-0.5 line-clamp-2">{task.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                task.priority === "high" ? "bg-red-500/15 text-red-400"
                : task.priority === "low" ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/15 text-amber-400"
              }`}>
                <Flag size={9} /> {task.priority}
              </span>
              {due && (
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  due.overdue && !task.isDone ? "bg-red-500/15 text-red-400 font-bold" : "bg-[var(--glass-hover)] text-theme-muted"
                }`}>
                  <CalendarClock size={9} /> {due.label}
                </span>
              )}
              {(task.assignees || []).map((a) => (
                <span key={a._id || a} className="inline-flex items-center gap-1 text-[10px] text-theme-muted">
                  <img
                    src={a.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.username || "U")}&background=6366f1&color=ffffff&size=32`}
                    alt={a.username}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  {a.username}
                </span>
              ))}
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => deleteTask(task._id)}
              className="p-1.5 rounded-lg text-theme-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Delete task"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex justify-end animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md bg-[var(--glass-heavy)] backdrop-blur-2xl h-full shadow-glass border-l border-[var(--glass-border)] flex flex-col animate-slideLeft text-theme-main"
      >
        <div className="h-16 px-5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-hover)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="material-symbols-outlined text-[17px]">task_alt</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Tasks</h3>
              <p className="text-[11px] text-theme-muted">{openTasks.length} open</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3 flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setTasksScope("chat")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tasksScope === "chat" ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" : "text-theme-muted border border-transparent"}`}
          >
            This chat
          </button>
          <button
            type="button"
            onClick={() => setTasksScope("mine")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tasksScope === "mine" ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" : "text-theme-muted border border-transparent"}`}
          >
            My tasks
          </button>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="ml-auto text-[11px] text-theme-muted hover:text-theme-main"
          >
            {showDone ? "Hide done" : "Show done"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {showForm ? (
            <div className="bg-[var(--glass-surface)] rounded-2xl p-4 border border-accent-primary/30 space-y-2.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                autoFocus
                className="w-full glass-input rounded-xl px-3 py-2 text-[13px] text-theme-main border border-[var(--glass-border)]"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details (optional)..."
                rows={2}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-theme-main border border-[var(--glass-border)] resize-none"
              />
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="flex-1 min-w-0 glass-input rounded-xl px-2.5 py-1.5 text-[11px] text-theme-main border border-[var(--glass-border)]"
                />
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      title={p.label}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${priority === p.id ? "border-accent-primary bg-accent-primary/15" : "border-[var(--glass-border)]"}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
                    </button>
                  ))}
                </div>
              </div>
              {members.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-1.5">Assign to</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleAssignee(m.id)}
                        className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-[11px] border transition-all ${assignees.includes(m.id) ? "border-accent-primary bg-accent-primary/15 text-accent-primary" : "border-[var(--glass-border)] text-theme-muted"}`}
                      >
                        <img src={m.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=6366f1&color=ffffff&size=32`} alt={m.username} className="w-5 h-5 rounded-full object-cover" />
                        {m.username}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(""); onClearPrefill?.(); }}
                  className="flex-1 py-2 rounded-xl text-xs font-medium text-theme-muted hover:bg-[var(--glass-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {isSaving ? <Loader size={13} className="animate-spin" /> : <Plus size={13} />}
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-[var(--glass-border)] text-theme-muted hover:text-accent-primary hover:border-accent-primary/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={14} /> New task
            </button>
          )}

          {openTasks.map(renderTask)}
          {showDone && doneTasks.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider pt-1">Completed</p>
              {doneTasks.map(renderTask)}
            </>
          )}
          {openTasks.length === 0 && (!showDone || doneTasks.length === 0) && !showForm && (
            <div className="text-center py-14 text-theme-muted">
              <span className="material-symbols-outlined text-4xl opacity-40">task_alt</span>
              <p className="text-sm font-medium text-theme-main mt-2">No tasks yet</p>
              <p className="text-xs mt-1">Turn any message into a trackable task.</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--glass-border)] flex items-center gap-1.5 text-[11px] text-theme-muted flex-shrink-0">
          <UserIcon size={12} />
          <span>Live-synced to everyone in this conversation</span>
        </div>
      </div>
    </div>
  );
};

export default TasksDrawer;
