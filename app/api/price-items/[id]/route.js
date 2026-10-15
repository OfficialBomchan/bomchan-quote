const db = require("../../../../lib/db.js");

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const { name, spec, pallet_qty, pallet_price, note, discontinued } = body;
  await db.prepare(
    `UPDATE price_items SET name=?, spec=?, pallet_qty=?, pallet_price=?, note=?, discontinued=?, updated_at=to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') WHERE id=?`
  ).run(name, spec || "", Number(pallet_qty), Number(pallet_price), note || "", discontinued ? 1 : 0, id);
  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await db.prepare(`DELETE FROM price_items WHERE id=?`).run(id);
  return Response.json({ ok: true });
}
