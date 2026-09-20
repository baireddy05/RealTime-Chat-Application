# Pulse — Dynamic Ad Video (no voiceover)

**Final:** `pulse_ad_final.mp4` — 1920x1080, 30 fps, ~62 s, H.264 + AAC, faststart (YouTube/LinkedIn-ready).

Real screen-recorded footage of the live app (login typing, chat home, opening a
conversation, typing + sending a message live, translate, reactions), cut ad-style
with speed ramps, animated lower-third captions, fades, an end card, and a
synthesized 124 BPM music bed. No voiceover.

## Timeline
| Final | Raw | Shot | Caption |
|---|---|---|---|
| 0–11 | 2–17 (1.35x) | Login typing | Pulse Web Messenger |
| 11–21 | 20–34 (1.4x) | Sign in → home | DMs + Groups, instantly |
| 21–29 | 40–52 (1.5x) | Chat list tour | (cont.) |
| 29–41 | 60–72 (1x) | Open convo, typing | Type it. Sent in milliseconds. |
| 41–55 | 72–86 (1x) | Send, translate | Translate anything in one click |
| 55–60 | 86–92 (1.3x) | Reactions, finale | React, star, keep flowing |
| 60–62 | — | End card | Feel the Pulse |

## Files
- `pulse_ad_final.mp4` — the ad
- `raw/page@*.webm` — original 93 s Playwright recording (25 fps VP8)
- `overlays/lt1–lt5.png`, `overlays/endcard.png` — caption cards (transparent PNG)
- `ad_music.wav` — 80 s synthesized bed (kick/hat/snare + bass + arp + pad)
- `shoot_ad.mjs` — the Playwright shoot script (copy to `client/` to run)
- `build_ad.py` — regenerates overlays + music

## Re-shoot (needs backend :5000 + client :5174)
```bash
cd client && npx vite --port 5174 --strictPort   # :5173 was taken by another app
# copy promo/shoot_ad.mjs -> client/, then:
node promo_shoot.mjs                             # footage -> promo/raw/*.webm
```

## Re-cut (from promo/)
```bash
# 1. six speed-ramped segments (see Timeline table for ss/t/speed)
# 2. concat -> main2.mp4; endcard clip -> end.mp4; concat -> film2.mp4 (62.2 s)
# 3. overlay lt1-lt5 with alpha fades + global fades + ad_music.wav (see session)
```

## Ideas
- 9:16 vertical cut for Reels/Shorts (`crop=1080:1920` + repositioned captions)
- 15 s teaser: login (4 s) → send (6 s) → endcard (5 s)
- Swap `ad_music.wav` for a licensed track; duck under nothing (no VO by design)
