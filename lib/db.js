const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "bomchan.db");

const raw = new DatabaseSync(DB_PATH);

// Next.js의 빌드 단계("collect page data")는 API 라우트마다 이 파일을 각각
// 별도 워커 프로세스에서 require하는데, 그 과정에서 스키마 생성/마이그레이션
// (CREATE TABLE, ALTER TABLE)이 같은 DB 파일에 동시에 실행되면서
// SQLITE_BUSY("database is locked")나 "duplicate column name" 에러가 난다.
// 빌드 단계에서는 실제로 쿼리를 던지지 않으므로(모듈만 분석/번들링됨),
// 이 단계에서는 스키마 초기화를 건너뛴다.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

raw.exec(`PRAGMA journal_mode = WAL;`);
raw.exec(`PRAGMA busy_timeout = 5000;`);

if (!isBuildPhase) {
raw.exec(`
CREATE TABLE IF NOT EXISTS price_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS price_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '',
  pallet_qty INTEGER NOT NULL,
  pallet_price INTEGER NOT NULL,
  note TEXT DEFAULT '',
  discontinued INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_no TEXT UNIQUE NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  quote_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  manager_name TEXT DEFAULT '강다정',
  manager_title TEXT DEFAULT '㈜봄찬 · 매니저',
  manager_phone TEXT DEFAULT '01057384752',
  manager_email TEXT DEFAULT 'dajeong@bomchan.com',
  notes TEXT DEFAULT '',
  items_json TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  raw_input TEXT DEFAULT '',
  created_by_user_id INTEGER,
  created_by_name TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

// 기존에 만들어둔 DB 파일에는 없을 수 있는 컬럼들을 있는지 확인하고 없으면 추가.
function ensureColumn(table, column, ddl) {
  const cols = raw.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) raw.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

ensureColumn("quotes", "created_by_user_id", "created_by_user_id INTEGER");
ensureColumn("quotes", "created_by_name", "created_by_name TEXT DEFAULT ''");
ensureColumn("quotes", "manager_avatar_path", "manager_avatar_path TEXT DEFAULT ''");
ensureColumn("quotes", "delivery_datetime", "delivery_datetime TEXT DEFAULT ''");
ensureColumn("quotes", "customer_request", "customer_request TEXT DEFAULT ''");

ensureColumn("users", "phone", "phone TEXT DEFAULT ''");
ensureColumn("users", "email", "email TEXT DEFAULT ''");
ensureColumn("users", "title", "title TEXT DEFAULT '㈜봄찬 · 매니저'");
ensureColumn("users", "avatar_path", "avatar_path TEXT DEFAULT ''");
}

// node:sqlite(DatabaseSync)를 better-sqlite3와 비슷한 모양으로 감싸서
// 나머지 코드(prepare().run/get/all, transaction)가 그대로 동작하게 한다.
// better-sqlite3는 Windows에서 Python/C++ 빌드 도구가 필요해 이 프로젝트에서는 쓰지 않는다.
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => raw.prepare(sql),
  transaction: (fn) => {
    return (...args) => {
      raw.exec("BEGIN");
      try {
        const result = fn(...args);
        raw.exec("COMMIT");
        return result;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    };
  },
};

module.exports = db;
