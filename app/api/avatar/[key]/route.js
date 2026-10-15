const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3, AVATAR_BUCKET } = require("../../../../lib/s3.js");

export async function GET(req, { params }) {
  const { key } = await params;

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: AVATAR_BUCKET, Key: key }));
    const bytes = await obj.Body.transformToByteArray();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": obj.ContentType || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return Response.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });
  }
}
