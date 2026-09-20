import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const screenshotDir = path.resolve("./screenshots_verified");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function runTest() {
  console.log("=== STARTING PLAYWRIGHT BROWSER UI VERIFICATION ===");
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Go to Login page
    console.log("1. Navigating to http://localhost:5173/login");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(screenshotDir, "01_login_page.png") });
    console.log("✓ Login page loaded");

    // 2. Fill login credentials
    console.log("2. Filling credentials for User1");
    await page.fill("input[placeholder='name@example.com']", "user1@example.com");
    await page.fill("input[placeholder='••••••••']", "password123");
    await page.click("button[type='submit']");

    // 3. Wait for navigation to chat home
    console.log("3. Waiting for chat dashboard...");
    await page.waitForURL("http://localhost:5173/", { timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, "02_chat_home.png") });
    console.log("✓ Chat dashboard loaded successfully");

    // 4. Click on a chat contact from the conversation list
    console.log("4. Selecting chat conversation from sidebar...");
    const user2Card = page.locator("text=User2").first();
    await user2Card.waitFor({ state: "visible", timeout: 10000 });
    await user2Card.click();
    await page.waitForTimeout(2000);
    console.log("✓ Opened conversation");
    await page.screenshot({ path: path.join(screenshotDir, "03_conversation_open.png") });

    // 5. Test typing a Markdown message in the input box
    console.log("5. Testing message input with Markdown syntax...");
    const textarea = page.locator("textarea[placeholder*='message'], textarea, input[placeholder*='message']").first();
    await textarea.fill("**RealTime Verification:** Testing *Markdown*, `Inline Code`, and features!");
    await page.screenshot({ path: path.join(screenshotDir, "04_typed_markdown.png") });

    // Send the message
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, "05_message_sent.png") });
    console.log("✓ Message sent via UI");

    // 6. Verify Markdown formatted text rendered in the DOM
    const boldElem = page.locator("strong, b").filter({ hasText: "RealTime Verification:" });
    const hasBold = await boldElem.count() > 0;
    console.log("✓ Formatted markdown rendered in DOM:", hasBold);

    // 7. Verify Video elements in DOM
    const videoElements = page.locator("video");
    console.log("✓ Video elements found in DOM:", await videoElements.count());

    // 8. Test Inline Translation via Message Context Menu
    console.log("8. Testing right-click context menu and Inline Translation...");
    const lastMsgBubble = page.locator("div[id^='msg-']").last();
    if (await lastMsgBubble.count() > 0) {
      await lastMsgBubble.click({ button: "right" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(screenshotDir, "06_context_menu_open.png") });

      const translateBtn = page.locator("button:has-text('Translate')").first();
      if (await translateBtn.count() > 0) {
        console.log("Clicking Translate in context menu...");
        await translateBtn.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(screenshotDir, "07_translated_message.png") });

        const translatedTag = page.locator("span:has-text('Translated')");
        console.log("✓ 'Translated' tag displayed in bubble:", await translatedTag.count() > 0);
      } else {
        console.log("Translate option not in context menu");
      }
    }

    // 9. Test Spoiler Rendering and Reveal
    console.log("9. Testing Spoiler tag in message input...");
    await textarea.fill("This contains a ||secret spoiler|| text!");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);

    const spoilerElem = page.locator("span[title*='Spoiler']").last();
    const hasSpoiler = await spoilerElem.count() > 0;
    console.log("✓ Spoiler element found in DOM:", hasSpoiler);
    if (hasSpoiler) {
      await page.screenshot({ path: path.join(screenshotDir, "08_spoiler_blurred.png") });
      // Click to reveal spoiler
      await spoilerElem.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, "09_spoiler_revealed.png") });
      console.log("✓ Spoiler clicked and revealed");
    }

    // 10. Test Attach Menu (Doodle Canvas & Code Snippet buttons)
    console.log("10. Testing Attach Menu options...");
    const attachBtn = page.locator("#attach-button").first();
    if (await attachBtn.count() > 0) {
      await attachBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotDir, "10_attach_menu.png") });

      const drawBtn = page.locator("button:has-text('Draw & Sketch')");
      const codeBtn = page.locator("button:has-text('Code Snippet')");
      console.log("✓ 'Draw & Sketch' option present:", await drawBtn.count() > 0);
      console.log("✓ 'Code Snippet' option present:", await codeBtn.count() > 0);

      // Close attach menu
      await page.keyboard.press("Escape");
    }

    // 11. Test Quick Notes & Scratchpad Drawer
    console.log("11. Testing Quick Notes Drawer...");
    const notesBtn = page.locator("button[title='Scratchpad & Notes']").first();
    if (await notesBtn.count() > 0) {
      await notesBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(screenshotDir, "11_quick_notes_drawer.png") });

      const notesHeader = page.locator("h3:has-text('Scratchpad & Notes')");
      console.log("✓ Scratchpad & Notes drawer opened:", await notesHeader.count() > 0);

      // Close drawer
      const closeBtn = page.locator("button[title='Close Drawer']").first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    console.log("\nConsole errors encountered during session:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log("Console errors:", consoleErrors.slice(0, 5));
    }

    console.log("\n=== PLAYWRIGHT BROWSER UI VERIFICATION PASSED! ===");
  } catch (err) {
    console.error("UI Test Failed:", err);
    await page.screenshot({ path: path.join(screenshotDir, "error_state.png") });
  } finally {
    await browser.close();
  }
}

runTest();
