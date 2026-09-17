import { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Search, 
  User, 
  Phone, 
  Mail, 
  Send, 
  Check, 
  Sparkles, 
  ShieldCheck,
  UserCheck,
  Share2,
  FileText
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";
import { useBackHandler } from "../lib/backNavigation";

const ContactModal = ({ isOpen, onClose, onSendContact }) => {
  const { authUser, onlineUsers } = useAuthStore();
  const { friends, searchResults, searchUsers, isSearching, getFriends } = useFriendStore();

  const [activeTab, setActiveTab] = useState("friends"); // "friends" | "myCard" | "custom"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  // Custom contact form state
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customAbout, setCustomAbout] = useState("");

  // Mobile Back Button Support
  useBackHandler(isOpen, onClose, "modal-contact-picker");

  useEffect(() => {
    if (isOpen) {
      getFriends();
      setSelectedContact(null);
      setSearchQuery("");
      setCustomName("");
      setCustomPhone("");
      setCustomEmail("");
      setCustomAbout("");
      setActiveTab("friends");
    }
  }, [isOpen, getFriends]);

  // Live user search when typing in search bar
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(() => {
        searchUsers(searchQuery);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchUsers]);

  const onlineSet = useMemo(() => new Set(onlineUsers || []), [onlineUsers]);

  // Filter friends based on search query
  const filteredFriends = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return friends || [];
    return (friends || []).filter(
      (f) =>
        (f.username || "").toLowerCase().includes(q) ||
        (f.bio || "").toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  // Other search results (users not yet in friends list)
  const nonFriendSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const friendIdSet = new Set((friends || []).map((f) => f._id?.toString()));
    return (searchResults || []).filter(
      (u) => u._id !== authUser?._id && !friendIdSet.has(u._id?.toString())
    );
  }, [searchResults, friends, authUser, searchQuery]);

  if (!isOpen) return null;

  const handleSelectFriend = (user) => {
    setSelectedContact({
      userId: user._id,
      username: user.username,
      fullName: user.fullName || user.username,
      profilePic: user.profilePic || "",
      about: user.bio || user.status || "Pulse Messenger Contact",
      email: user.email || "",
      phone: user.phone || "",
    });
  };

  const handleSelectMyCard = () => {
    setSelectedContact({
      userId: authUser?._id,
      username: authUser?.username,
      fullName: authUser?.username,
      profilePic: authUser?.profilePic || "",
      about: authUser?.bio || "Pulse User",
      email: authUser?.email || "",
      phone: authUser?.phone || "",
    });
  };

  const handleCustomSubmit = () => {
    if (!customName.trim()) return;
    const contactPayload = {
      fullName: customName.trim(),
      username: customName.trim(),
      phone: customPhone.trim(),
      email: customEmail.trim(),
      about: customAbout.trim() || "Custom Contact",
      profilePic: "",
    };
    onSendContact(contactPayload);
    onClose();
  };

  const handleSendSelected = () => {
    if (!selectedContact) return;
    onSendContact(selectedContact);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-[var(--glass-heavy)] border border-[var(--glass-border)] rounded-3xl shadow-glass overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-header)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-accent-primary/20 text-accent-primary flex items-center justify-center border border-accent-primary/30 shadow-sm">
              <Share2 size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-theme-main">Share Contact</h2>
              <p className="text-[11px] text-theme-muted">Send contact card with 1-tap chat and vCard save</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-2 px-4 border-b border-[var(--glass-border)] bg-[var(--glass-surface)] shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab("friends");
              setSelectedContact(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "friends"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm"
                : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
            }`}
          >
            <UserCheck size={14} />
            <span>Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("myCard");
              handleSelectMyCard();
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "myCard"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm"
                : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
            }`}
          >
            <ShieldCheck size={14} />
            <span>My Card</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("custom");
              setSelectedContact(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "custom"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm"
                : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
            }`}
          >
            <FileText size={14} />
            <span>Custom</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[260px] max-h-[380px] custom-scrollbar">
          {/* TAB 1: Contacts & Live User Search */}
          {activeTab === "friends" && (
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                <input
                  type="text"
                  placeholder="Search contacts or find users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-main placeholder:text-theme-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Friends list */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-theme-muted px-1 uppercase tracking-wider">
                  {searchQuery ? "Matching Contacts" : "All Contacts"} ({filteredFriends.length})
                </div>

                {filteredFriends.length === 0 ? (
                  <div className="text-center py-6 text-theme-muted text-xs">
                    {searchQuery ? "No contacts match your query." : "No contacts in your list yet."}
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    const isSelected = selectedContact?.userId === friend._id;
                    const isOnline = onlineSet.has(friend._id?.toString());
                    const avatar = friend.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=27272a&color=ffffff`;

                    return (
                      <div
                        key={friend._id}
                        onClick={() => handleSelectFriend(friend)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-accent-primary/15 border-accent-primary/50 shadow-sm"
                            : "bg-[var(--glass-surface)] border-transparent hover:border-[var(--glass-border)] hover:bg-[var(--glass-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-9 h-9 shrink-0">
                            <img
                              src={avatar}
                              alt={friend.username}
                              className="w-full h-full rounded-full object-cover border border-[var(--glass-border)]"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--glass-heavy)] ${
                                isOnline ? "bg-emerald-500" : "bg-zinc-500"
                              }`}
                            />
                          </div>

                          <div className="min-w-0 flex flex-col">
                            <span className="text-xs font-semibold text-theme-main truncate">{friend.username}</span>
                            <span className="text-[11px] text-theme-muted truncate">{friend.bio || "Available"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-accent-primary text-white flex items-center justify-center">
                              <Check size={14} />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectFriend(friend);
                              }}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-[var(--glass-hover)] hover:bg-accent-primary hover:text-white text-theme-main transition-colors"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Extended Search Results */}
              {searchQuery.trim().length >= 2 && nonFriendSearchResults.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-[var(--glass-border)]">
                  <div className="text-[11px] font-semibold text-theme-muted px-1 uppercase tracking-wider">
                    Other Users ({nonFriendSearchResults.length})
                  </div>
                  {nonFriendSearchResults.map((user) => {
                    const isSelected = selectedContact?.userId === user._id;
                    const avatar = user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=27272a&color=ffffff`;

                    return (
                      <div
                        key={user._id}
                        onClick={() => handleSelectFriend(user)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-accent-primary/15 border-accent-primary/50 shadow-sm"
                            : "bg-[var(--glass-surface)] border-transparent hover:border-[var(--glass-border)] hover:bg-[var(--glass-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={avatar}
                            alt={user.username}
                            className="w-9 h-9 rounded-full object-cover border border-[var(--glass-border)]"
                          />
                          <div className="min-w-0 flex flex-col">
                            <span className="text-xs font-semibold text-theme-main truncate">{user.username}</span>
                            <span className="text-[11px] text-theme-muted truncate">{user.bio || user.email || "Pulse User"}</span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-accent-primary text-white flex items-center justify-center">
                            <Check size={14} />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectFriend(user);
                            }}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-[var(--glass-hover)] hover:bg-accent-primary hover:text-white text-theme-main transition-colors"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Share My Profile Card */}
          {activeTab === "myCard" && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex flex-col items-center text-center relative overflow-hidden">
                <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-accent-primary/40 shadow-glass mb-3 relative">
                  <img
                    src={authUser?.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "Me")}&background=27272a&color=ffffff`}
                    alt={authUser?.username}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 bg-accent-primary text-white p-0.5 rounded-full">
                    <ShieldCheck size={12} />
                  </div>
                </div>

                <h3 className="text-base font-bold text-theme-main">{authUser?.username}</h3>
                <p className="text-xs text-theme-muted mt-0.5 max-w-xs">{authUser?.bio || "Available on Pulse"}</p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-[var(--glass-border)] w-full text-xs text-theme-muted">
                  {authUser?.email && (
                    <span className="inline-flex items-center gap-1 bg-[var(--glass-hover)] px-2.5 py-1 rounded-xl">
                      <Mail size={12} className="text-accent-primary" />
                      <span>{authUser.email}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-xl font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Verified Profile</span>
                  </span>
                </div>
              </div>

              <div className="text-center text-xs text-theme-muted">
                Sharing your profile allows the recipient to start a chat and import your contact information with a single tap.
              </div>
            </div>
          )}

          {/* TAB 3: Manual Custom Contact */}
          {activeTab === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-theme-muted mb-1">
                  Full Name / Contact Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="text"
                    placeholder="e.g. Dr. Sarah Connor, Alex Smith"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-main placeholder:text-theme-muted focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-theme-muted mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 019-2834"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-main placeholder:text-theme-muted focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-theme-muted mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="email"
                    placeholder="e.g. sarah@example.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-main placeholder:text-theme-muted focus:outline-none focus:border-accent-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-theme-muted mb-1">
                  Note / Organization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiologist, Tech Lead, Friend"
                  value={customAbout}
                  onChange={(e) => setCustomAbout(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-main placeholder:text-theme-muted focus:outline-none focus:border-accent-primary/50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Button */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-header)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-2xl text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            Cancel
          </button>

          {activeTab === "custom" ? (
            <button
              type="button"
              disabled={!customName.trim()}
              onClick={handleCustomSubmit}
              className="px-5 py-2 text-xs font-semibold rounded-2xl bg-accent-primary hover:bg-accent-primary/90 text-white shadow-md shadow-accent-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={13} />
              <span>Send Contact</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedContact}
              onClick={handleSendSelected}
              className="px-5 py-2 text-xs font-semibold rounded-2xl bg-accent-primary hover:bg-accent-primary/90 text-white shadow-md shadow-accent-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={13} />
              <span>
                {selectedContact ? `Send ${selectedContact.fullName || selectedContact.username}` : "Select a Contact"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
