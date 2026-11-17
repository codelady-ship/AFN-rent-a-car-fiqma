const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { HttpError } = require("./errors");

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

// One admin account, configured with ADMIN_EMAIL / ADMIN_PASSWORD env vars.
function login(email, password) {
  if (!config.jwtSecret || !config.adminEmail || !config.adminPassword) {
    throw new HttpError(503, "Admin login is not configured on this server");
  }
  const okEmail = safeEqual(String(email || "").trim().toLowerCase(), config.adminEmail);
  const okPass = safeEqual(password || "", config.adminPassword);
  if (!okEmail || !okPass) throw new HttpError(401, "Invalid email or password");
  return jwt.sign({ sub: config.adminEmail, role: "admin" }, config.jwtSecret, { expiresIn: "8h" });
}

function requireAdmin(req, _res, next) {
  const [type, token] = (req.headers.authorization || "").split(" ");
  if (type !== "Bearer" || !token || !config.jwtSecret) return next(new HttpError(401, "Admin token required"));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== "admin") throw new Error("role");
    req.admin = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}

module.exports = { login, requireAdmin };
