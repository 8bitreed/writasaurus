import { createApp } from "./app.ts";
import "./desktop/desktop.ts";

const app = await createApp();

Deno.serve(app.fetch);
