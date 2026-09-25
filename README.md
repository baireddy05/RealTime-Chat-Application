# Real-Time Instant Messaging Application

A fully functional, feature-complete Real-Time Instant Messaging Application built with the MERN stack (MongoDB, Express, React, Node.js), Socket.io, and Cloudinary.

## Features
- **Secure Authentication:** JWT in `HttpOnly` cookies (`Secure` + `SameSite=None` in production, `Lax` locally) with Bearer-token fallback for WebView/cross-domain contexts. Passwords hashed with `bcryptjs` (12 salt rounds). Auth endpoints rate-limited (50/15min, 1000 in test env).
- **Real-Time Communication:** Cookie/token-authenticated Socket.io. 1-to-1 Direct Messages and Groups with membership-checked joins, throttled typing indicators, and delivery/read receipts.
- **Client-Side E2EE:** AES-GCM 256-bit message encryption via Web Crypto API; deterministic per-conversation keys, wrong-key flash and silent-downgrade bugs fixed.
- **Quoted Message Replies (Threading):** Quote and reply directly to any message with clickable jump-to navigation and highlight pulse, plus a dedicated thread drawer.
- **Message Editing / Deletion:** Edit with `(edited)` badges; delete-for-everyone (tombstone) and delete-for-me.
- **On-Device Translation (unlimited, free):** Chrome/Edge built-in Translator + LanguageDetector APIs first (`client/src/lib/onDeviceTranslate.js`, `on-device` badge) — no quota, offline-capable. Server `POST /api/chat/message/:id/translate` is fallback only (Google `gtx` endpoint + cache, MyMemory last resort; quota warnings never render as translations).
- **Read Aloud (TTS):** `window.speechSynthesis` message readout with speaking indicator — on-device, unlimited, no server cost.
- **Custom Group Creation:** Groups with name, description, member invites, invite codes/links, join approvals, admin add/remove, leave with ownership transfer, and delete.
- **Appearance Studio:** 10 preset themes + full custom-color layer (`CUSTOM_COLOR_GROUPS`) with a standalone live preview panel docked left/right on desktop (mobile popup), covering backgrounds, text, both bubble sets, accents, presence, panels, borders, pills, and sender colors 1:1.
- **Document & File Sharing:** Private GridFS store (`pulse_docs`) with `fileId`-based authenticated downloads; images/audio/video via Cloudinary (signed uploads). Rich file cards, 50 MB doc cap, 1 MB JSON cap.
- **Voice Notes, GIFs, Stickers:** Waveform audio player (shared AudioContext, abortable decode, pause on unmount), Giphy picker (env key, debounced search), stickers, webcam capture, HD image toggle.
- **Calls:** 1-to-1 + group WebRTC calls (mute, camera flip with track cleanup, screen share, PiP, peer-state badges, ICE retry with backoff, full track/listener cleanup), call history with redial and missed-call notices.
- **Push Notifications:** Web Push (VAPID) + FCM with deep links (`?chat=`, `?callFrom=`). Correct `/push/*` paths, SW-ready timeouts, no mass-unsubscribe on malformed calls, dead-endpoint pruning.
- **Organization:** Labels/folders, pin chats (max 20), archive, chat lock (validated 4-digit SHA-256 PIN), drafts, date dividers, saved self-chat, disappearing timers, whisper/view-once media with participant checks.
- **PWA:** Installable via Add to Home Screen (`usePWAInstall`, iOS guidance, one-shot prompt handling), offline shell + LRU static cache in `public/sw.js` (error pages never cached, media never cached).
- **Synthesized UI Audio:** Pure Web Audio API chimes, no `.mp3` assets.
- **Online/Offline Status:** Live presence rings + ghost/invisible mode.
- **Modern UI:** Responsive Cyber Dark Mode glassmorphism layout (React 19, Vite, Tailwind CSS), virtualized lists (`react-virtuoso`), lazy-loaded pickers.

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas (Free Tier) Account
- Cloudinary (Free Tier) Account

### 2. Environment Variables
Create a `.env` file in the `server` directory with the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLIENT_URL=http://localhost:5173
# Push notifications (background messages & calls). Generate with: npm run gen:vapid
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
# Optional
NODE_ENV=development
FIREBASE_SERVICE_ACCOUNT=
ALLOW_VERCEL_PREVIEWS=false
PLAYWRIGHT=1
```

Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000
VITE_GIPHY_API_KEY=
```

### 3. Installation
**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd client
npm install
```

### 4. Running the Seed Script
To generate dummy users, rooms, and messages for testing:
```bash
cd server
npm run seed
```

### 5. Running the Application
**Server:**
```bash
cd server
npm run dev
```

**Client:**
```bash
cd client
npm run dev
```

### 6. Demo Accounts (for evaluation)

Run the seeder once (or just start the server against an empty database, which auto-seeds):

```bash
cd server
npm run seed
```

| Username | Email | Password |
|---|---|---|
| User1 | user1@example.com | password123 |
| User2 | user2@example.com | password123 |
| User3 | user3@example.com | password123 |
| User4 | user4@example.com | password123 |
| User5 | user5@example.com | password123 |

Seeded content includes a "General Group" with welcome messages, and User1 + User2 start as friends. Suggested flow: log in as User1 and User2 in two browsers, exchange text, an image, and a PDF, then try a call and a status post.

### 7. Install as an App (PWA)
Install on phones straight from the browser via Add to Home Screen for an app-like experience with background push notifications. iOS Safari has no `beforeinstallprompt` — use Share → Add to Home Screen.

### 8. Verification
- Client: `cd client && npm run build` (production Vite build), `npm run lint` (`oxlint`, 0 errors).
- Server: `node --check src/controllers/chat.controller.js` (plus `socket.js`, `auth.controller.js`, `friend.controller.js`, `push.controller.js`, `notify.js`, `messageScheduler.js`, `corsConfig.js`, `auth.middleware.js`).
- E2E: Playwright specs in `client/tests/` (`npx playwright test` with both dev servers running).
- Health: `GET /`, `/health`, `/api/health`, `/ping` return liveness + DB status.

### 9. Notes
- Translation prefers on-device AI (Chrome/Edge); other browsers use the server `gtx` fallback. First on-device use may download a language pack.
- GIF search needs `VITE_GIPHY_API_KEY`; without it the picker uses the built-in local catalog.
- Production requires `JWT_SECRET` and `MONGODB_URI`; the dev in-memory DB fallback is refused in production.
