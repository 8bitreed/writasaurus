import { type Router } from "../../framework/routing/types.ts";
import { settingsView } from "./settings.view.ts";

export const settingsRoutes = (router: Router): Router => {
  router.get("/settings", async (_req, ctx) => {
    return settingsView(ctx, { isDesktop: await ctx.isDesktop() });
  });

  return router;
};
