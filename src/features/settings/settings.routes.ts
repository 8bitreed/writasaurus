import { type Router } from "../../framework/routing/types.ts";
import { settingsView } from "./settings.view.ts";

export const settingsRoutes = (router: Router): Router => {
  router.get("/settings", (_req, ctx) => {
    return settingsView(ctx);
  });

  return router;
};
