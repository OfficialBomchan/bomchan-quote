const db = require("../../../../lib/db.js");
const { getUserFromRequest, signSession, sessionCookieHeader } = require("../../../../lib/auth.js");

export async function PUT(req) {
  const sessionUser = getUserFromRequest(req);
  if (!sessionUser) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json();
  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  const email = (body.email || "").trim();
  const title = (body.title || "").trim() || "㈜봄찬 · 매니저";

  if (!name) return Response.json({ error: "이름을 입력해주세요." }, { status: 400 });

  await db.prepare(`UPDATE users SET name = ?, phone = ?, email = ?, title = ? WHERE id = ?`).run(
    name,
    phone,
    email,
    title,
    sessionUser.userId
  );

  // 세션 쿠키에 들어있는 이름도 최신으로 갱신해줘야 상단 표시 등이 바로 반영된다.
  const token = signSession({ userId: sessionUser.userId, username: sessionUser.username, name });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookieHeader(token),
    },
  });
}
