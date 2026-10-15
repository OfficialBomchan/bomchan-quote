const db = require("./db.js");

function pad2(n) {
  return String(n).padStart(2, "0");
}

// 서버(AWS EC2)는 UTC로 돌아서 d.getFullYear()/getDate() 같은 로컬 getter를 쓰면
// 한국시간 자정~오전 9시 사이엔 날짜가 하루 전으로 찍힌다. 항상 한국시간(Asia/Seoul)
// 기준으로 연/월/일을 뽑아서 서버 시간대와 무관하게 맞는 날짜가 나오게 한다.
function kstDateParts(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = {};
  parts.forEach((p) => (map[p.type] = p.value));
  return map;
}

function formatDate(d) {
  const { year, month, day } = kstDateParts(d);
  return `${year}${month}${day}`;
}

function formatDateDot(d) {
  const { year, month, day } = kstDateParts(d);
  return `${year}. ${month}. ${day}`;
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
