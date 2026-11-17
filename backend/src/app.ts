import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { config } from "./lib/config";
import { errorHandler, notFound } from "./lib/errors";
import { admin } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { bookings } from "./routes/bookings";
import { catalog } from "./routes/catalog";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind one proxy
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error("Not allowed by CORS"));
      },
    })
  );
  app.use(express.json({ limit: "50kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "up" : "down" });
  });

  app.use("/api/auth", authRouter());
  app.use("/api", catalog, bookings, admin);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
