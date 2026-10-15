const db = require("./db.js");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDate(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function formatDateDot(d) {
  return `${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())}`;
}

function addDays(d, days) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function randomSuffix() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// BC-YYYYMMDD-XXXX, 중복 방지
async function generateQuoteNo(date) {
  const datePart = formatDate(date);
  const exists = db.prepare(`SELECT 1 FROM quotes WHERE quote_no = ?`);
  for (let i = 0; i < 20; i++) {
    const candidate = `BC-${datePart}-${randomSuffix()}`;
    if (!(await exists.get(candidate))) return candidate;
  }
  return `BC-${datePart}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function calcLine(unitPrice, qty) {
  const supply = Math.round(unitPrice * qty);
  const vat = Math.round(supply * 0.1);
  const total = supply + vat;
  return { supply, vat, total };
}

module.exports = { formatDate, formatDateDot, addDays, generateQuoteNo, calcLine };
