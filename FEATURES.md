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
- **Group Channels:** Create custom channels, invite members, and view group information (`CreateGroupModal.jsx`).
- **Real-Time WebSockets:** Live instant messaging powered by Socket.io.
- **Message Editing:** Edit previously sent messages with `(edited)` badges.
- **Message Deletion:** Delete messages for everyone (Tombstone soft-deletion strategy).
- **Message Forwarding:** Search and forward messages to other contacts or groups.
- **Scheduled Messages:** Schedule messages to be sent at a future time.
- **Read Receipts & Message Info:** See when a message was delivered and read.
- **Live Typing Indicators:** Real-time visual feedback when the other person is typing.
- **Message Formatting:** Rich text formatting.
- **In-Chat Search:** Search for specific messages inside a conversation.
- **Interactive Polls:** Create polls with single or multiple answers and see real-time voting results.
- **Ephemeral Whisper Mode:** Send disappearing messages that vanish permanently after being viewed once by pressing and holding.

## 3. Advanced Interactions & Threading
- **Quoted Replies / Threading:** Swipe to reply (`SwipeableMessage.jsx`) or click to quote a specific message.
- **Thread Drawer:** Dedicated UI for viewing message reply threads.
- **Multi-User Emoji Reactions:** Multiple users can react to a single message with different emojis.
- **Quick Message Reactions:** Add emoji reactions instantly to messages using a quick-access tooltip panel.
- **Quick Emoji Bar:** Frequently used emojis displayed directly above the message input field.
- **Pinned Messages:** Pin important messages to the top of the chat.
- **Typing Shockwave:** Visual ripple animation effects triggered when typing in the input field.
- **Draft Indicators:** Unsent text is automatically saved as a draft with a visible indicator in the sidebar.
- **Saved Messages (Self-Chat):** A dedicated channel to send files, notes, and links to yourself.
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
- **Chat Themes:** Customize the visual theme of specific chats, including background doodles and color palettes.
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
