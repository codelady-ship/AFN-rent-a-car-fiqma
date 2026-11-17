const mongoose = require("mongoose");
const { ZodError } = require("zod");

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Validates req.body (or another source) with a zod schema and replaces it with the parsed value.
const validate = (schema, source = "body") => (req, _res, next) => {
  const parsed = schema.safeParse(req[source] ?? {});
  if (!parsed.success) return next(parsed.error);
  if (source === "body") req.body = parsed.data;
  else req.valid = parsed.data;
  next();
};

const notFound = (_req, _res, next) => next(new HttpError(404, "Not found"));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(404).json({ error: "Not found" });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: "Validation failed",
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err && err.code === 11000) return res.status(409).json({ error: "Already exists" });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Body too large" });
  if (err && err.message === "Not allowed by CORS") return res.status(403).json({ error: "Origin not allowed" });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Server error" : err.message, ...(err.details ? { details: err.details } : {}) });
}

module.exports = { HttpError, validate, notFound, errorHandler };
