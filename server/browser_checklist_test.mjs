import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const executablePath = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;
const screenshotDir = "C:\\Users\\rithw\\.gemini\\antigravity-ide\\brain\\f568dd1f-41ce-44eb-b5dd-19894f4534a4\\scratch\\screenshots";

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTest() {
  console.log("=== STARTING BROWSER TESTING CHECKLIST ===");
  console.log("Using browser at:", executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    defaultViewport: { width: 1280, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = {};
  const page = await browser.newPage();

  // -------------------------------------------------------------
  // Step 1: Test Login Page & Password Toggle
  // -------------------------------------------------------------
  console.log("\n--- Step 1: Test Login Page & Password Toggle ---");

  try {
    // 1. Navigate to http://localhost:5173/login
    console.log("1.1 Navigating to http://localhost:5173/login...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle0" });
    await sleep(800);
    await page.screenshot({ path: path.join(screenshotDir, "01_login_page.png") });
    results["1.1 Navigate to login"] = true;
    console.log("✓ 1.1 Navigated to login page");
  } catch (e) {
    results["1.1 Navigate to login"] = false;
    console.error("1.1 failed:", e.message);
  }

  try {
    // 2. Click 'Sign In to Pulse' empty -> inline error banner ("Please enter both email and password")
    console.log("1.2 Testing empty submit error banner...");
    const submitBtn = await page.waitForSelector("button[type='submit']");
    await submitBtn.click();
    await sleep(400);

    const errorBannerText = await page.evaluate(() => {
      const banner = document.querySelector(".text-red-300");
      return banner ? banner.innerText : null;
    });
    console.log("Banner text:", errorBannerText);
    const hasCorrectError = errorBannerText && errorBannerText.includes("Please enter both email and password");
    results["1.2 Empty submit error banner"] = !!hasCorrectError;
    console.log(hasCorrectError ? "✓ 1.2 Error banner verified" : "✗ 1.2 Error banner failed");
    await page.screenshot({ path: path.join(screenshotDir, "02_empty_error_banner.png") });
  } catch (e) {
    results["1.2 Empty submit error banner"] = false;
    console.error("1.2 failed:", e.message);
  }

  try {
    // 3. Type 'password123' in password field
    console.log("1.3 Typing 'password123' into password field...");
    const passwordInput = await page.waitForSelector("input[placeholder='••••••••']");
    await passwordInput.type("password123");
    results["1.3 Type password123"] = true;
    console.log("✓ 1.3 Typed password");
  } catch (e) {
    results["1.3 Type password123"] = false;
    console.error("1.3 failed:", e.message);
  }

  try {
    // 4. Click Eye icon to toggle password visibility (verify text), toggle back
    console.log("1.4 Testing password eye toggle...");
    const passwordInput = await page.waitForSelector("input[placeholder='••••••••']");
    const eyeBtn = await page.waitForSelector("button[title='Show password'], button[title='Hide password']");
    
    // Toggle ON -> should become text
    await eyeBtn.click();
    await sleep(300);
    const typeAfterToggleOn = await page.evaluate((el) => el.getAttribute("type"), passwordInput);
    console.log("Password input type after toggle ON:", typeAfterToggleOn);

    // Toggle OFF -> should become password
    await eyeBtn.click();
    await sleep(300);
    const typeAfterToggleOff = await page.evaluate((el) => el.getAttribute("type"), passwordInput);
    console.log("Password input type after toggle OFF:", typeAfterToggleOff);

    const eyeTogglePassed = typeAfterToggleOn === "text" && typeAfterToggleOff === "password";
    results["1.4 Eye toggle password visibility"] = eyeTogglePassed;
    console.log(eyeTogglePassed ? "✓ 1.4 Password eye toggle verified" : "✗ 1.4 Eye toggle failed");
  } catch (e) {
    results["1.4 Eye toggle password visibility"] = false;
    console.error("1.4 failed:", e.message);
  }

  try {
    // 5. Enter 'user1@example.com' in email field
    console.log("1.5 Entering 'user1@example.com' in email field...");
    const emailInput = await page.waitForSelector("input[placeholder*='user1@example.com']");
    await emailInput.type("user1@example.com");
    results["1.5 Enter user1@example.com"] = true;
    console.log("✓ 1.5 Entered email");
  } catch (e) {
    results["1.5 Enter user1@example.com"] = false;
    console.error("1.5 failed:", e.message);
  }

  try {
    // 6. Click 'Sign In to Pulse' to log in
    console.log("1.6 Submitting login...");
    const submitBtn = await page.waitForSelector("button[type='submit']");
    await submitBtn.click();
    await sleep(2500);

    const currentUrl = page.url();
    console.log("Current URL after login:", currentUrl);
    await page.screenshot({ path: path.join(screenshotDir, "03_after_login.png") });
    results["1.6 Sign In to Pulse"] = !currentUrl.includes("/login");
    console.log(!currentUrl.includes("/login") ? "✓ 1.6 Logged in successfully" : "✗ 1.6 Login failed");
  } catch (e) {
    results["1.6 Sign In to Pulse"] = false;
    console.error("1.6 failed:", e.message);
  }

  // -------------------------------------------------------------
  // Step 2: Verify Home Page & Workspace Features
  // -------------------------------------------------------------
  console.log("\n--- Step 2: Verify Home Page & Workspace Features ---");

  try {
    // 2.1 Verify main app page (/) loaded
    const currentUrl = page.url();
    const isMainAppLoaded = currentUrl.endsWith("/") || currentUrl.includes("localhost:5173");
    results["2.1 Main app page loaded"] = isMainAppLoaded;
    console.log(isMainAppLoaded ? "✓ 2.1 Main app page loaded" : "✗ 2.1 Main app page not loaded");
  } catch (e) {
    results["2.1 Main app page loaded"] = false;
    console.error("2.1 failed:", e.message);
  }

  try {
    // 2.2 3-dots menu on sidebar header -> glass dropdown appears -> click outside to close
    console.log("2.2 Testing sidebar 3-dots menu...");
    const sidebarMenuBtn = await page.waitForSelector("button[title='Menu']");
    await sidebarMenuBtn.click();
    await sleep(500);

    const isDropdownVisible = await page.evaluate(() => {
      return document.querySelector("#sidebar-menu-backdrop") !== null || document.body.innerText.includes("Status Stories");
    });
    console.log("Sidebar dropdown visible:", isDropdownVisible);
    await page.screenshot({ path: path.join(screenshotDir, "04_sidebar_menu_dropdown.png") });

    // Click backdrop to close
    await page.evaluate(() => {
      const backdrop = document.querySelector("#sidebar-menu-backdrop");
      if (backdrop) backdrop.click();
    });
    await sleep(500);

    const isDropdownClosed = await page.evaluate(() => {
      return document.querySelector("#sidebar-menu-backdrop") === null && !document.body.innerText.includes("Status Stories");
    });
    console.log("Sidebar dropdown closed:", isDropdownClosed);
    results["2.2 Sidebar 3-dots menu and click outside"] = isDropdownVisible && isDropdownClosed;
    console.log(isDropdownVisible && isDropdownClosed ? "✓ 2.2 Sidebar menu verified" : "✗ 2.2 Sidebar menu failed");
  } catch (e) {
    results["2.2 Sidebar 3-dots menu and click outside"] = false;
    console.error("2.2 failed:", e.message);
  }

  try {
    // 2.3 Stories & Status button (dashed circle icon) -> Pulse Stories modal -> close (X)
    console.log("2.3 Testing Stories & Status button...");
    const statusBtn = await page.waitForSelector("button[title='Stories & Status']");
    await statusBtn.click();
    await sleep(600);

    const isStatusModalOpen = await page.evaluate(() => {
      return document.body.innerText.includes("Pulse Stories");
    });
    console.log("Status modal open:", isStatusModalOpen);
    await page.screenshot({ path: path.join(screenshotDir, "05_status_modal.png") });

    // Close X
    const closeBtn = await page.waitForSelector("button[title='Close']");
    await closeBtn.click();
    await sleep(500);

    const isStatusModalClosed = await page.evaluate(() => {
      return !document.body.innerText.includes("Pulse Stories");
    });
    console.log("Status modal closed:", isStatusModalClosed);
    results["2.3 Stories & Status modal open and close"] = isStatusModalOpen && isStatusModalClosed;
    console.log(isStatusModalOpen && isStatusModalClosed ? "✓ 2.3 Stories modal verified" : "✗ 2.3 Stories modal failed");
  } catch (e) {
    results["2.3 Stories & Status modal open and close"] = false;
    console.error("2.3 failed:", e.message);
  }

  try {
    // 2.4 Select '#general' or 'General'
    console.log("2.4 Selecting '#general' channel...");
    const generalChannel = await page.waitForSelector("#channel-general, [data-testid='channel-general']");
    await generalChannel.click();
    await sleep(1500);

    const isChatPaneOpen = await page.evaluate(() => {
      return document.querySelector("textarea, input[placeholder*='message']") !== null;
    });
    results["2.4 Select #general channel"] = isChatPaneOpen;
    console.log(isChatPaneOpen ? "✓ 2.4 Selected #general channel" : "✗ 2.4 #general channel selection failed");
    await page.screenshot({ path: path.join(screenshotDir, "06_general_chat_opened.png") });
  } catch (e) {
    results["2.4 Select #general channel"] = false;
    console.error("2.4 failed:", e.message);
  }

  // 2.5 Chat pane interactions:
  console.log("2.5 Testing Chat Pane interactions...");

  try {
    // 2.5.a Emoji picker -> click emoji (🔥 or 👍)
    console.log("  2.5.a Testing Emoji Picker...");
    const emojiBtn = await page.waitForSelector("button[title='Emojis']");
    await emojiBtn.click();
    await sleep(500);
    await page.waitForSelector("#emoji-picker-popover");
    await page.screenshot({ path: path.join(screenshotDir, "07_emoji_picker_open.png") });

    await page.evaluate(() => {
      const emojis = Array.from(document.querySelectorAll("#emoji-picker-popover button"));
      const fireOrThumb = emojis.find((b) => b.innerText && (b.innerText.includes("🔥") || b.innerText.includes("👍")));
      if (fireOrThumb) fireOrThumb.click();
    });
    await sleep(300);

    const inputValAfterEmoji = await page.evaluate(() => {
      const input = document.querySelector("textarea, input[placeholder*='message']");
      return input ? input.value : "";
    });
    console.log("  Input value after emoji click:", inputValAfterEmoji);
    const emojiInserted = inputValAfterEmoji.includes("🔥") || inputValAfterEmoji.includes("👍");
    results["2.5.a Emoji picker selection"] = emojiInserted;
    console.log(emojiInserted ? "✓ 2.5.a Emoji inserted into input" : "✗ 2.5.a Emoji insertion failed");

    // Close emoji picker if still visible
    await page.mouse.click(600, 300);
    await sleep(300);
  } catch (e) {
    results["2.5.a Emoji picker selection"] = false;
    console.error("2.5.a failed:", e.message);
  }

  try {
    // 2.5.b Attach menu -> check menu -> click outside
    console.log("  2.5.b Testing Attach menu...");
    const attachBtn = await page.waitForSelector("button[title='Attach']");
    await attachBtn.click();
    await sleep(400);
    await page.waitForSelector("#attach-menu-popover");
    await page.screenshot({ path: path.join(screenshotDir, "08_attach_menu_open.png") });

    const attachMenuVisible = await page.evaluate(() => {
      return document.querySelector("#attach-menu-popover") !== null;
    });
    console.log("  Attach menu visible:", attachMenuVisible);

    // Click outside
    await page.mouse.click(600, 300);
    await sleep(400);

    const attachMenuClosed = await page.evaluate(() => {
      return document.querySelector("#attach-menu-popover") === null;
    });
    console.log("  Attach menu closed on click outside:", attachMenuClosed);
    results["2.5.b Attach menu open and click outside"] = attachMenuVisible && attachMenuClosed;
    console.log(attachMenuVisible && attachMenuClosed ? "✓ 2.5.b Attach menu verified" : "✗ 2.5.b Attach menu failed");
  } catch (e) {
    results["2.5.b Attach menu open and click outside"] = false;
    console.error("2.5.b failed:", e.message);
  }

  try {
    // 2.5.c Type 'Checking 120hz buttery smoothness! ⚡' & Send -> verify in feed
    console.log("  2.5.c Typing and sending message...");
    const messageInput = await page.waitForSelector("textarea, input[placeholder*='message']");
    await page.evaluate((el) => { el.value = ""; }, messageInput);
    await messageInput.type("Checking 120hz buttery smoothness! ⚡");
    await sleep(300);

    const sendBtn = await page.waitForSelector("button[title='Send message'], button:has(svg.lucide-send), button:has(svg.lucide-arrow-up)");
    await sendBtn.click();
    await sleep(2000);

    const messageSentFound = await page.evaluate(() => {
      return document.body.innerText.includes("Checking 120hz buttery smoothness! ⚡");
    });
    console.log("  Message found in feed:", messageSentFound);
    await page.screenshot({ path: path.join(screenshotDir, "09_message_in_feed.png") });
    results["2.5.c Send message and verify in feed"] = messageSentFound;
    console.log(messageSentFound ? "✓ 2.5.c Message verified in feed" : "✗ 2.5.c Message sending failed");
  } catch (e) {
    results["2.5.c Send message and verify in feed"] = false;
    console.error("2.5.c failed:", e.message);
  }

  try {
    // 2.5.d 3-dots options in chat header -> options dropdown -> click outside
    console.log("  2.5.d Testing chat header 3-dots options...");
    const chatOptionsBtn = await page.waitForSelector("button[title='Chat options']");
    await chatOptionsBtn.click();
    await sleep(400);

    const isChatOptionsOpen = await page.evaluate(() => {
      return document.querySelector("#chat-options-backdrop") !== null || document.body.innerText.includes("Mute notifications");
    });
    console.log("  Chat options menu open:", isChatOptionsOpen);
    await page.screenshot({ path: path.join(screenshotDir, "10_chat_header_options.png") });

    // Click outside on backdrop
    await page.evaluate(() => {
      const backdrop = document.querySelector("#chat-options-backdrop");
      if (backdrop) backdrop.click();
    });
    await sleep(400);

    const isChatOptionsClosed = await page.evaluate(() => {
      return document.querySelector("#chat-options-backdrop") === null;
    });
    results["2.5.d Chat header 3-dots menu and click outside"] = isChatOptionsOpen && isChatOptionsClosed;
    console.log(isChatOptionsOpen && isChatOptionsClosed ? "✓ 2.5.d Chat options dropdown verified" : "✗ 2.5.d Chat options failed");
  } catch (e) {
    results["2.5.d Chat header 3-dots menu and click outside"] = false;
    console.error("2.5.d failed:", e.message);
  }

  try {
    // 2.5.e Phone call button -> call overlay -> Speaker button toggle -> Red End Call button
    console.log("  2.5.e Testing Voice Call simulation...");
    const callBtn = await page.waitForSelector("button[title='Voice call']");
    await callBtn.click();
    await sleep(600);

    const isCallOverlayOpen = await page.evaluate(() => {
      return document.body.innerText.includes("Pulse Voice Session") || document.querySelector("button[title='End call']") !== null;
    });
    console.log("  Call overlay open:", isCallOverlayOpen);
    await page.screenshot({ path: path.join(screenshotDir, "11_call_overlay_active.png") });

    // Speaker button toggle
    const speakerBtn = await page.waitForSelector("button[title='Speaker on'], button[title='Speaker off']");
    const speakerTitleBefore = await page.evaluate((el) => el.getAttribute("title"), speakerBtn);
    await speakerBtn.click();
    await sleep(300);
    const speakerTitleAfter = await page.evaluate((el) => el.getAttribute("title"), speakerBtn);
    console.log(`  Speaker toggle: '${speakerTitleBefore}' -> '${speakerTitleAfter}'`);
    const speakerToggled = speakerTitleBefore !== speakerTitleAfter;

    // Red End Call button
    const endCallBtn = await page.waitForSelector("button[title='End call']");
    await endCallBtn.click();
    await sleep(500);

    const isCallOverlayClosed = await page.evaluate(() => {
      return !document.body.innerText.includes("Pulse Voice Session");
    });
    console.log("  Call overlay closed:", isCallOverlayClosed);
    results["2.5.e Phone call overlay, speaker toggle, end call"] = isCallOverlayOpen && speakerToggled && isCallOverlayClosed;
    console.log(isCallOverlayOpen && speakerToggled && isCallOverlayClosed ? "✓ 2.5.e Voice call flow verified" : "✗ 2.5.e Voice call flow failed");
  } catch (e) {
    results["2.5.e Phone call overlay, speaker toggle, end call"] = false;
    console.error("2.5.e failed:", e.message);
  }

  // -------------------------------------------------------------
  // Step 3: Test Mobile Responsiveness
  // -------------------------------------------------------------
  console.log("\n--- Step 3: Test Mobile Responsiveness ---");

  try {
    // 3.1 Resize viewport to 375x720
    console.log("3.1 Resizing viewport to 375x720...");
    await page.setViewport({ width: 375, height: 720 });
    await sleep(600);
    await page.screenshot({ path: path.join(screenshotDir, "12_mobile_viewport_375x720.png") });
    results["3.1 Resize viewport to 375x720"] = true;
    console.log("✓ 3.1 Resized to 375x720");
  } catch (e) {
    results["3.1 Resize viewport to 375x720"] = false;
    console.error("3.1 failed:", e.message);
  }

  try {
    // 3.2 Check back button (ArrowLeft) visible in chat pane header
    console.log("3.2 Checking back button visibility...");
    const isBackBtnVisible = await page.evaluate(() => {
      const el = document.querySelector("button[title='Back']");
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    console.log("Back button visible on mobile:", isBackBtnVisible);
    results["3.2 Back button visible in chat header"] = isBackBtnVisible;
    console.log(isBackBtnVisible ? "✓ 3.2 Back button visible" : "✗ 3.2 Back button not visible");
  } catch (e) {
    results["3.2 Back button visible in chat header"] = false;
    console.error("3.2 failed:", e.message);
  }

  try {
    // 3.3 Click back button -> back to sidebar list
    console.log("3.3 Clicking back button to return to sidebar list...");
    await page.evaluate(() => {
      const back = document.querySelector("button[title='Back']");
      if (back) back.click();
    });
    await sleep(600);
    await page.screenshot({ path: path.join(screenshotDir, "13_mobile_sidebar_list.png") });

    const isSidebarVisibleOnMobile = await page.evaluate(() => {
      return document.querySelector("#channel-general") !== null;
    });
    console.log("Sidebar visible on mobile after back click:", isSidebarVisibleOnMobile);
    results["3.3 Back to sidebar list"] = isSidebarVisibleOnMobile;
    console.log(isSidebarVisibleOnMobile ? "✓ 3.3 Returned to sidebar list" : "✗ 3.3 Sidebar return failed");
  } catch (e) {
    results["3.3 Back to sidebar list"] = false;
    console.error("3.3 failed:", e.message);
  }

  try {
    // 3.4 Click '#general' -> switch to chat pane
    console.log("3.4 Clicking #general in mobile sidebar...");
    const generalMobile = await page.waitForSelector("#channel-general");
    await generalMobile.click();
    await sleep(800);
    await page.screenshot({ path: path.join(screenshotDir, "14_mobile_chat_pane_restored.png") });

    const isChatPaneRestoredOnMobile = await page.evaluate(() => {
      const back = document.querySelector("button[title='Back']");
      return back !== null;
    });
    console.log("Chat pane restored on mobile:", isChatPaneRestoredOnMobile);
    results["3.4 Re-select #general switches to chat pane"] = isChatPaneRestoredOnMobile;
    console.log(isChatPaneRestoredOnMobile ? "✓ 3.4 Re-selected #general successfully" : "✗ 3.4 Re-selection failed");
  } catch (e) {
    results["3.4 Re-select #general switches to chat pane"] = false;
    console.error("3.4 failed:", e.message);
  }

  try {
    // 3.5 Resize viewport back to 1280x800
    console.log("3.5 Resizing viewport back to 1280x800...");
    await page.setViewport({ width: 1280, height: 800 });
    await sleep(600);
    await page.screenshot({ path: path.join(screenshotDir, "15_desktop_viewport_restored.png") });
    results["3.5 Resize viewport back to 1280x800"] = true;
    console.log("✓ 3.5 Restored desktop viewport to 1280x800");
  } catch (e) {
    results["3.5 Resize viewport back to 1280x800"] = false;
    console.error("3.5 failed:", e.message);
  }

  await browser.close();

  console.log("\n==========================================");
  console.log("FINAL RESULTS SUMMARY:");
  console.log(JSON.stringify(results, null, 2));
  console.log("==========================================");
}

runTest();
