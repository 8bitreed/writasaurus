const win = new Deno.BrowserWindow({
  title: "Writasaurus",
  width: 1000,
  height: 700,
  frameless: true,
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
