import bcrypt from "bcryptjs";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models";
import { config } from "./config";
import { HttpError } from "./errors";

/** "demo" is the public read-only admin used by the portfolio: it can open every admin page but cannot change anything. */
export type Role = "customer" | "admin" | "demo";
export type AuthUser = { id: string; role: Role; name: string; email: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const TTL: Record<Role, string> = { customer: "7d", admin: "8h", demo: "2h" };

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signToken(u: AuthUser) {
  if (!config.jwtSecret) throw new HttpError(503, "Login is not configured on this server");
  return jwt.sign({ sub: u.id, role: u.role, name: u.name, email: u.email }, config.jwtSecret, {
    expiresIn: TTL[u.role],
  } as jwt.SignOptions);
}

function readToken(header: string | undefined): AuthUser | null {
  const [type, token] = (header || "").split(" ");
  if (type !== "Bearer" || !token || !config.jwtSecret) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (!p.sub || !["customer", "admin", "demo"].includes(p.role)) return null;
    return { id: String(p.sub), role: p.role, name: String(p.name || ""), email: String(p.email || "") };
  } catch {
    return null;
  }
}

/** Sets req.user when a valid token is sent; never rejects. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  req.user = readToken(req.headers.authorization) ?? undefined;
  next();
};

/** Rejects requests without a valid token (401) or with the wrong role (403). */
export const requireAuth =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const u = readToken(req.headers.authorization);
    if (!u) return next(new HttpError(401, "Login required"));
    if (roles.length && !roles.includes(u.role)) return next(new HttpError(403, "Not allowed"));
    req.user = u;
    next();
  };

export const DEMO_READ_ONLY = "Demo rejim: admin paneli yalnız baxış üçündür, dəyişikliklər saxlanılmır.";

/**
 * Admin routes: real admins get full rights; the demo admin may only read (GET/HEAD).
 * Any write from the demo role is refused with 403 and a message the admin page shows as a toast.
 */
const adminOrDemo = requireAuth("admin", "demo");
export const requireAdmin: RequestHandler = (req, res, next) =>
  adminOrDemo(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user!.role === "demo" && req.method !== "GET" && req.method !== "HEAD") return next(new HttpError(403, DEMO_READ_ONLY));
    next();
  });

/** The demo admin sees the shape of the data, not the customers behind it. */
export const isDemo = (req: { user?: AuthUser }) => req.user?.role === "demo";
export function maskPerson<T extends { name?: unknown; email?: unknown; phone?: unknown; note?: unknown; message?: unknown }>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  if (typeof out.name === "string") out.name = out.name.split(/\s+/).map((w) => w.charAt(0) + "***").join(" ");
  if (typeof out.email === "string" && out.email) out.email = out.email.replace(/^(.)[^@]*@/, "$1***@");
  if (typeof out.phone === "string") out.phone = out.phone.replace(/\d(?=(?:\D*\d){2})/g, "*");
  if (out.note) out.note = "(demo: gizlədilib)";
  if (out.message) out.message = "(demo: mesajın mətni gizlədilib)";
  return out as T;
}

/** The public demo admin (read-only, see requireAdmin). The password is public by design; DEMO_ADMIN=off removes the account. */
export const DEMO_ADMIN = { email: "admin@afn.demo", password: "demo12345" };
export async function ensureDemoAdmin() {
  if (process.env.DEMO_ADMIN === "off") {
    await User.deleteOne({ email: DEMO_ADMIN.email, role: "demo" });
    return "off";
  }
  const existing = await User.findOne({ email: DEMO_ADMIN.email }).select("+passwordHash");
  if (existing && existing.role !== "demo") return "skipped (e-mail used by another account)";
  if (existing && (await checkPassword(DEMO_ADMIN.password, existing.passwordHash))) return "ok";
  await User.updateOne(
    { email: DEMO_ADMIN.email },
    { $set: { role: "demo", passwordHash: await hashPassword(DEMO_ADMIN.password) }, $setOnInsert: { name: "Demo admin", email: DEMO_ADMIN.email } },
    { upsert: true }
  );
  return "ok";
}

/** The admin account comes from ADMIN_EMAIL / ADMIN_PASSWORD; it is created or updated on start. */
export async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) return "skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set)";
  const existing = await User.findOne({ email: config.adminEmail }).select("+passwordHash");
  if (existing && existing.role === "admin" && (await checkPassword(config.adminPassword, existing.passwordHash))) {
    return "ok";
  }
  await User.updateOne(
    { email: config.adminEmail },
    {
      $set: { role: "admin", passwordHash: await hashPassword(config.adminPassword) },
      $setOnInsert: { name: "AFN admin", email: config.adminEmail },
    },
    { upsert: true }
  );
  return "ok";
}
