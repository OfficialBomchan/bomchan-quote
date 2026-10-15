const bcrypt = require("bcryptjs");
const db = require("../../../../lib/db.js");
const { signSession, sessionCookieHeader } = require("../../../../lib/auth.js");

export async function POST(req) {
  const body = await req.json();
  const username = (body.username || "").trim();
  const password = body.password || "";

  const user = await db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return Response.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = signSession({ userId: user.id, username: user.username, name: user.name });
  return new Response(JSON.stringify({ ok: true, user: { id: user.id, username: user.username, name: user.name } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookieHeader(token),
    },
  });
}
