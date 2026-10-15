// 노션 "업체 DB"에서 업체명으로 담당자/연락처/주소를 찾아온다.
// 완전히 정확한 이름이 아니어도(오타, 일부만 입력 등) 유사한 업체를 후보로
// 보여줄 수 있도록, 노션 자체 필터(정확한 부분일치)로 1차로 걸러보고
// 결과가 없으면 전체 목록을 가져와서 글자 유사도로 다시 순위를 매긴다.
function getText(prop) {
  return (prop?.rich_text || []).map((t) => t.plain_text).join("");
}
function getTitle(prop) {
  return (prop?.title || []).map((t) => t.plain_text).join("");
}

function normalize(s) {
  return String(s || "").toLowerCase().replace(/[\s()·.,]/g, "");
}

function bigrams(s) {
  const n = normalize(s);
  if (n.length < 2) return new Set([n]);
  const set = new Set();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Jaccard 유사도 + 포함비율(bigram 기반)에 더해, 글자 편집거리(한두 글자만
// 다른 오타)도 함께 본다. 업체명이 보통 3~6글자로 짧다 보니 한 글자만 틀려도
// bigram은 거의 다 안 겹쳐버리는데("몬토화분" vs "몬트화분"), 편집거리를 같이
// 보면 이런 "한 글자 오타"도 높은 점수로 잘 잡힌다.
function similarity(a, b) {
  const setA = bigrams(a);
  const setB = bigrams(b);
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  const union = setA.size + setB.size - inter;
  const jaccardScore = union === 0 ? 0 : inter / union;
  const minSize = Math.min(setA.size, setB.size);
  const overlapScore = minSize === 0 ? 0 : inter / minSize;
  const bigramScore = jaccardScore * 0.5 + overlapScore * 0.5;

  const na = normalize(a);
  const nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length) || 1;
  const editScore = 1 - levenshtein(na, nb) / maxLen;

  return bigramScore * 0.5 + editScore * 0.5;
}

function mapPage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: getTitle(p["이름"]),
    contact: getText(p["담당자"]),
    phone: p["연락처"]?.phone_number || "",
    address: getText(p["주소"]),
    email: p["이메일"]?.email || "",
    region: p["지역"]?.select?.name || "",
    detailRegion: p["상세지역"]?.select?.name || "",
  };
}

async function queryNotion(apiKey, dbId, body) {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "노션 조회에 실패했습니다.");
  }
  return res.json();
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return Response.json({ results: [] });

  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_COMPANY_DB_ID;
  if (!apiKey || !dbId) {
    return Response.json({ results: [], error: "노션 연동이 아직 설정되지 않았습니다." });
  }

  try {
    // 1차: 노션 자체 필터로 정확한 부분일치부터 찾아본다 (빠르고 저렴).
    const exactData = await queryNotion(apiKey, dbId, {
      filter: { property: "이름", title: { contains: q } },
      page_size: 5,
    });
    let results = (exactData.results || []).map(mapPage);

    // 부분일치로 못 찾았으면(오타, 띄어쓰기 차이 등), 입력어의 2글자 조각(bigram) 중
    // 하나라도 이름에 포함되는 업체들을 노션 자체 OR 필터로 넓게 걸러온 다음,
    // 글자 유사도로 다시 순위를 매긴다. 전체 목록을 다 가져오는 것보다 훨씬 빠르고,
    // DB가 몇백~몇천 건이어도 놓치는 후보가 없다.
    if (results.length === 0) {
      const normalized = q.replace(/[\s()·.,]/g, "");
      const chunks = new Set();
      for (let i = 0; i < normalized.length - 1; i++) chunks.add(normalized.slice(i, i + 2));
      if (normalized.length === 1) chunks.add(normalized);

      let all = [];
      if (chunks.size > 0) {
        const orFilters = [...chunks]
          .slice(0, 10) // 노션 compound filter 한도 고려
          .map((c) => ({ property: "이름", title: { contains: c } }));
        const data = await queryNotion(apiKey, dbId, {
          filter: orFilters.length === 1 ? orFilters[0] : { or: orFilters },
          page_size: 100,
        });
        all = data.results || [];
      }

      const scored = all
        .map((page) => ({ item: mapPage(page), score: similarity(q, getTitle(page.properties["이름"])) }))
        .filter((s) => s.score >= 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      results = scored.map((s) => s.item);
    }

    return Response.json({ results });
  } catch (err) {
    return Response.json({ results: [], error: err.message || "노션 조회에 실패했습니다." });
  }
}
