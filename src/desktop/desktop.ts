const win = new Deno.BrowserWindow({
  title: "Writasaurus",
  width: 1000,
  height: 700,
  frameless: true,
});

win.addEventListener?.("close", () => {
  Deno.exit(0);
});
