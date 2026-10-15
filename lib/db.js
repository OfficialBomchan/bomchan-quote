const { Pool } = require("pg");

// AWS RDS(Postgres)를 쓴다. Render 무료 요금제의 "서버 재시작마다 로컬 파일 DB가
// 초기화되는" 문제를 피하려고 node:sqlite(파일 DB) 대신 외부 영구 DB로 옮겼다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const NOW_KST = `to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`;

const schemaReady = pool
  .query(
    `
CREATE TABLE IF NOT EXISTS price_versions (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT ${NOW_KST}
);

CREATE TABLE IF NOT EXISTS price_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '',
  pallet_qty INTEGER NOT NULL,
  pallet_price INTEGER NOT NULL,
  note TEXT DEFAULT '',
  discontinued INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT ${NOW_KST}
);

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
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
  created_at TEXT NOT NULL DEFAULT ${NOW_KST},
  manager_avatar_path TEXT DEFAULT '',
  delivery_datetime TEXT DEFAULT '',
  customer_request TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW_KST},
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  title TEXT DEFAULT '㈜봄찬 · 매니저',
  avatar_path TEXT DEFAULT ''
);
`
  )
  .catch((err) => {
    console.error("DB 스키마 초기화 실패:", err);
    throw err;
  });

// SQLite(?) 자리표시자를 Postgres($1,$2,...) 자리표시자로 자동 변환해서,
// 호출하는 쪽(API 라우트) 코드는 그대로 "?"를 쓸 수 있게 한다.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function prepare(sql) {
  const pgSql = toPgSql(sql);
  return {
    async get(...params) {
      await schemaReady;
      const res = await pool.query(pgSql, params);
      return res.rows[0];
    },
    async all(...params) {
      await schemaReady;
      const res = await pool.query(pgSql, params);
      return res.rows;
    },
    async run(...params) {
      await schemaReady;
      const res = await pool.query(pgSql, params);
      return {
        lastInsertRowid: res.rows[0]?.id,
        changes: res.rowCount,
      };
    },
  };
}

async function exec(sql) {
  await schemaReady;
  await pool.query(sql);
}

// better-sqlite3 스타일의 동기 트랜잭션 API를 그대로 흉내내되, 내부적으로는
// Postgres 클라이언트 하나를 빌려서 BEGIN/COMMIT/ROLLBACK으로 처리한다.
// 호출하는 쪽에서 반환되는 함수를 await 해야 한다(기존엔 동기였지만 이제 비동기).
function transaction(fn) {
  return async (...args) => {
    await schemaReady;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = {
        prepare: (sql) => {
          const pgSql = toPgSql(sql);
          return {
            async get(...params) {
              const res = await client.query(pgSql, params);
              return res.rows[0];
            },
            async all(...params) {
              const res = await client.query(pgSql, params);
              return res.rows;
            },
            async run(...params) {
              const res = await client.query(pgSql, params);
              return { lastInsertRowid: res.rows[0]?.id, changes: res.rowCount };
            },
          };
        },
      };
      const result = await fn(...args, txDb);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  };
}

module.exports = { prepare, exec, transaction, pool };
