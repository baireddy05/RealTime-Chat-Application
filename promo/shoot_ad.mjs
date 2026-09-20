import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Shoots a real, dynamic ad video of the Pulse app: drives the live UI
// with Playwright (video recording on) through login -> chats -> send -> translate.
// Run from the client/ dir so `playwright` resolves (node promo_shoot... no:
// copy this file to client/ as promo_shoot.mjs, or run with NODE_PATH).
// Requires: backend on :5000, client on APP_PORT. Playwright browsers installed.

const APP_PORT = 5174; // client's vite --port (5173 was taken by another app)
const BASE = `http://localhost:${APP_PORT}`;

const __dir = path.dirname(fileURLToPath(import.meta.url));
// When run from client/, footage lands in ../promo/raw/
const rawDir = path.join(__dir, "../promo/raw");
fs.mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Smooth mouse glide (ad-style camera feel)
async function glide(page, x, y, steps = 40) {
  await page.mouse.move(x, y, { steps });
  await sleep(250);
}

async function beat(name, fn) {
  console.log(`--- BEAT: ${name} ---`);
  try {
    await fn();
  } catch (e) {
    console.log(`beat '${name}' skipped: ${e.message?.slice(0, 120)}`);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, // must match recordVideo size exactly
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();

await beat("welcome + login", async () => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await sleep(1500);
  await glide(page, 500, 400);
  await glide(page, 1400, 500);
  await glide(page, 1400, 640);
  await page.fill("input[placeholder='name@example.com']", "");
  await page.type("input[placeholder='name@example.com']", "user1@example.com", { delay: 55 });
  await sleep(400);
  await page.type("input[placeholder='••••••••']", "password123", { delay: 60 });
  await sleep(600);
  await glide(page, 1400, 740);
  await page.click("button[type='submit']");
  // Atlas can be slow on cold start — generous timeouts
  await page.waitForURL(`${BASE}/`, { timeout: 40000 });
  await page.locator("section[aria-label='Chats List'], div.overflow-y-auto.space-y-1").first().waitFor({ timeout: 20000 });
  await sleep(2000);
});

await beat("chat home reveal", async () => {
  await glide(page, 300, 300, 60);
  await sleep(800);
  // hover down the conversation list like a showcase
  for (const y of [350, 450, 550, 650, 750]) {
    await page.mouse.move(320, y, { steps: 25 });
    await sleep(600);
  }
  await sleep(1000);
});

await beat("open conversation", async () => {
  const list = page.locator("div.overflow-y-auto.space-y-1 > div, section[aria-label='Chats List'] div.cursor-pointer");
  await list.first().waitFor({ state: "visible", timeout: 10000 });
  const target = list.filter({ hasText: /User2|General Group/ }).first();
  const el = (await target.count()) > 0 ? target : list.first();
  await el.scrollIntoViewIfNeeded();
  await sleep(500);
  await el.click();
  await sleep(2500);
  // gentle scroll through messages
  await page.mouse.move(1300, 600);
  await page.mouse.wheel(0, -400);
  await sleep(1200);
  await page.mouse.wheel(0, 400);
  await sleep(1200);
});

await beat("typing + send", async () => {
  const box = page.locator("textarea[placeholder*='message'], textarea, input[placeholder*='message']").first();
  await box.click();
  await sleep(500);
  await page.type("textarea[placeholder*='message'], textarea", "This is Pulse — real-time, secure, beautiful!", { delay: 70 });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(2000);
});

await beat("context menu + translate", async () => {
  const bubble = page.locator("div[id^='msg-']").last();
  if ((await bubble.count()) === 0) throw new Error("no message bubble");
  await bubble.scrollIntoViewIfNeeded();
  await bubble.click({ button: "right" });
  await sleep(1200);
  const t = page.locator("button:has-text('Translate')").first();
  if ((await t.count()) > 0) {
    await t.hover();
    await sleep(600);
    await t.click();
    await sleep(2500);
  }
});

await beat("reactions + star", async () => {
  const bubble = page.locator("div[id^='msg-']").last();
  if ((await bubble.count()) === 0) throw new Error("no message bubble");
  await bubble.hover();
  await sleep(1200);
  // try quick reaction / star buttons if present
  for (const sel of ["button:has-text('⭐')", "button[aria-label*='tar' i]", "button[aria-label*='eact' i]"]) {
    const b = page.locator(sel).first();
    if ((await b.count()) > 0) {
      await b.hover();
      await sleep(500);
    }
  }
  await sleep(1000);
});

await beat("sidebar tour + finale", async () => {
  await glide(page, 60, 200, 30);
  await sleep(500);
  await glide(page, 60, 400, 30);
  await sleep(500);
  await glide(page, 960, 540, 50);
  await sleep(2000);
});

await context.close();
await browser.close();

// Playwright names the file <page>.webm — find it
const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".webm"));
console.log("RAW VIDEO FILES:", files);
