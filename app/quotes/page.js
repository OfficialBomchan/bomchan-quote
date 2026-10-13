"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function QuoteHistoryPage() {
  const [quotes, setQuotes] = useState([]);
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [me, setMe] = useState(null);

  function load(query, mine) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (mine) params.set("mine", "1");
    const qs = params.toString();
    fetch(`/api/quotes${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => setQuotes(d.quotes || []));
  }

  useEffect(() => {
    load("", false);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user));
  }, []);

  function toggleMine(checked) {
    setMineOnly(checked);
    load(q, checked);
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
            onKeyDown={(e) => e.key === "Enter" && load(q, mineOnly)}
          />
          <button className="primary" onClick={() => load(q, mineOnly)}>검색</button>
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
