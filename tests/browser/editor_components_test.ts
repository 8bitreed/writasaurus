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

async function withEditorPage(
  test: (page: Page) => Promise<void>,
  desktop = false,
): Promise<void> {
  const app = desktop ? createApp({ isDesktop: () => true }) : createApp();
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, app);
  const address = server.addr as Deno.NetAddr;
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.addInitScript(() => {
      // Prevent a locally persisted file handle from affecting fixture state.
      Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: {
          open: () => {
            throw new Error("IndexedDB is disabled in this test fixture.");
          },
        },
      });
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

Deno.test("browser: chapter delete control renders visible neutral text", async () => {
  await withEditorPage(async (page) => {
    await page.locator("editor-sidebar").evaluate((element) => {
      (element as HTMLElement & { expand(): void }).expand();
    });
    const deleteButton = page.locator(".chapter-item .delete-chapter");

    assert(await deleteButton.isVisible(), "Expected the chapter delete button to be visible");
    assert(
      await deleteButton.getAttribute("aria-label") === "Delete Chapter 1",
      "Expected an accessible delete label",
    );
    assert(
      (await deleteButton.textContent())?.trim() === "Delete",
      "Expected the delete button to contain its text label",
    );

    const colors = await deleteButton.evaluate((element) => ({
      button: getComputedStyle(element).color,
      text: getComputedStyle(document.querySelector(".chapter-title")!).color,
    }));
    assert(
      colors.button === colors.text,
      "Expected the delete button to use the primary text color",
    );
  });
});

Deno.test("browser: dragging a chapter handle reorders chapters", async () => {
  await withEditorPage(async (page) => {
    await page.locator("editor-sidebar").evaluate((element) => {
      (element as HTMLElement & { expand(): void }).expand();
    });
    const addChapter = page.locator("editor-sidebar .sidebar-heading button");
    await addChapter.click();
    await addChapter.click();
    await page.waitForFunction(() => document.querySelectorAll(".chapter-item").length === 3);

    const chapterTitle = page.locator("#chapter-title");
    await page.locator(".chapter-item").nth(0).locator(".chapter-title").click();
    await chapterTitle.fill("Opening Chapter 1");
    await page.locator(".chapter-item").nth(1).locator(".chapter-title").click();
    await chapterTitle.fill("Chapter 2: Middle");
    await page.locator(".chapter-item").nth(2).locator(".chapter-title").click();
    await chapterTitle.fill("Appendix");

    const source = await page.locator(".chapter-item").nth(0).locator(".drag-handle").boundingBox();
    const destination = await page.locator(".chapter-item").nth(2).boundingBox();
    assert(source && destination, "Expected draggable chapter handles");

    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();

    const titles = await page.locator(".chapter-title").allTextContents();
    assert(
      titles.join("|") === "Chapter 1: Middle|Appendix|Opening Chapter 3",
      `Unexpected reordered titles: ${titles.join("|")}`,
    );

    const status = await page.locator("#save-status").evaluate((element) =>
      element.shadowRoot?.textContent ?? ""
    );
    assert(
      status.includes("Unsaved changes"),
      "Expected chapter reordering to mark the manuscript dirty",
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

    const stats = page.locator("editor-statusbar").locator("word-count").locator("button");
    await stats.click();
    await stats.click();
    assert(
      (await stats.textContent())?.trim() === "Daily Goal: 4 / 1,500 words",
      "Expected today’s writing progress to include newly written words",
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

Deno.test("browser: status bar rotates chapter, manuscript, and daily writing stats", async () => {
  await withEditorPage(async (page) => {
    const wordCount = page.locator("editor-statusbar").locator("word-count");
    const stats = wordCount.locator("button");

    const chapterStats = (await stats.textContent())?.trim();
    assert(chapterStats?.startsWith("Chapter:"), `Expected chapter stats, got ${chapterStats}`);
    assert(chapterStats?.includes("pages"), `Expected chapter pages, got ${chapterStats}`);
    assert(
      !chapterStats?.includes("characters"),
      `Expected no chapter characters, got ${chapterStats}`,
    );

    await stats.click();
    const manuscriptStats = (await stats.textContent())?.trim();
    assert(
      manuscriptStats?.startsWith("Manuscript:"),
      `Expected manuscript stats, got ${manuscriptStats}`,
    );

    await stats.click();
    const dailyStats = (await stats.textContent())?.trim();
    assert(
      dailyStats === "Daily Goal: 0 / 1,500 words",
      `Expected default daily goal stats, got ${dailyStats}`,
    );
  });
});

Deno.test("browser: Desktop writing assistance corrects a local spelling warning", async () => {
  await withEditorPage(async (page) => {
    const panel = page.locator(".writing-assistance-panel");
    await panel.waitFor({ state: "visible" });

    await page.locator("#editor").fill("This is teh cat.");
    await page.waitForFunction(
      () => document.querySelector(".writing-assistance-panel")?.textContent?.includes("1 issue"),
      undefined,
      { timeout: 60_000 },
    );

    await panel.locator("button").first().click();
    await panel.getByRole("button", { name: "Replace with “the”" }).click();
    await page.waitForFunction(() =>
      document.querySelector("#editor")?.textContent === "This is the cat."
    );
  }, true);
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

Deno.test("browser: menu contains direct manuscript and save actions", async () => {
  await withEditorPage(async (page) => {
    await page.locator("#menu-toggle").click();
    await page.waitForSelector("#app-menu:not([hidden])", { state: "visible" });
    const menu = page.locator("#app-menu");
    assert(
      (await menu.locator("#menu-save-epub").textContent())?.includes("Save As"),
      "Expected Save As action",
    );
    assert(
      (await menu.locator("#menu-new-manuscript").textContent())?.includes("New Manuscript"),
      "Expected New Manuscript action",
    );
    assert(
      (await menu.locator("#menu-open-manuscript").textContent())?.includes("Open Manuscript"),
      "Expected Open Manuscript action",
    );
    assert(await page.locator("#editor-file-input").count() === 1, "Expected direct file input");
    assert(
      await menu.locator("#menu-new-manuscript").evaluate((element) =>
        getComputedStyle(element).borderTopWidth
      ) === "0px",
      "Expected a standard borderless menu item",
    );
  });
});
