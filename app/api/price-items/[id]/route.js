const db = require("../../../../lib/db.js");

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const { name, spec, pallet_qty, pallet_price, note, discontinued } = body;
  db.prepare(
    `UPDATE price_items SET name=?, spec=?, pallet_qty=?, pallet_price=?, note=?, discontinued=?, updated_at=datetime('now','localtime') WHERE id=?`
  ).run(name, spec || "", Number(pallet_qty), Number(pallet_price), note || "", discontinued ? 1 : 0, id);
  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  db.prepare(`DELETE FROM price_items WHERE id=?`).run(id);
  return Response.json({ ok: true });
}
