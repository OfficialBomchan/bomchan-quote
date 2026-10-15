const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, AVATAR_BUCKET } = require("../../../../lib/s3.js");
const db = require("../../../../lib/db.js");
const { getUserFromRequest } = require("../../../../lib/auth.js");

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

  const ext = ALLOWED_TYPES[file.type];
  const key = `${sessionUser.userId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // 버킷은 비공개로 두고, 우리 서버의 /api/avatar/[key] 라우트가 S3에서
  // 받아와서 그대로 넘겨주는 방식(프록시)으로 서비스한다. 서버가 재배포/교체돼도
  // 사진은 S3에 남아있어서 안전하다.
  await s3.send(
    new PutObjectCommand({
      Bucket: AVATAR_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  const avatarPath = `/api/avatar/${key}?v=${Date.now()}`;
  await db.prepare(`UPDATE users SET avatar_path = ? WHERE id = ?`).run(avatarPath, sessionUser.userId);

  return Response.json({ ok: true, avatarPath });
}
