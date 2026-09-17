import { useState } from "react";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Download, 
  Copy, 
  Check, 
  ShieldCheck,
  UserPlus
} from "lucide-react";
import { downloadVCard } from "../lib/vcard";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";

const ContactCard = ({ contact, isMine = false }) => {
  const { setSelectedChat } = useChatStore();
  const { authUser } = useAuthStore();
  const { friends, sendFriendRequest } = useFriendStore();

  const [copied, setCopied] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);

  if (!contact) return null;

  const contactName = contact.fullName || contact.name || contact.username || "Shared Contact";
  const username = contact.username || "";
  const phone = contact.phone || "";
  const email = contact.email || "";
  const about = contact.about || contact.bio || "Pulse Contact";
  const profilePic = contact.profilePic || "";
  const contactUserId = contact.userId || contact._id;

  const isSelf = authUser?._id && contactUserId && authUser._id.toString() === contactUserId.toString();
  const isAlreadyFriend = (friends || []).some((f) => f._id?.toString() === contactUserId?.toString());

  const handleMessageClick = (e) => {
    e.stopPropagation();
    if (!contactUserId || isSelf) return;
    setSelectedChat({
      id: contactUserId.toString(),
      name: username || contactName,
      type: "user",
      profilePic: profilePic,
    });
  };

  const handleDownloadVCard = (e) => {
    e.stopPropagation();
    downloadVCard(contact);
  };

  const handleCopyDetails = (e) => {
    e.stopPropagation();
    const details = [
      `Name: ${contactName}`,
      username ? `Username: @${username}` : "",
      phone ? `Phone: ${phone}` : "",
      email ? `Email: ${email}` : "",
      about ? `Note: ${about}` : "",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleAddFriend = async (e) => {
    e.stopPropagation();
    if (!contactUserId || isSelf || isAlreadyFriend || friendRequested) return;
    setIsAddingFriend(true);
    try {
      await sendFriendRequest(contactUserId);
      setFriendRequested(true);
    } catch {
      // ignore
    } finally {
      setIsAddingFriend(false);
    }
  };

  const avatarSrc = profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=3b82f6&color=ffffff&bold=true`;

  return (
    <div 
      className={`rounded-2xl overflow-hidden my-1.5 transition-all border select-none w-full max-w-sm ${
        isMine 
          ? "bg-black/20 border-white/20 text-white" 
          : "bg-[var(--glass-surface)] border-[var(--glass-border)] text-theme-main shadow-sm"
      }`}
    >
      {/* Contact Header Card */}
      <div className="p-3 sm:p-3.5 flex items-center gap-3">
        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-current/20 shadow-sm bg-black/10">
          <img
            src={avatarSrc}
            alt={contactName}
            className="w-full h-full object-cover"
          />
          {contactUserId && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-accent-primary text-white p-0.5 rounded-full ring-2 ring-current/20">
              <ShieldCheck size={10} />
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold truncate">{contactName}</span>
          </div>

          {username && username !== contactName && (
            <span className="text-[11px] opacity-75 truncate">@{username}</span>
          )}

          <p className="text-[11px] opacity-70 truncate mt-0.5">{about}</p>
        </div>
      </div>

      {/* Optional Contact Fields (Phone & Email) */}
      {(phone || email) && (
        <div className="px-3 pb-2.5 space-y-1 text-[11px] opacity-85 border-t border-current/10 pt-2">
          {phone && (
            <div className="flex items-center gap-2 truncate">
              <Phone size={12} className="opacity-70 shrink-0" />
              <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className="hover:underline truncate font-mono">
                {phone}
              </a>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 truncate">
              <Mail size={12} className="opacity-70 shrink-0" />
              <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="hover:underline truncate">
                {email}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Bar */}
      <div className="grid grid-cols-3 divide-x divide-current/15 border-t border-current/15 bg-current/5 text-[11px] font-semibold">
        {/* Button 1: Message if user registered */}
        {contactUserId && !isSelf ? (
          <button
            type="button"
            onClick={handleMessageClick}
            className="py-2 px-1 flex items-center justify-center gap-1 hover:bg-current/10 active:scale-95 transition-all cursor-pointer"
            title="Start chat with this contact"
          >
            <MessageSquare size={12} />
            <span className="truncate">Message</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopyDetails}
            className="py-2 px-1 flex items-center justify-center gap-1 hover:bg-current/10 active:scale-95 transition-all cursor-pointer"
            title="Copy contact details"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="truncate">{copied ? "Copied" : "Copy"}</span>
          </button>
        )}

        {/* Button 2: Save to Contacts (.vcf) */}
        <button
          type="button"
          onClick={handleDownloadVCard}
          className="py-2 px-1 flex items-center justify-center gap-1 hover:bg-current/10 active:scale-95 transition-all cursor-pointer"
          title="Download vCard (.vcf) to save in phone contacts"
        >
          <Download size={12} />
          <span className="truncate">Save vCard</span>
        </button>

        {/* Button 3: Add Friend or Copy */}
        {contactUserId && !isSelf && !isAlreadyFriend ? (
          <button
            type="button"
            disabled={isAddingFriend || friendRequested}
            onClick={handleAddFriend}
            className="py-2 px-1 flex items-center justify-center gap-1 hover:bg-current/10 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            title="Send friend request"
          >
            {friendRequested ? <Check size={12} className="text-emerald-400" /> : <UserPlus size={12} />}
            <span className="truncate">{friendRequested ? "Sent" : "Add"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopyDetails}
            className="py-2 px-1 flex items-center justify-center gap-1 hover:bg-current/10 active:scale-95 transition-all cursor-pointer"
            title="Copy contact details"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="truncate">{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ContactCard;
