"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function QuoteHistoryPage() {
  const [quotes, setQuotes] = useState([]);
  const [q, setQ] = useState("");
  const [manager, setManager] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [me, setMe] = useState(null);

  function load(filters) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.manager) params.set("manager", filters.manager);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.mine) params.set("mine", "1");
    const qs = params.toString();
    fetch(`/api/quotes${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => setQuotes(d.quotes || []));
  }

  function currentFilters(overrides) {
    return { q, manager, from, to, mine: mineOnly, ...overrides };
  }

  useEffect(() => {
    load(currentFilters());
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMine(checked) {
    setMineOnly(checked);
    load(currentFilters({ mine: checked }));
  }

  function resetFilters() {
    setQ("");
    setManager("");
    setFrom("");
    setTo("");
    setMineOnly(false);
    load({});
  }

  return (
    <>
      <h1>견적 이력</h1>
      <div className="card">
        <div className="flex">
          <input
            placeholder="업체명 또는 견적번호 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(currentFilters())}
            style={{ flex: 2, minWidth: 180 }}
          />
          <input
            placeholder="작성자(담당자)"
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(currentFilters())}
            style={{ flex: 1, minWidth: 120 }}
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: 150 }}
            aria-label="견적일 시작"
          />
          <span className="subtle">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: 150 }}
            aria-label="견적일 끝"
          />
          <button className="primary" onClick={() => load(currentFilters())}>검색</button>
          <button onClick={resetFilters}>초기화</button>
          <label style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => toggleMine(e.target.checked)}
              style={{ width: "auto", marginRight: 6 }}
            />
            내가 작성한 것만 보기
          </label>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>견적번호</th>
              <th>수신</th>
              <th>견적일</th>
              <th>작성자</th>
              <th className="num">합계(VAT포함)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((qu) => (
              <tr key={qu.id}>
                <td>{qu.quote_no}</td>
                <td>{qu.company}</td>
                <td>{qu.quote_date}</td>
                <td className="subtle">
                  {qu.created_by_name || "-"}
                  {me && qu.created_by_user_id === me.id && <span className="badge ok" style={{ marginLeft: 6 }}>나</span>}
                </td>
                <td className="num">{qu.total_amount.toLocaleString()}원</td>
                <td>
                  <Link className="link" href={`/quotes/${qu.id}`}>보기</Link>
                  {" · "}
                  <Link className="link" href={`/?copyFrom=${qu.id}`}>복사해서 새로 만들기</Link>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={6} className="subtle">저장된 견적서가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
