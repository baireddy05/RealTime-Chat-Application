# Brag Plan — Pulse | RealTime Chat

Invocation: `@brag generate a promo video for this app` — no flags.
Parsed: tone=inferred (polished), format=landscape (1920x1080), duration=auto → 20s, music=on, sfx=on, title=`Pulse | RealTime Chat`, voice=off.

## Planning rubric (9 answers)

1. **What is it?** Pulse — MERN + Socket.io real-time messenger (DMs + Group Channels), E2EE client-side (AES-GCM 256), WebRTC audio/video calls, typing indicators, reactions, polls, voice notes, GIFs, file sharing.
2. **Who is it for?** Developers / teams / friends who want a fast, secure, self-hostable chat workspace. Shareable on LinkedIn / X / YouTube.
3. **Core promise?** `Connect seamlessly with Pulse` — "Experience the future of real-time communication with our beautifully crafted, ultra-fast messaging workspace." (WelcomePage.jsx:124-134)
4. **3 sharpest specifics?** (a) DMs + Groups, instantly via authenticated WebSockets; (b) E2EE Protected + typing / read-receipts / reactions; (c) Voice notes + HD video calls + files/GIFs/polls in one dark workspace.
5. **Key visual / show-the-thing?** Cyber Dark Mode (#050b14) + neon cyan #00f0ff / mint #00ff9d, Outfit font, glass chat bubbles (cyan outgoing, glass incoming). Recreated as native HTML mock — no screen-capture dependency.
6. **Hook (first 2s)?** `YOUR CHATS. AT THE SPEED OF THOUGHT.` — white on midnight + pulsing cyan dot. Determines retention.
7. **Tone?** polished (inferred). Serious, elegant. Clean type, slow holds, fast-in/hold cuts. No jokes — product is real infrastructure.
8. **Format / length?** Landscape 1920x1080, 30fps, 20.0s total. Readable: labels ≥0.8s settled, sentences ≥0.3s/word.
9. **Audio?** Music on: `assets/ad_music.wav` (synthesized 124 BPM bed from promo/, trimmed 0–20s, 0.6 gain). SFX on: CSS/GSAP pulse + typing dots (no external files).

No generic SaaS language. All copy from repo (`WelcomePage.jsx`, `FEATURES.md`, `index.html` title `Pulse | RealTime Chat`).

## Storyboard (sums to 20.0s)

| # | Time | Dur | Beat | On-screen text | Visual | Motion / SFX |
|---|------|-----|------|----------------|--------|--------------|
| 1 | 0.0–2.8 | 2.8s | Hook | eyebrow `PULSE • REALTIME CHAT` + `YOUR CHATS.` / `AT THE SPEED OF THOUGHT.` (cyan gradient on 2nd line) | midnight bg + 2 ambient glow spheres + pulsing cyan dot | fast-in y+opacity, hold 1.8s; dot scale pulse; whoosh in |
| 2 | 2.8–6.2 | 3.4s | Reveal | `Connect seamlessly` / `with Pulse` + sub `Ultra-fast messaging workspace.` + pills `Ultra-Fast Synchronous Engine` `E2EE Protected` | centered hero, glass pills | cross-fade, rise 24px, hold; pills stagger in |
| 3 | 6.2–10.2 | 4.0s | H1 — DMs + Groups | header `DMs + Groups, instantly` + sub `Authenticated sockets. Zero-LocalStorage JWT cookies.` | mock chat card: 3 bubbles (incoming `hey, are you online?`, outgoing `yep — Pulse is instant ⚡`, incoming `group created for launch 🚀`) | card slide-up, bubbles stagger 0.3s, hold 2.2s |
| 4 | 10.2–14.0 | 3.8s | H2 — Secure + alive | header `E2EE Protected. Alive.` + sub `Typing… read receipts… reactions.` | bubble + typing dots (3-dot wave) + reaction pill `❤️ 😂 👍` + `E2EE • AES-GCM 256` badge | typing dots loop, reaction pop-in, hold |
| 5 | 14.0–17.2 | 3.2s | H3 — Everything in one | header `Voice. Video. Files. GIFs. Polls.` + sub `Calls, voice notes, polls, file cards — one dark workspace.` | 5 glass chips `🎙️ Voice` `📹 Video calls` `📄 Files` `🎞️ GIFs` `📊 Polls` | chips stagger, hold |
| 6 | 17.2–20.0 | 2.8s | Outro | `Feel the Pulse` (gradient) + `Pulse \| RealTime Chat` + `E2EE • Socket.io • WebRTC • MERN` | end card, glow line | fade-up, glow sweep, hold to end |

Readability check: longest sentence (S3 sub, 6 words) holds 4.0s ≥ 1.8s required. All labels hold ≥2s settled.

## Music cue guidance

Track: `assets/ad_music.wav` (80s bed, kick/hat/snare + bass + arp). No bundled `cues/` preset found in skill dir (only SKILL.md ships) — cues detected at composition time.
Guidance only (story stays primary): downbeat ~0.0 → Hook in; bar ~2.8 → Reveal; ~6.2 / ~10.2 / ~14.0 → H1/H2/H3 cuts on beat; ~17.2 → outro swell; 20.0 cold end. Gain 0.6, no ducking (no VO).

## Composition brief (for Hyperframes)

- Single `index.html`, root `data-composition-id="main"`, 1920x1080, 20s, GSAP paused root timeline on `window.__timelines["main"]`.
- Only supported GSAP props (opacity, x, y, scale). Deterministic, no random/Date.
- Every timed visual: `class="clip"` + `data-start` + `data-duration`.
- Audio: `<audio src="assets/ad_music.wav" data-start="0" data-duration="20">` gain 0.6.
- Palette: bg #050b14, panel #0a1220, cyan #00f0ff, mint #00ff9d, white #ffffff, muted #8e8a97. Font: Outfit + system fallback.
- Must pass `npx hyperframes check` with zero errors, then `render -o ../brag.mp4`.
