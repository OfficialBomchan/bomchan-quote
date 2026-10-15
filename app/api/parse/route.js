const db = require("../../../lib/db.js");
const { parseInput } = require("../../../lib/parse.js");

export async function POST(req) {
  const body = await req.json();
  const text = body.text || "";
  const priceItems = await db.prepare(`SELECT * FROM price_items WHERE discontinued = 0`).all();
  const result = parseInput(text, priceItems);
  return Response.json(result);
}
