const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret";
const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30일

function signSession(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: MAX_AGE_SECONDS });
}

function verifySession(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || "").split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

// Route Handler(req: Request)에서 현재 로그인한 사용자를 꺼낸다. 없으면 null.
function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

function sessionCookieHeader(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  COOKIE_NAME,
  signSession,
  verifySession,
  getUserFromRequest,
  sessionCookieHeader,
  clearCookieHeader,
};
