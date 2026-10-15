const db = require("../../../lib/db.js");
const { generateQuoteNo, addDays, formatDateDot, calcLine } = require("../../../lib/quoteUtils.js");
const { getUserFromRequest } = require("../../../lib/auth.js");

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const mine = searchParams.get("mine") === "1";
  const user = getUserFromRequest(req);

  const conditions = [];
  const params = [];
  if (q) {
    conditions.push(`(company LIKE ? OR quote_no LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  if (mine && user) {
    conditions.push(`created_by_user_id = ?`);
    params.push(user.userId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.prepare(`SELECT * FROM quotes ${where} ORDER BY id DESC`).all(...params);

  return Response.json({ quotes: rows.map((r) => ({ ...r, items: JSON.parse(r.items_json) })) });
}

export async function POST(req) {
  const body = await req.json();
  const { company, contactName, contactPhone, deliveryAddress, deliveryDatetime, customerRequest, quoteDate, notes, items, freight, freightNote, rawInput, manager } = body;
  const user = getUserFromRequest(req);

  if (!items || items.length === 0) {
    return Response.json({ error: "품목이 1개 이상 필요합니다." }, { status: 400 });
  }

  const qDate = quoteDate ? new Date(quoteDate) : new Date();
  const validUntil = addDays(qDate, 21);
  const quoteNo = await generateQuoteNo(qDate);

  const finalItems = items.map((it) => {
    const { supply, vat, total } = calcLine(it.eaUnitPrice, it.eaQty);
    return {
      name: it.name,
      spec: it.spec,
      unit: "EA",
      qty: it.eaQty,
      unitPrice: it.eaUnitPrice,
      supply,
      vat,
      total,
      note: it.note || "",
    };
  });

  if (freight && Number(freight) > 0) {
    const supply = Math.round(Number(freight));
    const vat = Math.round(supply * 0.1);
    finalItems.push({
      name: "운임",
      spec: "",
      unit: "회",
      qty: 1,
      unitPrice: supply,
      supply,
      vat,
      total: supply + vat,
      note: freightNote || "회",
    });
  }

  const totalAmount = finalItems.reduce((s, it) => s + it.total, 0);

  // 담당자 정보(이름/직책/연락처/이메일/사진)는 기본적으로 로그인한 작성자의 프로필을 쓰고,
  // 폼에서 명시적으로 넘긴 값이 있으면 그걸 우선한다. 발행 당시 스냅샷이라 이후 프로필을
  // 바꿔도 이미 만든 견적서는 바뀌지 않는다.
  const profile = user
    ? await db.prepare(`SELECT name, title, phone, email, avatar_path FROM users WHERE id = ?`).get(user.userId)
    : null;

  const result = await db
    .prepare(
      `INSERT INTO quotes (quote_no, company, contact_name, contact_phone, delivery_address, delivery_datetime, customer_request, quote_date, valid_until, manager_name, manager_title, manager_phone, manager_email, manager_avatar_path, notes, items_json, total_amount, raw_input, created_by_user_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .run(
      quoteNo,
      company || "",
      contactName || "",
      contactPhone || "",
      deliveryAddress || "",
      deliveryDatetime || "",
      customerRequest || "",
      formatDateDot(qDate),
      formatDateDot(validUntil),
      manager?.name || profile?.name || "강다정",
      manager?.title || profile?.title || "㈜봄찬 · 매니저",
      manager?.phone || profile?.phone || "01057384752",
      manager?.email || profile?.email || "dajeong@bomchan.com",
      profile?.avatar_path || "",
      notes || "",
      JSON.stringify(finalItems),
      totalAmount,
      rawInput || "",
      user?.userId || null,
      user?.name || ""
    );

  return Response.json({ id: result.lastInsertRowid, quoteNo });
}
