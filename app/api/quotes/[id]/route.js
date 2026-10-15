const db = require("../../../../lib/db.js");

export async function GET(req, { params }) {
  const { id } = await params;
  const row = await db.prepare(`SELECT * FROM quotes WHERE id = ?`).get(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ quote: { ...row, items: JSON.parse(row.items_json) } });
}
