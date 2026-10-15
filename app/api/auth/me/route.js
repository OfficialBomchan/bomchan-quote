const db = require("../../../../lib/db.js");
const { getUserFromRequest } = require("../../../../lib/auth.js");

export async function GET(req) {
  const sessionUser = getUserFromRequest(req);
  if (!sessionUser) return Response.json({ user: null }, { status: 200 });

  const row = await db
    .prepare(`SELECT id, username, name, phone, email, title, avatar_path FROM users WHERE id = ?`)
    .get(sessionUser.userId);
  if (!row) return Response.json({ user: null }, { status: 200 });

  return Response.json({
    user: {
      id: row.id,
      username: row.username,
      name: row.name,
      phone: row.phone,
      email: row.email,
      title: row.title,
      avatarPath: row.avatar_path,
    },
  });
}
