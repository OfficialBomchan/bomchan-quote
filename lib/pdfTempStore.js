const fs = require("fs");
const path = require("path");

// 아이폰 사파리의 "파일에 저장"이 안정적으로 동작하려면, PDF를 일반 GET 링크로
// 다시 받을 수 있어야 한다(POST 응답은 사파리가 재요청을 못 해서 저장이 실패함).
// 서버 메모리(JS 변수)는 Next.js 개발 모드에서 요청마다 모듈이 다시 로드되며
// 초기화될 수 있어 믿을 수 없어서, 파일로 잠깐 저장해뒀다가 뒤이은 GET 요청에서
// 한 번 내려준 뒤 지운다.
const TEMP_DIR = path.join(process.cwd(), "data", "tmp-pdfs");
const TTL_MS = 5 * 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupExpired() {
  ensureDir();
  const now = Date.now();
  for (const name of fs.readdirSync(TEMP_DIR)) {
    if (!name.endsWith(".json")) continue;
    const metaPath = path.join(TEMP_DIR, name);
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta.expiresAt < now) {
        fs.rmSync(metaPath, { force: true });
        fs.rmSync(metaPath.replace(/\.json$/, ".pdf"), { force: true });
      }
    } catch {
      // 손상된 메타파일은 무시
    }
  }
}

function put(bytes, fileName) {
  ensureDir();
  cleanupExpired();
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  fs.writeFileSync(path.join(TEMP_DIR, `${token}.pdf`), bytes);
  fs.writeFileSync(
    path.join(TEMP_DIR, `${token}.json`),
    JSON.stringify({ fileName, expiresAt: Date.now() + TTL_MS })
  );
  return token;
}

function take(token) {
  ensureDir();
  const metaPath = path.join(TEMP_DIR, `${token}.json`);
  const pdfPath = path.join(TEMP_DIR, `${token}.pdf`);
  if (!fs.existsSync(metaPath) || !fs.existsSync(pdfPath)) return null;

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
  const bytes = fs.readFileSync(pdfPath);
  fs.rmSync(metaPath, { force: true });
  fs.rmSync(pdfPath, { force: true });
  if (meta.expiresAt < Date.now()) return null;
  return { bytes, fileName: meta.fileName };
}

module.exports = { put, take };
