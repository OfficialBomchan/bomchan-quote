const db = require("../../../../lib/db.js");
const { parsePriceSheetRows } = require("../../../../lib/priceSheetSync.js");

export async function POST() {
  const url = process.env.PRICE_SHEET_CSV_URL;
  if (!url) {
    return Response.json({ error: "단가표 구글 시트 연동이 아직 설정되지 않았습니다." }, { status: 400 });
  }

  let csvText;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`구글 시트 응답 오류 (${res.status})`);
    csvText = await res.text();
  } catch (err) {
    return Response.json({ error: "구글 시트를 가져오지 못했습니다: " + err.message }, { status: 502 });
  }

  const items = parsePriceSheetRows(csvText);
  if (items.length === 0) {
    return Response.json({ error: "시트에서 유효한 품목을 찾지 못했습니다. 시트 구조가 바뀌었는지 확인해주세요." }, { status: 400 });
  }

  const label = `구글 시트 동기화 ${new Date().toISOString()}`;
  const replaceAll = db.transaction(async (rows, tx) => {
    await tx.prepare(`DELETE FROM price_items`).run();
    const insert = tx.prepare(
      `INSERT INTO price_items (name, spec, pallet_qty, pallet_price, note, discontinued) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const it of rows) {
      await insert.run(it.name, it.spec, it.pallet_qty, it.pallet_price, it.note, it.discontinued);
    }
    await tx.prepare(`INSERT INTO price_versions (label) VALUES (?)`).run(label);
  });
  await replaceAll(items);

  return Response.json({
    ok: true,
    count: items.length,
    discontinuedCount: items.filter((i) => i.discontinued).length,
  });
}
