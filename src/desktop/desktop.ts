type DesktopWindow = {
  setSize?: (w: number, h: number) => void;
  setTitle?: (t: string) => void;
  executeJs?: (code: string) => Promise<unknown>;
  addEventListener?: (
    type: string,
    cb: (e: { detail?: { id?: string } }) => void,
  ) => void;
};

const desktop = Deno as unknown as {
  BrowserWindow?: new (opts: Record<string, unknown>) => DesktopWindow;
};

if (desktop.BrowserWindow) {
  const win = new desktop.BrowserWindow({
    title: "Writasaurus",
    width: 1000,
    height: 700,
  });

  win.addEventListener?.("close", () => {
    // Delegate to the page's quit() so unsaved changes can be confirmed/saved before
    // the process actually exits. If the page can't run it (e.g. it already
    // unloaded), fall back to exiting immediately so the app never hangs open.
    const result = win.executeJs?.("globalThis.writasaurus?.quit?.()");
    if (result) {
      result.catch(() => Deno.exit(0));
    } else {
      Deno.exit(0);
    }
  });
}
