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

// Jaccard 유사도 + 포함비율을 섞어서, 짧은 입력이 긴 업체명 안에 들어있는
// 경우(또는 그 반대)도 잘 잡히게 한다. 단가표 품목 매칭과 같은 방식.
function similarity(a, b) {
  const setA = bigrams(a);
  const setB = bigrams(b);
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  const union = setA.size + setB.size - inter;
  const jaccardScore = union === 0 ? 0 : inter / union;
  const minSize = Math.min(setA.size, setB.size);
  const overlapScore = minSize === 0 ? 0 : inter / minSize;
  return jaccardScore * 0.5 + overlapScore * 0.5;
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

    // 부분일치로 못 찾았으면(오타, 띄어쓰기 차이 등), 전체 업체 목록을 가져와서
    // 글자 유사도로 다시 순위를 매긴다. DB가 너무 크면 최대 3페이지(최대 300건)까지만 본다.
    if (results.length === 0) {
      const all = [];
      let cursor;
      for (let i = 0; i < 3; i++) {
        const page = await queryNotion(apiKey, dbId, {
          page_size: 100,
          start_cursor: cursor,
        });
        all.push(...(page.results || []));
        if (!page.has_more) break;
        cursor = page.next_cursor;
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
