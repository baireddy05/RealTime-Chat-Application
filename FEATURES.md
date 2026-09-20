# Real-Time Chat Application Features

This document serves as the central source of truth for all features currently implemented in the application. 
*Note: Whenever a new feature is added or an existing one is removed, this file must be updated accordingly.*

## 1. Authentication & Security
- **Secure Authentication:** Zero-LocalStorage authentication using `HttpOnly`, `Secure`, and `SameSite=Strict` JWT cookies.
- **Socket Middleware Fallback Auth:** Robust WebSocket authentication that falls back to handshake tokens for strict cross-domain environments.
- **Client-Side E2EE Encryption:** Messages are encrypted end-to-end on the client before leaving the device using Web Crypto API (AES-GCM 256-bit) ensuring absolute privacy.
- **Cross-Site Scripting (XSS) Protection:** All user inputs and message strings are aggressively escaped and sanitized prior to parsing to prevent injection attacks.
- **Password Hashing:** Passwords are cryptographically hashed using `bcryptjs` (12 rounds of salt).
- **API Rate Limiting:** Backend endpoints are protected against brute force and DDoS attacks via `express-rate-limit`.
- **Payload Limits:** Strict 1MB JSON body limits to prevent payload overflow attacks.
- **Account Management:** User Signup, Login, and Logout functionality.

## 2. Core Messaging & Real-Time Communication
- **Direct Messaging (1-to-1):** Real-time private conversations with friends.
- **Groups:** Create custom groups, invite members, and view group information (`CreateGroupModal.jsx`). Group admins can add or remove members at any time from the group info panel.
- **Real-Time WebSockets:** Live instant messaging powered by Socket.io.
- **Message Editing:** Edit previously sent messages with `(edited)` badges.
- **Message Deletion:** Delete messages for everyone (Tombstone soft-deletion strategy).
- **Message Forwarding:** Search and forward messages to other contacts or groups.
- **Scheduled Messages:** Schedule messages to be sent at a future time.
- **Read Receipts & Message Info:** See when a message was delivered and read.
- **Live Typing Indicators:** Real-time visual feedback when the other person is typing.
- **Message Formatting:** Rich text formatting.
- **In-Chat Search:** Search for specific messages inside a conversation.
- **Global Message Search:** Type in the main search bar to filter chats and find matching messages across every conversation at once, with jump-to-message navigation.
- **Chat Labels & Folders:** Create color-coded labels (Work, Family, …), assign them in one tap from any chat's ⋮ menu (long-press on mobile), filter the inbox by label, and see label dots on every conversation.
- **Interactive Polls:** Create polls with single or multiple answers and see real-time voting results.
- **Ephemeral Whisper Mode:** Send disappearing messages that vanish permanently after being viewed once by pressing and holding.

## 3. Advanced Interactions & Threading
- **Quoted Replies / Threading:** Swipe to reply (`SwipeableMessage.jsx`) or click to quote a specific message.
- **Thread Drawer:** Dedicated UI for viewing message reply threads.
- **Multi-User Emoji Reactions:** Multiple users can react to a single message with different emojis.
- **Quick Message Reactions:** Add emoji reactions instantly to messages using a quick-access tooltip panel.
- **Quick Emoji Bar:** Frequently used emojis displayed directly above the message input field.
- **Pinned Messages:** Pin important messages to the top of the chat.
- **Group Announcements:** Admins can broadcast announcement messages (`isAnnouncement`) that render with a highlighted badge and can be filtered via a dedicated banner.
- **Group Events & RSVP:** Plan events inside any group (title, description, start/end, location) with Going / Maybe / Can't-go RSVPs, live-synced to all members over WebSockets.
- **Tasks & To-Dos:** Turn any message into a trackable task, assign it to members, set due dates and priorities, and manage per-chat or personal task lists in the Tasks drawer with real-time updates.
- **Typing Shockwave:** Visual ripple animation effects triggered when typing in the input field.
- **Draft Indicators:** Unsent text is automatically saved as a draft with a visible indicator in the sidebar.
- **Saved Messages (Self-Chat):** A dedicated chat to send files, notes, and links to yourself.
- **Archive Chats:** Hide inactive chats from the main inbox into a dedicated "Archived" view.
- **HD Media Quality Toggle:** Choose whether to send images compressed (for speed) or in High Definition.

## 4. Media, Files & Rich Content
- **Drag-and-Drop Files:** Drag files directly into the chat window to upload.
- **Document & File Sharing:** Upload and share PDFs, zip files, code files, etc.
- **Cloud Media Storage:** All media assets are securely hosted and served via Cloudinary integration.
- **File Downloads:** Direct one-click downloads for shared attachments.
- **File Size Formatting:** Displays readable file sizes (KB, MB).
- **Image Sharing & Viewing:** Upload images with a dedicated lightbox viewer.
- **Webcam Integration:** Capture images instantly using device camera (`Camera` icon).
- **Voice Notes / Audio Messages:** Record, send, and play audio messages directly in the chat interface.
- **GIF Integration:** Send animated GIFs via Giphy API integration.
- **Sticker Support:** Native support for rendering chat stickers.
- **Rich Link Previews:** Automatically fetch and display thumbnail and metadata for URLs.
- **Native vCard Export:** Share contact cards that can be downloaded as standard vCard 3.0 files compatible with iOS/Android/macOS.
- **Jumbo Emojis:** Messages containing only emojis are rendered in a larger font size.
- **Twemoji Support:** Standardized emoji rendering across all devices using Twemoji API.

