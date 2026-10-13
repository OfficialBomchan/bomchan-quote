const { PDFDocument } = require("pdf-lib");
const db = require("../../../../../lib/db.js");
const pdfTempStore = require("../../../../../lib/pdfTempStore.js");

// A4 크기(pt). 1mm = 2.834645669 pt
const PAGE_WIDTH_PT = 595.2755905511812; // 210mm
const PAGE_HEIGHT_PT = 841.8897637795277; // 297mm

async function buildPdfBytes(imageDataUrl) {
  const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, "");
  const imageBytes = Buffer.from(base64, "base64");

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  const pngImage = await pdfDoc.embedPng(imageBytes);

  let renderWidth = PAGE_WIDTH_PT;
  let renderHeight = (pngImage.height * renderWidth) / pngImage.width;
  if (renderHeight > PAGE_HEIGHT_PT) {
    renderHeight = PAGE_HEIGHT_PT;
    renderWidth = (pngImage.width * renderHeight) / pngImage.height;
  }
  const x = (PAGE_WIDTH_PT - renderWidth) / 2;
  const y = PAGE_HEIGHT_PT - renderHeight; // 위쪽부터 채우도록

  page.drawImage(pngImage, { x, y, width: renderWidth, height: renderHeight });
  return Buffer.from(await pdfDoc.save());
}

// 1단계: 클라이언트(html2canvas)가 찍은 견적서 스크린샷(PNG data URL)을 받아서
// 실제 A4 크기의 PDF를 만들고, 잠깐 서버 메모리에 보관한 뒤 "꺼내 받을 수 있는
// 링크(token)"를 돌려준다. 아이폰 사파리의 "파일에 저장"이 POST 응답에서는
// 잘 안 먹혀서, 뒤이어 평범한 GET 요청으로 한 번 더 받아가게 한다.
export async function POST(req, { params }) {
  const { id } = await params;
  const contentType = req.headers.get("content-type") || "";
  let imageDataUrl;
  let requestedFileName;
  if (contentType.includes("application/json")) {
    const body = await req.json();
    imageDataUrl = body.image;
    requestedFileName = body.fileName;
  } else {
    const form = await req.formData();
    imageDataUrl = form.get("image");
    requestedFileName = form.get("fileName");
  }
  if (!imageDataUrl) {
    return Response.json({ error: "image가 필요합니다." }, { status: 400 });
  }

  const quote = db.prepare(`SELECT quote_no FROM quotes WHERE id = ?`).get(id);
  const fileName = requestedFileName || `${quote?.quote_no || "quote"}.pdf`;

  const pdfBytes = await buildPdfBytes(imageDataUrl);
  const token = pdfTempStore.put(pdfBytes, fileName);

  return Response.json({ ok: true, url: `/api/quotes/${id}/pdf/${token}` });
}
