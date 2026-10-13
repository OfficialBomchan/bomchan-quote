const { parseCsv } = require("./csv.js");

// 봄찬 "도매단가표 (PLT)" 구글 시트 구조 전용 파서.
// 열 구성(0-based): 0=여백, 1=품목, 2=규격(mm), 3=PLT수량, 4=단가, 5=특이사항
// 품목/규격 칸에는 여러 값이 줄바꿈(\n)으로 같이 들어있을 수 있어 품목×규격 조합으로 펼친다.
// 제목/헤더/안내문 같은 상품이 아닌 행은 "단가 칸이 비어있다"는 공통점으로 걸러낸다.
function parseAmount(s) {
  const n = Number(String(s || "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function parsePriceSheetRows(csvText) {
  const rows = parseCsv(csvText);
  const items = [];

  for (const r of rows) {
    const rawName = (r[1] || "").trim();
    const rawSpec = (r[2] || "").trim();
    const rawQty = (r[3] || "").trim();
    const rawPrice = (r[4] || "").trim();
    const rawNote = (r[5] || "").trim();

    const price = parseAmount(rawPrice);
    if (!rawName || !Number.isFinite(price) || price <= 0) continue;

    let qty = parseAmount(rawQty);
    if (!Number.isFinite(qty) || qty <= 0) qty = 1; // "-" 등 비규격 품목은 1개 단위로 취급

    const discontinued = /단종/.test(rawNote) ? 1 : 0;
    const note = rawNote.replace(/단종\s*,?\s*/g, "").trim();

    const names = rawName.split("\n").map((s) => s.trim()).filter(Boolean);
    const specList = rawSpec
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const specs = specList.length ? specList : [""];

    for (const name of names) {
      for (const spec of specs) {
        items.push({
          name,
          spec,
          pallet_qty: Math.round(qty),
          pallet_price: Math.round(price),
          note,
          discontinued,
        });
      }
    }
  }

  return items;
}

module.exports = { parsePriceSheetRows };
