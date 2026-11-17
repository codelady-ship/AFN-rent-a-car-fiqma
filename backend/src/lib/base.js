const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const config = require("./config");
const { login } = require("./auth");
const { validate } = require("./errors");

// Express app with the parts every API here shares: JSON body, CORS allow-list,
// health check and admin login.
function createBaseApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind a proxy
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

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
  const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
  app.post("/api/auth/login", loginLimiter, validate(loginSchema), (req, res) => {
    res.json({ token: login(req.body.email, req.body.password) });
  });

  return app;
}

// Rate limit for public write endpoints (orders, bookings, scores...).
const publicWriteLimiter = () =>
  rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests, try again later" } });

// toJSON options: expose `id`, hide `_id` and `__v`.
const jsonOpts = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
};

module.exports = { createBaseApp, publicWriteLimiter, jsonOpts };
