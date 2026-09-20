from PIL import Image, ImageDraw, ImageFont
import os, wave, struct, math

BASE = os.path.dirname(os.path.abspath(__file__))
OV = os.path.join(BASE, "overlays")
os.makedirs(OV, exist_ok=True)
W, H = 1920, 1080
FD = r"C:\Windows\Fonts"
def F(n, s):
    try: return ImageFont.truetype(os.path.join(FD, n), s)
    except: return ImageFont.load_default()

T_TITLE, T_SUB = F("arialbd.ttf", 56), F("arial.ttf", 33)
T_END, T_ENDSUB = F("arialbd.ttf", 150), F("arial.ttf", 44)
TEAL = (45, 212, 191, 255)
WHITE = (255, 255, 255, 255)
GRAY = (175, 185, 200, 255)

CARDS = [
  ("Pulse Web Messenger", "Real-time chat. Secure. Beautiful."),
  ("DMs + Groups, instantly", "Typing indicators, read receipts, live presence."),
  ("Type it. Sent in milliseconds.", "Markdown, emoji, instant delivery."),
  ("Translate anything in one click", "Right-click any message. Done."),
  ("React, star, keep flowing", "Feel the Pulse — try the live demo."),
]
for i, (t, s) in enumerate(CARDS, 1):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x, y, w, h = 90, 848, 1230, 150
    d.rounded_rectangle([x, y, x + w, y + h], radius=28, fill=(10, 15, 28, 215))
    d.rounded_rectangle([x, y, x + 14, y + h], radius=7, fill=TEAL)
    d.text((x + 48, y + 22), t, font=T_TITLE, fill=WHITE)
    d.text((x + 48, y + 92), s, font=T_SUB, fill=GRAY)
    img.save(os.path.join(OV, f"lt{i}.png"))
    print("wrote", f"lt{i}.png")

# end card (opaque)
img = Image.new("RGB", (W, H), (7, 11, 24))
d = ImageDraw.Draw(img)
d.ellipse([-400, -250, 700, 750], fill=(14, 60, 70))
d.ellipse([1300, 450, 2300, 1300], fill=(18, 30, 70))
d.text((W // 2, 400), "Feel the Pulse", font=T_END, fill=WHITE, anchor="mm")
d.text((W // 2, 540), "Pulse Web Messenger — Real-time. Secure. Beautiful.", font=T_ENDSUB, fill=GRAY, anchor="mm")
d.text((W // 2, 620), "MERN  •  Socket.io  •  WebRTC  •  Cloudinary", font=T_ENDSUB, fill=TEAL, anchor="mm")
d.rounded_rectangle([W // 2 - 260, 700, W // 2 + 260, 780], radius=40, fill=TEAL)
d.text((W // 2, 740), "Try the live demo", font=F("arialbd.ttf", 40), fill=(5, 10, 20), anchor="mm")
img.save(os.path.join(OV, "endcard.png"))
print("wrote endcard.png")

# --- upbeat ad music, 80 s, 124 BPM ---
sr, dur, out = 44100, 80, os.path.join(BASE, "ad_music.wav")
bpm, beat = 124, 60 / 124
bass = [55.0, 55.0, 65.41, 49.0]          # A1 A1 C2 G1
arp = [220.0, 261.63, 329.63, 440.0, 329.63, 261.63]
frames = []
n = int(sr * dur)
for i in range(n):
    t = i / sr
    b = int(t / beat)
    bt = t % beat
    kick = math.exp(-bt * 38) * math.sin(2 * math.pi * 55 * bt)
    hat = math.exp(-(t % (beat / 2)) * 120) * 0.10
    snare = math.exp(-((t + beat / 2) % beat) * 60) * 0.10 if ((t + beat / 2) % beat) < 0.2 else 0
    f0 = bass[(b // 4) % 4]
    bassn = (math.sin(2 * math.pi * f0 * t) * 0.6 + math.sin(2 * math.pi * f0 * 2 * t) * 0.25) * math.exp(-bt * 3)
    fa = arp[(b * 2) % len(arp)]
    at = t % (beat / 2)
    arpn = math.sin(2 * math.pi * fa * t) * math.exp(-at * 14) * 0.35
    pad = sum(math.sin(2 * math.pi * fr * t) for fr in (110.0, 130.81, 164.81)) / 3 * 0.10
    v = (kick * 0.9 + hat + snare + bassn * 0.5 + arpn + pad) * 0.30
    if t < 1.5: v *= t / 1.5
    if t > dur - 3: v *= max(0, (dur - t) / 3)
    frames.append(struct.pack("<h", int(max(-1, min(1, v)) * 32767)))
with wave.open(out, "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b"".join(frames))
print("wrote ad_music.wav")
