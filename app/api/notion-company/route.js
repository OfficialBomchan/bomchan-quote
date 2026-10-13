// 노션 "업체 DB"에서 업체명으로 담당자/연락처/주소를 찾아온다.
function getText(prop) {
  return (prop?.rich_text || []).map((t) => t.plain_text).join("");
}
function getTitle(prop) {
  return (prop?.title || []).map((t) => t.plain_text).join("");
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

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "이름", title: { contains: q } },
      page_size: 5,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json({ results: [], error: err.message || "노션 조회에 실패했습니다." });
  }

  const data = await res.json();
  const results = (data.results || []).map((page) => {
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
  });

  return Response.json({ results });
}
