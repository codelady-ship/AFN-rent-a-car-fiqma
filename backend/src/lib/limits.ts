import { rateLimit } from "express-rate-limit";

/** Rate limit for public write endpoints (bookings, contact form): PUBLIC_RATE_LIMIT (default 20) per 10 minutes per IP. */
export const publicWriteLimiter = () =>
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: Number(process.env.PUBLIC_RATE_LIMIT) || 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, try again later" },
  });
