import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ChatPane from "../components/ChatPane";
import ProfileModal from "../components/ProfileModal";
import { useChatStore } from "../store/useChatStore";

const HomePage = () => {
  const { selectedChat, setSelectedChat } = useChatStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(!selectedChat);

  // Synchronize mobile sidebar state when selectedChat changes
  useEffect(() => {
    if (!selectedChat) {
      setIsMobileSidebarOpen(true);
    }
  }, [selectedChat]);

  // On mobile: when a chat is selected, hide sidebar and show chat
  const handleChatSelect = () => {
    setIsMobileSidebarOpen(false);
  };

  // On mobile: go back from chat to sidebar
  const handleBackToSidebar = () => {
    setSelectedChat(null);
    setIsMobileSidebarOpen(true);
  };

  return (
    <div className="h-full w-full apple-ambient-bg md:p-2.5 flex flex-col justify-center items-center relative overflow-hidden box-border">
      {/* Dynamic Ambient Blur Spots (Pro Tip for Glassmorphism) */}
      <div className="fixed -top-24 -left-24 w-[480px] h-[480px] rounded-full blur-spot-1 pointer-events-none z-0 transition-all duration-700 animate-pulse-slow" />
      <div className="fixed -bottom-24 -right-24 w-[520px] h-[520px] rounded-full blur-spot-2 pointer-events-none z-0 transition-all duration-700 animate-pulse-slow" />

      {/* Main Frosted Glass Workspace */}
      <div className="w-full max-w-[1680px] h-full glass-panel md:rounded-2xl shadow-glass overflow-hidden flex z-10 transition-colors duration-300">
        {/* Sidebar */}
        <div
          className={`
            ${isMobileSidebarOpen ? "flex" : "hidden"}
            md:flex flex-col
            w-full md:w-80 lg:w-[340px]
            flex-shrink-0 h-full glass-sidebar
          `}
        >
          <Sidebar 
            onChatSelect={handleChatSelect}
            onOpenProfile={() => setIsProfileOpen(true)}
          />
        </div>

        {/* Chat Pane Area */}
        <div
          className={`
            ${!isMobileSidebarOpen ? "flex" : "hidden"}
            md:flex flex-1 flex-col relative min-w-0 h-full glass-chat
          `}
        >
          <ChatPane onBack={handleBackToSidebar} />
        </div>
      </div>

      {/* Profile Modal */}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    </div>
  );
};

export default HomePage;
