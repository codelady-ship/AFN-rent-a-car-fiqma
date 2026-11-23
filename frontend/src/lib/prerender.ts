// Which car pages the build prerenders (vite.config.ts, prerenderRoutes). The GitHub Pages build has no API, so the
// site runs on the in-browser demo fleet and its car links are /park/demo-<seed id>. Imported by vite.config.ts.
import { DEMO_CAR_PREFIX } from "./demo";

/** Seed car 1 → "/park/demo-1", the same link the fleet's car cards build from the demo car id. */
export const demoCarPath = (seedId: number | string) => `/park/${DEMO_CAR_PREFIX}${seedId}`;

/** "/park/demo-1" → "park/demo-1.html": GitHub Pages answers /park/demo-1 with this file and HTTP 200. */
export const pageFile = (path: string) => path.replace(/^\//, "") + ".html";
