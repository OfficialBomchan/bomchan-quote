const db = require("../../../lib/db.js");

export async function GET() {
  const rows = db.prepare(`SELECT * FROM price_items ORDER BY discontinued ASC, name ASC, spec ASC`).all();
  return Response.json({ items: rows });
}

export async function POST(req) {
  const body = await req.json();
  const { name, spec, pallet_qty, pallet_price, note } = body;
  if (!name || !pallet_qty || !pallet_price) {
    return Response.json({ error: "품목명, PLT 수량, PLT 단가는 필수입니다." }, { status: 400 });
  }
  const result = db
    .prepare(
      `INSERT INTO price_items (name, spec, pallet_qty, pallet_price, note, discontinued) VALUES (?, ?, ?, ?, ?, 0)`
    )
    .run(name, spec || "", Number(pallet_qty), Number(pallet_price), note || "");
  return Response.json({ id: result.lastInsertRowid });
}
