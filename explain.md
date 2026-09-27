# Pulse Messenger — Explained (Literally Everything)

> A plain-English guide to the RealTime Chat Application built for the
> Navodita Infotech Full-Stack Development Internship (Sept 2026).
> No prior knowledge assumed. If you can use WhatsApp, you can follow this.

**Quick links:** Live app → `https://pulsechatmessenger.vercel.app` · Code → `https://github.com/baireddy05/RealTime-Chat-Application` · Demo logins → `LINKS.txt` · Full report → `PROJECT_REPORT.pdf`

---

## Table of contents

1. [What is this app?](#1-what-is-this-app)
2. [The 30-second tour](#2-the-30-second-tour)
3. [Tech stack (what each piece does)](#3-tech-stack-what-each-piece-does)
4. [Repository map](#4-repository-map)
5. [How it works — the big picture](#5-how-it-works--the-big-picture)
6. [Client deep-dive (the `client/` folder)](#6-client-deep-dive-the-client-folder)
7. [Theming: why every page matches](#7-theming-why-every-page-matches)
8. [End-to-end encryption, simply explained](#8-end-to-end-encryption-simply-explained)
9. [Chat lock (PIN), keyboard, and multi-device sync](#9-chat-lock-pin-keyboard-and-multi-device-sync)
10. [Translation and read-aloud](#10-translation-and-read-aloud)
11. [Calls (audio, video, group)](#11-calls-audio-video-group)
12. [Push notifications](#12-push-notifications)
13. [PWA — the "app without an app store"](#13-pwa--the-app-without-an-app-store)
14. [Server deep-dive (the `server/` folder)](#14-server-deep-dive-the-server-folder)
15. [Environment variables, one by one](#15-environment-variables-one-by-one)
16. [Run it on your own machine](#16-run-it-on-your-own-machine)
17. [Demo accounts + 2-minute evaluation script](#17-demo-accounts--2-minute-evaluation-script)
18. [Tests and checks](#18-tests-and-checks)
19. [Deployment (how the live site updates)](#19-deployment-how-the-live-site-updates)
20. [Troubleshooting / FAQ](#20-troubleshooting--faq)
21. [Glossary](#21-glossary)

---

## 1. What is this app?

**Pulse Messenger** is a WhatsApp-style chat app that runs in the browser (and installs like a phone app). You can:

- Chat 1-to-1 and in groups, in real time (no refresh button — messages just appear).
- Send photos, voice notes, video notes, PDFs/documents, GIFs, stickers, code snippets, sketches, contacts, polls, and live locations.
- Make audio/video calls, including group calls.
- Post 24-hour status stories, star messages, schedule messages, set reminders, broadcast to many people, and organize chats with labels, pins, and archive.
- Lock chats behind a PIN, encrypt message text end-to-end, translate messages on-device, and have messages read aloud.
- Restyle the entire app with 10 themes plus a custom-color studio with live preview.

It was built as the **one required task** for the Navodita Infotech Full-Stack internship (domain: Web Development, MERN stack), submitted via their Task Submission Google Form before 30/09/2026.

---

## 2. The 30-second tour

1. Open the live URL → sign up (or log in as a demo user).
2. Left column = chats (search, filters, archived, labels). Middle = the open conversation. On phones these become swipeable tabs.
3. The input bar: emoji/GIF/stickers, attach (photo, camera, document, contact, poll, code, sketch, location), voice-note mic, dictation mic, disappearing-message timer, scheduler, send.
4. ⋮ on any chat → mute, pin, archive, lock, notification tone, labels, contact info.
5. Rail/icons → calls history, status stories, starred messages, settings (appearance, sound, privacy), profile.

---

## 3. Tech stack (what each piece does)

| Layer | Technology | Why it exists |
|---|---|---|
| UI | React 19 + Vite | Builds the screens; Vite makes dev fast and production bundles small |
| State | Zustand (6 stores) | Holds logged-in user, chats, calls, friends, theme — one shared memory all components read |
| Styling | Tailwind CSS 3.4 + CSS variables | Every color comes from variables, so themes recolor the whole app instantly |
| Lists | react-virtuoso | Renders only visible messages, so 10,000-message chats stay smooth |
| Realtime | Socket.io | The "live wire": messages, typing dots, read receipts, call signals travel instantly |
| Backend | Node.js + Express.js | REST API (login, send, upload…) + serves the Socket.io wire |
| Database | MongoDB + Mongoose (13 models) | Users, messages, groups, calls, statuses, tasks, events, reminders, labels, reports, tokens |
| Doc storage | MongoDB GridFS (`pulse_docs`) | PDFs/Office/zip files live privately in your own DB with login-checked downloads |
| Media storage | Cloudinary | Photos/audio/video avatars on a CDN (fast worldwide) |
| Login sessions | JWT in HttpOnly cookies + bcryptjs | Passwords hashed (12 rounds); sessions are cookies browsers can't let JS touch |
| Message secrecy | Web Crypto AES-GCM 256-bit | Text is encrypted on your device before sending (see §8) |
| Calls | WebRTC peer-to-peer | Voice/video travels directly between devices; the server only introduces the callers |
| Push | Web Push (VAPID) + Firebase (FCM) | "You have a message" alerts even with the app closed |
| Installable | PWA (manifest + service worker) | Add-to-Home-Screen app, offline shell, background push handling |
| Tests | Playwright (7 spec files) | Robots that open real browsers and click through auth, chat, groups, files, settings |
| GIFs | Giphy API (+ offline catalog) | Trending/searchable GIFs and stickers; 34 built-ins work with no key |

---

## 4. Repository map

```
RealTime Chat Application/
├── README.md            # setup guide (start here to run it)
├── FEATURES.md          # every feature, the source of truth
├── PROJECT_REPORT.md    # long-form internship report (+ .pdf twin)
├── PROJECT_REPORT.pdf   # printable report for the Drive submission
├── LINKS.txt            # repo URL, live URL, demo logins
├── explain.md           # this file
│
├── client/              # the app you see (React + Vite + Tailwind + PWA)
│   ├── public/          # copied to the live site as-is
│   │   ├── manifest.json, sw.js, offline.html, favicon/logo icons
│   ├── src/
│   │   ├── pages/       # 4 screens: Welcome, Login, SignUp, Home
│   │   ├── components/  # ~47 UI pieces (Sidebar, ChatPane, 40+ modals/drawers)
│   │   ├── store/       # 6 Zustand stores (memory of the app)
│   │   ├── lib/         # 18 helper modules (crypto, sound, push, themes…)
│   │   ├── hooks/       # usePWAInstall
│   │   └── App.jsx + main.jsx  # routes + startup
│   ├── tests/           # 7 Playwright specs + helpers
│   ├── scripts/stamp-sw-dist.js # stamps the service worker per deploy
│   └── vercel.json      # SPA routing on Vercel
│
└── server/              # the API + live wire (Node + Express + Socket.io)
    ├── src/
    │   ├── routes/      # 7 route groups (auth, chat, upload, friends, status, calls, push)
    │   ├── controllers/ # 7 request handlers (the actual logic)
    │   ├── models/      # 13 database shapes
    │   ├── lib/         # socket.io setup, DB, CORS, push, scheduler…
    │   └── middleware/  # login guard (protectRoute)
    ├── seed.js          # demo users + General Group
    └── scripts/gen-vapid.js  # creates push keys
```

---

## 5. How it works — the big picture

```
  Your browser (React)                Server (Express)              MongoDB
 ┌──────────────────┐   REST /api    ┌──────────────────┐         ┌──────────┐
 │ ChatPane         │◄──────────────►│ chat.controller  │◄───────►│ Messages │
 │ Sidebar          │   Socket.io    │ socket.js        │         │ Users    │
 │ MessageInput     │◄═ ═ ═ ═ ═ ═ ═►│ (live wire)      │         │ Rooms…   │
 └────────┬─────────┘                └────────┬─────────┘         └──────────┘
          │ media upload                      │ docs (GridFS)
          ▼                                   ▼
   Cloudinary CDN                     pulse_docs bucket
```

**Sending a message:** you type → text is encrypted on your device → `POST /api/chat/...` (or socket) → saved in MongoDB → server pushes it through the socket to the other person's open tab → their device decrypts and renders it → delivery/read receipts flow back the same wire.

**A photo:** your browser gets a signed upload ticket → uploads straight to Cloudinary → only the URL is saved on the message. **A PDF:** uploads to *your* server instead (GridFS) so downloads stay private and login-checked.

**A call:** your browser asks the server "ring this user" over the socket → their screen rings → you swap WebRTC offers/answers/ICE through the socket → voice/video then flows directly between devices. The server logs the call for history.

---

## 6. Client deep-dive (the `client/` folder)

### Pages (`src/pages/`)
- **WelcomePage** — landing screen for logged-out visitors.
- **LoginPage / SignUpPage** — email-or-username + password forms.
- **HomePage** — the whole app shell after login: activity rail, sidebar, chat pane, all modals, PWA install wiring. Heavy modals load lazily (see `lib/lazyWithRetry.js`).

### Components (`src/components/`, grouped)
- **Chat core:** `Sidebar` (chat list, search, filters, ⋮ menus), `ChatPane` (message feed, date dividers, jump-to, export), `MessageBubble` (text/media/polls/location rendering, reactions, translate, read-aloud), `MessageInput` (composer: text, voice/video notes, dictation, GIFs, polls, code, sketches, schedule, timer), `SwipeableMessage` (swipe-to-reply), `MessageTicks` (sent/delivered/read), `FormattedMessageText` (rich text, spoilers, mentions, emoji).
- **Drawers/modals:** `SettingsModal` (appearance/sound/privacy), `ProfileModal`, `CustomColorsPreview`, `StarredDrawer`, `ThreadDrawer`, `TasksDrawer`, `QuickNotesDrawer`, `GroupInfoModal`, `CreateGroupModal`, `JoinGroupModal`, `BroadcastModal`, `ChannelsModal`, `ContactModal/Info/Card`, `ForwardModal`, `MessageInfoModal`, `RemindModal`, `ScheduledMessagesModal`, `LabelsManagerModal`, `ChatThemeModal`, `SetStatusModal`, `StatusModal`, `CallsModal`, `CallModal`, `IncomingCallModal`, `GroupCallModal`, `GifPicker`, `ImageModal`, `DrawSketchModal`, `CodeSnippetModal`, `AddFriendModal`, `LinkPreview(Card)`, `AudioMessagePlayer`, `ChatLockGate`, `PulseLogo`, `TypingPulseBackground`, `ErrorBoundary`.
- **Double-click a bubble** to quote-reply it on laptop (touch keeps swipe/long-press).

### Stores (`src/store/`, the app's memory)
- **useAuthStore** — who am I, login/signup/logout, the socket connection, online users.
- **useChatStore** — chats, messages, drafts, replies, reactions, polls, stars, threads, labels, pins, archive, tones, disappearing defaults, lock-session unlocks. The biggest one.
- **useFriendStore** — friends, requests, search, block/report.
- **useCallStore / useGroupCallStore** — 1-to-1 and group call state, streams, peer connections.
- **useThemeStore** — active theme + your custom colors, painted live onto the page.

### Helpers (`src/lib/`, one line each)
- `axios.js` — server client (cookies + token fallback, auto-logout on 401).
- `crypto.js` — AES-GCM encrypt/decrypt + per-conversation keys.
- `chatLock.js` — device PIN (SHA-256) + locked-chat lists + cross-device flag check.
- `uiThemes.js` — the 10 preset themes (all their colors).
- `uiCustomColors.js` — the ~50 recolorable fields + picker conversion math.
- `onDeviceTranslate.js` — free unlimited translation via Chrome/Edge built-in AI.
- `sound.js` — all chimes mathematically synthesized (no MP3s) + per-chat tones.
- `push.js` / `notification.js` — background + desktop notifications.
- `download.js` — multi-stage file downloader with fallbacks.
- `lazyWithRetry.js` — lazy chunks retry once (survives mid-deploy navigation).
- `gifCatalog.js` — 34 offline GIFs when no API key.
- `attachments.js` — is this a GIF/sticker/photo? + correct labels.
- `chatThemes.js` — per-chat doodle backgrounds.
- `backNavigation.js` — Android back button closes modals like a native app.
- `pulseShockwave.js`, `emoji.jsx`, `vcard.js` — typing ripples, emoji rendering, contact cards.

---

## 7. Theming: why every page matches

Older pages styled themselves with fixed black/white classes, so custom themes passed them by. Now **everything** reads from CSS variables:

- **10 presets** (`lib/uiThemes.js`): Midnight Pulse, Arctic Daylight, Deep Abyss, Sunset Ember, Paper & Pine, Royal Velvet, Crimson Dusk, Verdant Forest, Sakura Mist, Mint Frost.
- **Custom Colors studio** (Settings → Appearance): ~50 fields across backgrounds, text, both bubble sets, accents, presence dots, panels, borders, pills, sender colors. Tap a swatch → the whole UI repaints live and survives theme switches.
- **Standalone live preview**: a docked panel (left/right on desktop, popup on mobile) showing a mini-app mock plus every customizable element, so you see each pick land instantly.
- Rule for future pages: never hardcode `zinc-*`/amber/etc. — use `text-theme-main`, `text-theme-muted`, `text-accent-primary`, `bg-[var(--glass-*)]`, `border-[var(--glass-border)]`, `bg-[var(--pill-active-bg)]`.

---

## 8. End-to-end encryption, simply explained

Before a message leaves your device, it is locked with a key derived from the conversation (your ID + their ID, or the group ID) using AES-GCM 256-bit — the same grade banks use. The server only ever sees gibberish (`[e2ee]:…`). The other device, which derives the *same* key, unlocks it. If keys ever mismatch you see `[🔒 Encrypted Message]` instead of leaking anything. Images/files travel over HTTPS; only text bubbles are E2EE.

---

## 9. Chat lock (PIN), keyboard, and multi-device sync

- **Lock** any chat from its ⋮ menu (needs a 4-digit PIN first: Settings → Privacy).
- Locked chats show 🔒 and hide previews until unlocked — **per session** (logging out relocks everything).
- **PIN pad input:** tap digits, type `0-9` on a physical keyboard, `Backspace` deletes, `Escape` clears; on phones a hidden numeric field summons Gboard/Safari keyboard (tap the dots if it hides).
- **Sync:** locking also stores a `locked` flag in your server profile, so the gate appears on your phone too. **The PIN hash never leaves a device** — set the same PIN on each device once. Unlocking removes the flag everywhere.

---

## 10. Translation and read-aloud

- **Translate** (any message → language picker): tries **on-device AI first** (Chrome/Edge built-in Translator — free, unlimited, works offline; badge reads `on-device`), falling back to the server (Google `gtx` endpoint + cache; badge reads `server`). Results are cached per message so repeats are instant.
- **Read aloud**: the speaker icon uses your device's voices (`speechSynthesis`) — always free and unlimited, with a "Reading aloud…" pill and one-tap stop.

---

## 11. Calls (audio, video, group)

Tap phone/camera icons in any chat header. Voice/video goes directly between devices (WebRTC); the server only rings and relays handshake signals. Controls: mute, camera flip, speaker, screen share (desktop), floating emoji reactions, picture-in-picture. Group calls are a mesh — everyone connects to everyone. Every call lands in history with missed/declined/completed states, tap-to-redial, and missed-call notices inside the chat. Incoming calls also arrive as push notifications when the app is closed, with deep links back into the chat.

---

## 12. Push notifications

Two kinds: **in-app/desktop** toasts while you're browsing, and **background push** (Web Push/VAPID + Android FCM) that wakes closed tabs and installed apps. Tapping one deep-links straight to the chat or ringing call (`?chat=`, `?callFrom=`). Server settings live in Settings → Sound & Alerts; dead devices are pruned automatically.

---

## 13. PWA — the "app without an app store"

Install from the browser (⋮ → *Install Pulse PWA*, or address-bar install icon, or Add to Home Screen on phones) and it opens in its own window — no tabs or address bar. The service worker provides an offline shell, smart asset caching (per-deploy cache names, media never cached, error pages never cached), and push handling. If the app ever shows a crash screen, it offers Try again / Reload / Clear-cache-and-reload recovery.

---

## 14. Server deep-dive (the `server/` folder)

**Routes** (all under `/api`, login required unless noted):

| Prefix | Handles |
|---|---|
| `/auth` | signup, login, logout, session check, profile, public profiles |
| `/chat` | messages, groups, invites, reactions, polls, stars, threads, labels, pins, archive, preferences (tone/lock/disappearing), translate, reminders, events, tasks, search, receipts |
| `/upload` | signed Cloudinary tickets, GridFS document upload/download |
| `/friends` | requests, search, block/report |
| `/statuses` | 24-hour stories, views |
| `/calls` | call history |
| `/push` | push subscriptions, device tokens, config |
| `/`, `/health`, `/api/health`, `/ping` | uptime checks (no login) |

**Database models (13):** User, Message, Room, Status, CallLog, FriendRequest, BroadcastList, Event, Task, Reminder, Report, DeviceToken, PushSubscription.

**Live wire (`lib/socket.js`):** authenticated sockets; room joins (members only); throttled typing indicators with server-side usernames; delivery receipts; call + group-call signaling gated to participants; online presence.

**Scheduler (`lib/messageScheduler.js`):** every 3s delivers due scheduled messages (atomically claimed, so no duplicates), expires self-destructing messages, fires reminders.

**Security posture:** rate-limited auth (50/15min), CORS allow-list, JWT-secret required, uniform 401s (no user enumeration), participant checks on every message action, SSRF-guarded link/file proxying, capped payloads, validated inputs, no production in-memory-DB fallback.

---

## 15. Environment variables, one by one

**Server (`server/.env` — never commit this file):**

| Variable | What it is |
|---|---|
| `PORT` | Server port (`5000`) |
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string signing login sessions (required) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Image/audio hosting (free tier) |
| `CLIENT_URL` | Frontend URL(s), comma-separated, for CORS |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` | Background push keys (`npm run gen:vapid`) |
| `NODE_ENV` | `production` on the host (refuses unsafe fallbacks) |
| `FIREBASE_SERVICE_ACCOUNT` | Optional Android native push |
| `ALLOW_VERCEL_PREVIEWS` | `true` only if preview deployments need API access |
| `PLAYWRIGHT` | `1` to relax auth rate limits during test runs |

**Client (`client/.env` — baked in at build time, visible in the bundle):**

| Variable | What it is |
|---|---|
| `VITE_API_URL` | Where the API lives (e.g. `https://your-api.onrender.com`) |
| `VITE_GIPHY_API_KEY` | GIF search key (**Config**, never Secret — it's public by design) |

---

## 16. Run it on your own machine

```bash
# 1. Database: free MongoDB Atlas cluster → connection string.
# 2. Media: free Cloudinary account → cloud name + key + secret.
# 3. server/.env and client/.env as above, then:
cd server && npm install && npm run seed && npm run dev   # :5000
cd client && npm install && npm run dev                    # :5173
```

Open `http://localhost:5173`, sign up twice (two browsers), and chat. `npm run seed` (or just starting with an empty DB) creates `User1…User5 / password123` plus a General Group.

---

## 17. Demo accounts + 2-minute evaluation script

Logins: `User1/user1@example.com` … `User5/user5@example.com`, password `password123` for all.

1. Log in as User1 and User2 in two browsers → exchange text, an image, a PDF.
2. Hover a message → react; swipe/double-click → reply; ⋮ → star, forward, edit.
3. Start a voice/video call from the chat header.
4. Create a group, make a poll, schedule a message.
5. Settings → Appearance: switch themes, recolor bubbles, watch the live preview.
6. Lock a chat (⋮ → Lock), reopen it with the PIN.

---

## 18. Tests and checks

- **Client:** `cd client && npm run build` (production bundle), `npm run lint` (0 errors), `npx playwright test` (7 specs: auth, chat, groups, files, media, mobile navigation, settings/profile — needs both dev servers running).
- **Server:** `node --check src/controllers/chat.controller.js` (and socket/auth/friend/push/notify/scheduler/cors/middleware), plus `npm run test:push`, `test_calls_offline.mjs`, `test_features.mjs` smoke scripts.

---

## 19. Deployment (how the live site updates)

- **Frontend → Vercel**, auto-deploys every push to `main`. Each build stamps the service worker with the commit SHA so updates never mix old/new files.
- **Backend** → your Node host (Render/Railway/…), needs the server env table above.
- Rule learned the hard way: env vars bake in at *build* time — after changing one, you must **redeploy**, and `VITE_*` keys can never be secret.

---

## 20. Troubleshooting / FAQ

- **Tones won't change?** Fixed — repeat preference writes used to silently stick; now atomic. Re-lock once for old locks.
- **Chat opens on old messages?** Fixed — feed pins to latest until content settles; sort is NaN-safe.
- **GIF tab empty?** Needs `VITE_GIPHY_API_KEY` as **Config** (Secret is rejected for `VITE_*`); without it you get the 34-item offline catalog.
- **App opens in a browser tab, not a window?** Reinstall it (⋮ → Install Pulse PWA); launch from the OS icon, not the URL.
- **Red crash screen?** Use *Clear cache & reload* on it; reporting the Details stack helps.
- **Print-to-PDF broken (0x80070002)?** Re-enable the Windows feature (`Printing-PrintToPDFServices-Features`) — or just use the committed `PROJECT_REPORT.pdf`.
- **Locked chat on a new device asks for a PIN I never set there?** Expected — set the same PIN in Settings → Privacy on that device.

---

## 21. Glossary

- **MERN** — MongoDB, Express, React, Node.js.
- **Socket.io** — the always-on wire for instant events.
- **WebRTC** — direct browser-to-browser audio/video.
- **E2EE** — end-to-end encryption (§8).
- **VAPID/FCM** — web/Android push plumbing.
- **PWA** — installable website (§13).
- **GridFS** — files stored *inside* MongoDB.
- **JWT** — signed login token (HttpOnly cookie here).
- **Vite** — dev server + production bundler.
- **Zustand** — tiny React state library.
- **Playwright** — automated real-browser tests.
