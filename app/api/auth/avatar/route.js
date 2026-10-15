const fs = require("fs");
const path = require("path");
const db = require("../../../../lib/db.js");
const { getUserFromRequest } = require("../../../../lib/auth.js");

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const ALLOWED_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_SIZE = 3 * 1024 * 1024; // 3MB

export async function POST(req) {
  const sessionUser = getUserFromRequest(req);
  if (!sessionUser) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return Response.json({ error: "사진 파일을 선택해주세요." }, { status: 400 });
  }
  if (!ALLOWED_TYPES[file.type]) {
    return Response.json({ error: "jpg, png, webp 파일만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "파일 크기는 3MB 이하여야 합니다." }, { status: 400 });
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const ext = ALLOWED_TYPES[file.type];
  const filename = `${sessionUser.userId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  const avatarPath = `/uploads/avatars/${filename}?v=${Date.now()}`;
  await db.prepare(`UPDATE users SET avatar_path = ? WHERE id = ?`).run(avatarPath, sessionUser.userId);

  return Response.json({ ok: true, avatarPath });
}
