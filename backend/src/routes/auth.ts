import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { checkPassword, hashPassword, requireAuth, signToken, type Role } from "../lib/auth";
import { HttpError, fieldError, validate } from "../lib/errors";
import { User } from "../models";
import { loginSchema, registerSchema } from "../schemas";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Brute-force protection: AUTH_RATE_LIMIT attempts (default 10) per 15 minutes per IP for login and sign-up.
const authLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts, try again later" },
  });

const session = (u: { _id: unknown; role: string; name: string; email: string; phone?: string | null }) => {
  const user = { id: String(u._id), role: u.role as Role, name: u.name, email: u.email };
  return { token: signToken(user), user: { ...user, phone: u.phone ?? "" } };
};

export function authRouter() {
  const auth = Router();
  const limiter = authLimiter();

  auth.post("/register", limiter, validate(registerSchema), async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (await User.exists({ email })) throw fieldError("email", "Bu e-poçt artıq qeydiyyatdan keçib.", 409);
    const user = await User.create({ name, email, phone: phone || "", passwordHash: await hashPassword(password), role: "customer" });
    res.status(201).json(session(user));
  });

  auth.post("/login", limiter, validate(loginSchema), async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select("+passwordHash");
    // Same message and similar timing whether the e-mail exists or not.
    const ok = await checkPassword(req.body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, "E-poçt və ya şifrə yanlışdır.");
    res.json(session(user));
  });

  auth.get("/me", requireAuth(), async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new HttpError(401, "Login required");
    res.json(user);
  });

  return auth;
}
