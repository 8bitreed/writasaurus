import { chromium, type Page } from "playwright";
import { createApp } from "../../src/app.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

async function withEditorPage(test: (page: Page) => Promise<void>): Promise<void> {
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, createApp());
  const address = server.addr as Deno.NetAddr;
  // Use the installed Chromium build rather than Playwright's optional headless-shell binary.
  const browser = await chromium.launch({
    executablePath: chromium.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();

  try {
    await page.addInitScript(() => {
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

Deno.test("browser: status bar delegates stats rendering to word-count", async () => {
  await withEditorPage(async (page) => {
    const statusbar = page.locator("editor-statusbar");
    await statusbar.evaluate((element) => {
      (element as HTMLElement & { setStats(options: object): void }).setStats({
        chapterWords: 123,
        chapterChars: 456,
        totalWords: 789,
        wordsPerPage: 300,
      });
    });

    const rendered = await statusbar.evaluate((element) => {
      const wordCount = element.shadowRoot?.querySelector("word-count");
      return {
        customElementDefined: customElements.get("word-count") !== undefined,
        html: wordCount?.outerHTML ?? "",
        text: wordCount?.shadowRoot?.textContent ?? "",
      };
    });
    assert(
      rendered.text.includes("Chapter: 123 words · 456 characters") &&
        rendered.text.includes("Manuscript: 789 words · 2.6 pages"),
      `Unexpected word-count rendering: ${JSON.stringify(rendered)}`,
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
