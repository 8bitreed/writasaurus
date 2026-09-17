import { basename } from "@std/path";
import { type Router } from "../../framework/routing/types.ts";
import {
  chooseFile,
  clearLastFilePath,
  loadLastFilePath,
  saveLastFilePath,
} from "../../lib/desktop.ts";
import { epubFilename, generateEpub, isEpubFilename, parseEpub } from "../../lib/epub.ts";
import { parseManuscript } from "./client/data.ts";
import type { Manuscript } from "./client/types.ts";
import { editorView } from "./editor.view.ts";

export const editorRoutes = (router: Router, options: { onExit?: () => void } = {}): Router => {
  let activePath: string | null = null;
  let restoredLastFile = false;

  router.all("/", async (_req, ctx) => {
    return editorView(ctx, { title: "Writasaurus", isDesktop: await ctx.isDesktop() });
  });

  router.get("/api/editor/status", async (_req, ctx) => {
    const desktop = await ctx.isDesktop();

    if (desktop && activePath && !isEpubFilename(activePath)) {
      activePath = null;
      await clearLastFilePath();
    }

    if (desktop && !activePath && !restoredLastFile) {
      restoredLastFile = true;
      const lastPath = await loadLastFilePath();
      if (lastPath && isEpubFilename(lastPath)) {
        activePath = lastPath;
      } else if (lastPath) {
        await clearLastFilePath();
      }
    }

    if (desktop && activePath) {
      try {
        const bytes = await Deno.readFile(activePath);
        const manuscript = await parseEpub(bytes, basename(activePath));
        return ctx.json({
          isDesktop: true,
          activeFile: basename(activePath),
          activePath,
          manuscript,
        });
      } catch (error) {
        console.warn("Could not read the active file.", error);
        activePath = null;
        await clearLastFilePath();
      }
    }

    return ctx.json({
      isDesktop: desktop,
      activeFile: activePath ? basename(activePath) : null,
      activePath,
    });
  });

  router.post("/api/editor/save", async (req, ctx) => {
    const payload = await req.json().catch(() => null);
    if (!payload || (!payload.manuscript && typeof payload.content !== "string")) {
      return new Response("Invalid manuscript content", { status: 400 });
    }

    let manuscript: Manuscript;
    if (payload.manuscript && Array.isArray(payload.manuscript.chapters)) {
      manuscript = payload.manuscript;
    } else if (typeof payload.content === "string") {
      manuscript = parseManuscript(payload.content, payload.filename || "manuscript.epub");
    } else {
      return new Response("Invalid manuscript content", { status: 400 });
    }

    if (payload.saveAs || !activePath) {
      const suggested = epubFilename({
        ...manuscript,
        filename: typeof payload.filename === "string" && payload.filename.trim()
          ? basename(payload.filename)
          : manuscript.filename,
      });
      const chosen = await chooseFile("save", suggested, "EPUB eBook", ["*.epub"]);
      if (!chosen) {
        return new Response(null, { status: 204 });
      }
      activePath = chosen;
      await saveLastFilePath(activePath);
    }

    const epubBytes = await generateEpub(manuscript);
    await Deno.writeFile(activePath, epubBytes);
    return ctx.json({
      ok: true,
      name: basename(activePath),
      path: activePath,
    });
  });

  router.post("/api/editor/save-epub", async (req, ctx) => {
    const payload = await req.json().catch(() => null);
    if (!payload || !payload.manuscript || !Array.isArray(payload.manuscript.chapters)) {
      return new Response("Invalid manuscript data", { status: 400 });
    }

    const suggested = epubFilename({
      ...payload.manuscript,
      filename: typeof payload.filename === "string" && payload.filename.trim()
        ? basename(payload.filename)
        : payload.manuscript.filename,
    });
    const chosen = await chooseFile("save", suggested, "EPUB eBook", ["*.epub"]);
    if (!chosen) {
      return new Response(null, { status: 204 });
    }

    const epubBytes = await generateEpub(payload.manuscript);
    await Deno.writeFile(chosen, epubBytes);
    return ctx.json({
      ok: true,
      name: basename(chosen),
      path: chosen,
    });
  });

  router.post("/api/editor/open", async (_req, ctx) => {
    const chosen = await chooseFile("open", "manuscript.epub", "EPUB eBook", ["*.epub"]);
    if (!chosen) {
      return new Response(null, { status: 204 });
    }
    try {
      activePath = chosen;
      await saveLastFilePath(activePath);
      const bytes = await Deno.readFile(chosen);
      const manuscript = await parseEpub(bytes, basename(chosen));
      return ctx.json({
        ok: true,
        name: basename(activePath),
        path: activePath,
        manuscript,
      });
    } catch (error) {
      console.error("Failed to read manuscript:", error);
      return new Response("Failed to read file", { status: 500 });
    }
  });

  router.post("/api/editor/close", async (_req, ctx) => {
    activePath = null;
    restoredLastFile = true;
    await clearLastFilePath();
    return ctx.json({ ok: true });
  });

  router.post("/api/editor/exit", async (_req, ctx) => {
    if (await ctx.isDesktop() && options.onExit) {
      setTimeout(options.onExit, 50);
    }
    return ctx.json({ ok: true });
  });

  return router;
};
