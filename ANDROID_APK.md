# Pulse Messenger on Android — PWA install & APK build guide

You have **two** ways to get Pulse on an Android phone like a native app:

| | **A. Install as PWA (recommended, 2 min)** | **B. Build a real APK** |
|---|---|---|
| What you get | App icon, splash screen, fullscreen, **background push for messages & calls** | Same, plus Play-Store-style install, FCM push when fully closed, native share sheet |
| Needs | Just the deployed site on HTTPS | Android Studio (or SDK CLI) + ~30 min first time |
| Calls | Work while app is open/backgrounded; ringing via push if opened in time | Same, plus high-priority FCM wake for killed app |

Both paths use the **same backend**. Push works without Firebase for browsers/PWA; the APK additionally supports Firebase (FCM) for killed-app delivery.

---

## Path A — Install as PWA (no build tools)

1. Deploy backend + frontend on HTTPS (Vercel/Render/your VPS).
2. Server `.env` must contain VAPID keys (see "Server setup" below).
3. On the phone, open the site in Chrome → ⋮ menu → **Add to Home screen** (or **Install app**).
4. Open the installed app → **Settings → Enable** under *Background Push Notifications* (grants the OS permission + registers the device).
5. Test: from another account, send a message while the app is closed → notification arrives, tap opens the chat.

---

## Path B — Build the APK with Capacitor

The native shell is already scaffolded (`client/capacitor.config.json`, `client/android/`, plugins: App, Push-Notifications, Splash-Screen).

### B1. Prerequisites (one time, on your dev machine)

1. **Node.js 20+** (you have it) and **Java 17** (Temurin/Adoptium or Android Studio's bundled JDK).
2. **Android SDK**: easiest via **Android Studio → SDK Manager** — install *Android SDK Platform 34+*, *Build-Tools*, *Platform-Tools*. Or CLI only:
   - Download `commandlinetools-*_latest.zip`, unzip to `Android/Sdk/cmdline-tools/latest/`
   - `sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`
3. Set env vars:
   - `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) → your `Android/Sdk` folder
   - Add `platform-tools` to `PATH` (for `adb install`)
4. Accept licenses: `sdkmanager --licenses` (or open Android Studio once).

### B2. Point the app at your PUBLIC backend (critical)

`VITE_API_URL` is baked into the APK at build time — `localhost` will **not** work on a real phone.

```bash
# client/.env  (use your real https backend URL)
VITE_API_URL=https://your-api.example.com/api
```

Auth inside the WebView uses the **Bearer-token fallback** (cookies don't persist cross-origin in WebViews) — already implemented in `axios.js` + socket `auth.token`. Nothing to change.

### B3. CORS: allow the native origin

The Capacitor WebView origin is **not** your website — add it to the server allow-list:

```env
# server/.env (comma-separated is supported)
CLIENT_URL=https://your-frontend.example.com,capacitor://localhost,https://localhost,http://localhost
```

(`capacitor://localhost` = iOS-style origin, `https/http://localhost` = Android WebView origins depending on version. Listing all three is safe.)

### B4. Firebase (FCM) — enables killed-app push + call wakeups

Without this step the APK still works fully while open/backgrounded, and Web Push covers the PWA. FCM adds delivery when the app process is dead.

1. [Firebase Console](https://console.firebase.google.com/) → create project → **Add Android app**, package name **`com.pulse.messenger`**.
2. Download **`google-services.json`** → place at `client/android/app/google-services.json` (never commit it).
3. In `client/android/build.gradle`, add the Google services classpath:
   ```gradle
   buildscript {
     dependencies {
       classpath 'com.google.gms:google-services:4.4.2'
     }
   }
   ```
   and at the **bottom** of `client/android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
4. Server `.env`: `FIREBASE_SERVICE_ACCOUNT=<full JSON string, or absolute path to the service-account file>`.
5. Verify at runtime: `GET /api/push/config` (authed) should report `"fcm": true`.

### B5. Build & install

```bash
cd client
npm run build          # production web bundle with YOUR backend URL
npx cap sync android   # copy web assets + plugins into the native project

# Debug APK (installable immediately, no signing):
cd android
./gradlew assembleDebug        # Linux/macOS
.\gradlew.bat assembleDebug    # Windows
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or open `client/android` in **Android Studio** and press **Run ▶** (auto-signs debug, installs on USB device).

First launch checklist on the phone:
1. Log in → grant **Notifications** when asked (Settings shows Background Push status).
2. Grant **Microphone/Camera** on first call (runtime prompt).
3. For reliable call wakeups: Settings → Apps → Pulse → Battery → **Unrestricted**.

### B6. Release / Play Store build

1. `keytool -genkeypair -alias pulse -keyalg RSA -keysize 2048 -validity 10950 -keystore pulse-release.keystore`
2. Create `client/android/keystore.properties` (never commit):
   ```properties
   storeFile=/absolute/path/pulse-release.keystore
   storePassword=***
   keyAlias=pulse
   keyPassword=***
   ```
3. Wire it in `client/android/app/build.gradle` (`signingConfigs` + `buildTypes.release.signingConfig`), then `.\gradlew.bat bundleRelease` → upload the `.aab` to Play Console.
4. Play Console → add testers; for production you also need a **Data safety** declaration (contacts, microphone, camera, notifications) and a privacy policy URL.

---

## Server setup (both paths)

```bash
cd server
npm run gen:vapid     # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
```

```env
# server/.env additions
VAPID_PUBLIC_KEY=<from generator>
VAPID_PRIVATE_KEY=<keep secret>
VAPID_SUBJECT=mailto:you@example.com
# Optional (native killed-app push only):
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ...}
```

Verify: `GET /api/push/config` returns `{ "webPush": true, "fcm": true/false }`.

### How push flows (privacy design)

- Message bodies are **E2EE-encrypted** — the server never sees text, so push previews are type labels only ("📷 Photo", "New message", …).
- Push is sent **only to devices with no live socket** (online devices get the socket event; notification tags dedupe the rest).
- Blocked contacts can't trigger pushes (send/call is rejected before fan-out).
- Dead endpoints (410/404) and dead FCM tokens are **auto-pruned**; every transport failure is isolated so messaging never breaks.
- Logout unregisters the device (push sub + FCM token).

### Honest WhatsApp-parity notes

- **Background chats/messages:** full parity (push → tap → chat opens).
- **Calls:** ringing works app-open/backgrounded. From a killed app, tapping the incoming-call push opens the app; if you're within the 45s ring window the call screen appears live, otherwise you'll see the missed-call entry — same as the web app today.
- **FCM without google-services.json:** registration fails gracefully and the app keeps working; nothing crashes.
