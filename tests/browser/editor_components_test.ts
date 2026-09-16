import { chromium, type Page } from "playwright";
import { createApp } from "../../src/app.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

async function launchBrowser() {
  const customPath = Deno.env.get("PLAYWRIGHT_CHROME_PATH");
  if (customPath) {
    return await chromium.launch({
      executablePath: customPath,
      headless: true,
      args: ["--no-sandbox"],
    });
  }

  // Look for system-installed Chromium/Chrome/Brave binaries if the default Playwright cache doesn't exist
  const candidates = [
    "/snap/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/brave-browser",
  ];

  for (const candidate of candidates) {
    try {
      const stat = await Deno.stat(candidate);
      if (stat.isFile || stat.isSymlink) {
        return await chromium.launch({
          executablePath: candidate,
          headless: true,
          args: ["--no-sandbox"],
        });
      }
    } catch {
      // not available, continue
    }
  }

  // Fall back to Playwright's default resolution
  return await chromium.launch({
    executablePath: chromium.executablePath(),
    headless: true,
  });
}

async function withEditorPage(test: (page: Page) => Promise<void>): Promise<void> {
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, createApp());
  const address = server.addr as Deno.NetAddr;
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.addInitScript(() => {
      sessionStorage.removeItem("writasaurus-manuscript-v1:state");
      sessionStorage.setItem("writasaurus-session:skip-welcome", "true");
    });
    await page.goto(`http://${address.hostname}:${address.port}/`);
    await page.waitForFunction(() => customElements.get("editor-toolbar") !== undefined);
    await test(page);
  } finally {
    await browser.close();
    await server.shutdown();
  }
}

Deno.test("browser: editor app renders its shell and adds a chapter", async () => {
  await withEditorPage(async (page) => {
    await page.waitForSelector("editor-app > editor-topbar", { state: "attached" });
    await page.waitForSelector("editor-app editor-sidebar", { state: "attached" });
    await page.waitForSelector("editor-app editor-writing-area #editor", { state: "attached" });
    await page.locator("editor-sidebar").evaluate((element) => {
      (element as HTMLElement & { expand(): void }).expand();
    });

    const initialChapters = await page.locator("editor-sidebar .chapter-item").count();
    assert(initialChapters > 0, "Expected the editor to render at least one chapter");

    await page.locator("editor-sidebar .sidebar-heading button").click();
    await page.waitForFunction(
      (count) => document.querySelectorAll(".chapter-item").length === count + 1,
      initialChapters,
    );

    const chapterTitle = await page.locator("#chapter-title").inputValue();
    assert(
      chapterTitle === `Chapter ${initialChapters + 1}: Untitled`,
      `Unexpected new chapter title: ${chapterTitle}`,
    );
  });
});

Deno.test("browser: save status renders observed attribute updates", async () => {
  await withEditorPage(async (page) => {
    const status = page.locator("#save-status");
    await status.evaluate((element) => {
      element.setAttribute("status", "saved");
      element.setAttribute("message", "Saved");
    });

    await page.waitForFunction(() => {
      const status = document.querySelector("#save-status");
      const indicator = status?.shadowRoot?.querySelector(".save-status-indicator.saved");
      return indicator?.textContent === "" && status?.shadowRoot?.textContent?.includes("Saved");
    });

    const color = await status.evaluate((element) => {
      const indicator = element.shadowRoot?.querySelector<HTMLElement>(".save-status-indicator");
      return indicator ? getComputedStyle(indicator).backgroundColor : "";
    });
    assert(color === "rgb(134, 201, 163)", `Expected saved indicator color, got ${color}`);
  });
});

function chapterWords(page: Page): Promise<number> {
  return page.evaluate(() => {
    const wordCount = document.querySelector("editor-statusbar")?.shadowRoot
      ?.querySelector("word-count");
    const text = wordCount?.shadowRoot?.textContent ?? "";
    return Number(text.match(/Chapter: ([\d,]+) words/)?.[1]?.replace(/,/g, "") ?? -1);
  });
}

Deno.test("browser: status bar renders live stats from the editor store", async () => {
  await withEditorPage(async (page) => {
    const before = await chapterWords(page);
    assert(before >= 0, "Expected the status bar to render chapter words");

    await page.locator("#editor").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Hello brave new world");

    await page.waitForFunction(
      (expected) => {
        const wordCount = document.querySelector("editor-statusbar")?.shadowRoot
          ?.querySelector("word-count");
        return wordCount?.shadowRoot?.textContent?.includes(`Chapter: ${expected} words`) === true;
      },
      before + 4,
    );

    const saveStatus = await page.locator("#save-status").evaluate((element) =>
      element.shadowRoot?.textContent ?? ""
    );
    assert(
      saveStatus.includes("Unsaved changes"),
      `Expected the topbar to show unsaved changes, got ${saveStatus}`,
    );
  });
});

Deno.test("browser: toolbar bold command formats the selected editor content", async () => {
  await withEditorPage(async (page) => {
    await page.locator("#editor").evaluate((element) => {
      element.textContent = "Selected text";
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    await page.locator('editor-toolbar >> button[data-command="bold"]').click();

    const formatted = await page.locator("#editor").evaluate((element) => {
      return element.querySelector("b, strong")?.textContent;
    });
    assert(formatted === "Selected text", `Expected bold content, got ${formatted ?? "none"}`);
  });
});
