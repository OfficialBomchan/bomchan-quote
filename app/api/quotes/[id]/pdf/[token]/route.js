const pdfTempStore = require("../../../../../../lib/pdfTempStore.js");

// 2단계: 1단계(POST)에서 받은 토큰으로 실제 PDF 바이트를 꺼내서 내려준다.
// 평범한 GET 요청이라 사파리의 "공유 > 파일에 저장"이 안정적으로 동작한다.
export async function GET(req, { params }) {
  const { token } = await params;
  const entry = pdfTempStore.take(token);
  if (!entry) {
    return Response.json({ error: "만료되었거나 이미 받은 PDF입니다. 다시 시도해주세요." }, { status: 404 });
  }

  return new Response(entry.bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(entry.fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
