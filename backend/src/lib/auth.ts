import bcrypt from "bcryptjs";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models";
import { config } from "./config";
import { HttpError } from "./errors";

export type Role = "customer" | "admin";
export type AuthUser = { id: string; role: Role; name: string; email: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const TTL: Record<Role, string> = { customer: "7d", admin: "8h" };

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
    if (!p.sub || (p.role !== "customer" && p.role !== "admin")) return null;
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

export const requireAdmin = requireAuth("admin");

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
