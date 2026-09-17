import "./desktop/desktop.ts";
import { createApp } from "./app.ts";

const app = await createApp({
  isDesktop: () => true,
  onExit: () => Deno.exit(0),
});

Deno.serve(app.fetch);
