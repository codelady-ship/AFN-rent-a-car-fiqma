import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError, type ZodTypeAny } from "zod";

export type FieldError = { field: string; message: string };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: FieldError[]
  ) {
    super(message);
  }
}

export const fieldError = (field: string, message: string, status = 400) =>
  new HttpError(status, "Validation failed", [{ field, message }]);

/** Validates req.body (default) or req.query with a zod schema; the parsed value replaces body / goes to res.locals.query. */
export const validate =
  (schema: ZodTypeAny, source: "body" | "query" = "body"): RequestHandler =>
  (req, res, next) => {
    const parsed = schema.safeParse(source === "body" ? (req.body ?? {}) : req.query);
    if (!parsed.success) return next(parsed.error);
    if (source === "body") req.body = parsed.data;
    else res.locals.query = parsed.data;
    next();
  };

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, "Not found"));

// Never sends stack traces or internal messages for 5xx errors.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: "Validation failed",
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
    return;
  }
  if (err && err.code === 11000) {
    res.status(409).json({ error: "Already exists" });
    return;
  }
  if (err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (err && err.type === "entity.too.large") {
    res.status(413).json({ error: "Body too large" });
    return;
  }
  if (err && err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? "Server error" : err.message,
    ...(err instanceof HttpError && err.details ? { details: err.details } : {}),
  });
};
