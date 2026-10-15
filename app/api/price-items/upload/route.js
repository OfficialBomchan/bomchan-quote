const db = require("../../../../lib/db.js");

// 아주 단순한 CSV 파서. 큰따옴표로 감싼 필드 안의 콤마/줄바꿈을 처리한다.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const clean = text.replace(/\r\n/g, "\n").replace(/﻿/g, "");

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// CSV 헤더: 품목명,규격,PLT수량,PLT단가,특이사항,단종여부
export async function POST(req) {
  const body = await req.json();
  const csvText = body.csvText;
  if (!csvText) return Response.json({ error: "csvText가 필요합니다." }, { status: 400 });

  const rows = parseCsv(csvText);
  if (rows.length < 2) return Response.json({ error: "데이터 행이 없습니다." }, { status: 400 });

  const dataRows = rows.slice(1); // 첫 줄은 헤더로 간주
  const items = dataRows
    .map((r) => ({
      name: (r[0] || "").trim(),
      spec: (r[1] || "").trim(),
      pallet_qty: Number(r[2]),
      pallet_price: Number(String(r[3] || "").replace(/,/g, "")),
      note: (r[4] || "").trim(),
      discontinued: /^(1|y|true|단종)$/i.test((r[5] || "").trim()) ? 1 : 0,
    }))
    .filter((r) => r.name && r.pallet_qty > 0 && r.pallet_price > 0);

  if (items.length === 0) {
    return Response.json({ error: "유효한 품목 행이 없습니다. 헤더: 품목명,규격,PLT수량,PLT단가,특이사항,단종여부" }, { status: 400 });
  }

  const label = body.label || `업로드 ${new Date().toISOString()}`;

  const replaceAll = db.transaction(async (rowsToInsert, tx) => {
    await tx.prepare(`DELETE FROM price_items`).run();
    const insert = tx.prepare(
      `INSERT INTO price_items (name, spec, pallet_qty, pallet_price, note, discontinued) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const it of rowsToInsert) {
      await insert.run(it.name, it.spec, it.pallet_qty, it.pallet_price, it.note, it.discontinued);
    }
    await tx.prepare(`INSERT INTO price_versions (label) VALUES (?)`).run(label);
  });
  await replaceAll(items);

  return Response.json({ ok: true, count: items.length });
}
