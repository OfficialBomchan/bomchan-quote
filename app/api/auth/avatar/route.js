const { PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const { s3, AVATAR_BUCKET } = require("../../../../lib/s3.js");
const db = require("../../../../lib/db.js");
const { getUserFromRequest } = require("../../../../lib/auth.js");

const ALLOWED_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_SIZE = 10 * 1024 * 1024; // 10MB (고화질 원본 사진도 그대로 올릴 수 있게)

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
    return Response.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  const key = `${sessionUser.userId}.${ext}`;
  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // 요즘 휴대폰 사진은 3000~4000px급 원본이라, 이걸 그대로 작은 동그라미 아바타에
  // CSS로 욱여넣으면 특히 아이폰 사파리에서 오히려 흐릿하게 렌더링되는 고질적인
  // 버그가 있다. 화면에 쓰기 충분한 크기(최대 500px)로 서버에서 미리 줄여서
  // 저장하면 더 선명하게 보이고 용량도 훨씬 줄어든다.
  const buffer = await sharp(rawBuffer)
    .resize({ width: 500, height: 500, fit: "inside", withoutEnlargement: true })
    .toBuffer();

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
