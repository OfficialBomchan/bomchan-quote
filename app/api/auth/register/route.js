const bcrypt = require("bcryptjs");
const db = require("../../../../lib/db.js");
const { signSession, sessionCookieHeader } = require("../../../../lib/auth.js");

export async function POST(req) {
  const body = await req.json();
  const username = (body.username || "").trim();
  const password = body.password || "";
  const name = (body.name || "").trim();

  if (!username || !password || !name) {
    return Response.json({ error: "아이디, 비밀번호, 이름을 모두 입력해주세요." }, { status: 400 });
  }
  if (password.length < 4) {
    return Response.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) {
    return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(`INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)`)
    .run(username, passwordHash, name);

  const token = signSession({ userId: result.lastInsertRowid, username, name });
  return new Response(JSON.stringify({ ok: true, user: { id: result.lastInsertRowid, username, name } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookieHeader(token),
    },
  });
}