## 5. Audio / Video Calling
- **Real-Time WebRTC Calling:** Low-latency 1-to-1 audio and HD video calls across mobile and laptop devices.
- **Hardware-Calibrated Audio:** Real-time acoustic echo cancellation, background noise suppression, and automatic gain control to eliminate howling and feedback loops.
- **Interactive Call Controls:** Toggle microphone, camera on/off, front/rear camera flip on mobile, live floating emoji reactions, speaker volume toggle, and desktop screen sharing.
- **Picture-in-Picture (PiP) Video:** Seamless PiP floating preview with instant main/mini view swapping and aspect ratio cycling.
- **Real-Time Peer State Badges:** Live WebSocket synchronization showing when the remote peer mutes their mic or turns off their camera.
- **Mobile Hardware Back Interception:** Android physical back button and iOS swipe gesture support to cleanly decline incoming calls or hang up.

## 6. Organization, UI, & Customization
- **User Profiles:** Customizable profiles with avatars and bio.
- **Ghost Mode / Invisible Status:** Ability to hide online status from the network while remaining logged in and active.
- **Custom Statuses:** Ability to set custom text statuses.
- **Friends System:** Send, accept, or reject friend requests to build a contacts list.
- **Auto-generated Sender Colors:** Automatically hashes usernames to assign unique visual colors to users in group chats.
- **Starred Messages:** Bookmark important messages and manage them in a dedicated drawer.
- **Chat Themes & WhatsApp-Style Background Doodles:** Customize the visual theme of specific chats. Features ultra-fine WhatsApp-sized miniature doodle tiling (180px repeat tile, 1.6px stroke width) with minimal noticeability (4.5%-5.5% subtle watermark opacity) and custom color palettes.
- **Dynamic Theme Semantic Design:** Advanced Tailwind configuration implementing a dynamic Material-You inspired semantic color system (surface variants, container colors).
- **Dynamic Date Dividers:** Automatically group messages under sticky date dividers (e.g., "Today", "Yesterday").
- **Virtualized Lists:** Efficient rendering of thousands of messages using `react-virtuoso` for smooth scrolling performance.
- **Lazy Loading Modules:** Emoji and GIF pickers are lazy-loaded to optimize initial load times.
- **Modern Responsive UI:** Cyber Dark Mode, glassmorphism, responsive sidebar layout, and smooth micro-animations.
- **Mathematical Audio Synthesis:** Chat sound effects (message sent, chime received, ringing) are mathematically synthesized on-the-fly using the Web Audio API without needing external `.mp3` assets.
- **Native Mobile Navigation Interception:** The browser's History API is hijacked to map Android physical back buttons and iOS swipe gestures to intuitively close modals and drawers in order, giving a true native-app feel.
- **Desktop/In-App Notifications:** Real-time push notifications for new messages.
- **Mute / Unmute Chats:** Ability to silence notifications for specific chats or groups.
- **Mobile Swipe Gestures:** Swipeable navigation and interactions for a native app feel on mobile devices.
- **Floating "Unread" & Smart Scroll Button:** A floating button that appears when scrolled up, displaying the unread message count and smoothly scrolling back to the latest messages.
- **PWA Support:** Install the application as a Progressive Web App directly to the user's home screen.
- **App Settings:** Configure general application preferences.
- **API Health Monitoring:** Dedicated endpoints for uptime monitoring and cron-job keep-alives.
## 7. Productivity, Accessibility & Advanced Expression
- **Interactive Doodle & Drawing Canvas:** Full whiteboard drawing modal (`DrawSketchModal.jsx`) allowing users to sketch diagrams, handwritten notes, and doodles using Pen, Highlighter, and Eraser with 8 vibrant color palettes and stroke sizes. Supports direct one-click sending into chat and local PNG downloads.
- **Code Snippet Composer:** Dedicated code composer modal (`CodeSnippetModal.jsx`) supporting 13+ programming languages (JavaScript, Python, TypeScript, HTML/CSS, SQL, JSON, Rust, Go, C++, Java, Bash) with line numbers and character count. Sends syntax-highlighted code blocks with custom copy actions.
- **Speech-to-Text / Voice Typing:** Hands-free real-time voice dictation in the message input using the Web Speech API (`SpeechRecognition`). Real-time speech transcription appending directly to the message input with audio wave pulse indicator.
- **Text-to-Speech (TTS) Message Readout:** Hands-free speech synthesis listening for any text message using the Web Speech API (`window.speechSynthesis`). Includes real-time speaking indicator badge and one-click stop/pause control.
- **Interactive Spoiler / Hidden Text Formatting:** Conceal sensitive text or spoilers using `||hidden text||` syntax. Renders with a frosted glass blur effect that smoothly unblurs and reveals on tap/click and re-blurs on second tap.
- **Persistent Scratchpad & Quick Notes:** Slide-over local scratchpad drawer (`QuickNotesDrawer.jsx`) accessible from the chat header. Allows creating and organizing persistent notes, checklists, and snippets saved in browser storage, with a "Send to Chat" button to instantly dispatch notes to the active conversation.
- **Multi-Format Conversation Export:** Export entire chat transcripts in multiple formats:
  - *Styled HTML Transcript:* Self-contained, beautifully styled HTML report with dark mode theme, sender badges, media attachments, and message bubbles.
  - *JSON Data Export:* Structured JSON containing chat metadata, participants, timestamps, and message payloads for backups and developer analysis.
  - *Formatted TXT:* Clean ASCII transcript with timestamps and delivery info.
