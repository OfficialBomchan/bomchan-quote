"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function won(n) {
  return (n || 0).toLocaleString("ko-KR") + "원";
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={null}>
      <NewQuoteForm />
    </Suspense>
  );
}

function NewQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyFromId = searchParams.get("copyFrom");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDatetime, setDeliveryDatetime] = useState("");
  const [customerRequest, setCustomerRequest] = useState("");
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [freight, setFreight] = useState(0);
  const [priceItems, setPriceItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(
    "리드타임 : 2일\n파손율 5% 감안\n주문단위 PLT\n입금계좌 : 신한은행 140-014-874487 ㈜봄찬"
  );
  const [companyMatches, setCompanyMatches] = useState([]);
  const [companyLookupMsg, setCompanyLookupMsg] = useState("");
  const [lookingUpCompany, setLookingUpCompany] = useState(false);

  async function lookupCompany(name) {
    const q = (name || "").trim();
    if (!q) {
      setCompanyMatches([]);
      setCompanyLookupMsg("");
      return;
    }
    setLookingUpCompany(true);
    try {
      const res = await fetch(`/api/notion-company?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error) {
        setCompanyMatches([]);
        setCompanyLookupMsg(data.error);
        return;
      }
      const results = data.results || [];
      if (results.length === 0) {
        setCompanyMatches([]);
        setCompanyLookupMsg("노션에서 일치하는 업체를 찾지 못했습니다.");
      } else if (results.length === 1) {
        applyCompanyMatch(results[0]);
        setCompanyMatches([]);
        setCompanyLookupMsg(`노션에서 "${results[0].name}" 정보를 불러왔습니다.`);
      } else {
        setCompanyMatches(results);
        setCompanyLookupMsg("일치하는 업체가 여러 개입니다. 아래에서 선택해주세요.");
      }
    } finally {
      setLookingUpCompany(false);
    }
  }

  function applyCompanyMatch(match) {
    setCompany(match.name);
    if (match.contact) setContactName(match.contact);
    if (match.phone) setContactPhone(match.phone);
    if (match.address && match.address !== "미상") setDeliveryAddress(match.address);
    setCompanyMatches([]);
    setCompanyLookupMsg(`노션에서 "${match.name}" 정보를 불러왔습니다.`);
  }

  useEffect(() => {
    fetch("/api/price-items")
      .then((r) => r.json())
      .then((d) => setPriceItems((d.items || []).filter((p) => !p.discontinued)));
  }, []);

  useEffect(() => {
    if (!copyFromId) return;
    fetch(`/api/quotes/${copyFromId}`)
      .then((r) => r.json())
      .then((d) => {
        const qu = d.quote;
        if (!qu) return;
        setCompany(qu.company || "");
        setContactName(qu.contact_name || "");
        setContactPhone(qu.contact_phone || "");
        setDeliveryAddress(qu.delivery_address || "");
        setDeliveryDatetime(qu.delivery_datetime || "");
        setCustomerRequest(qu.customer_request || "");
        setNotes(qu.notes || "");
        const freightItem = qu.items.find((it) => it.name === "운임");
        setFreight(freightItem ? freightItem.unitPrice : 0);
        setItems(
          qu.items
            .filter((it) => it.name !== "운임")
            .map((it, i) => ({
              key: `copy-${i}-${Date.now()}`,
              name: it.name,
              spec: it.spec,
              priceItemId: null,
              eaQty: it.qty,
              eaUnitPrice: it.unitPrice,
              needsReview: false,
              reviewReason: "",
              note: it.note,
              suggestions: [],
            }))
        );
      });
  }, [copyFromId]);

  async function handleParse() {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (data.company) {
        setCompany(data.company);
        lookupCompany(data.company);
      }
      if (data.freight) setFreight(data.freight);
      setItems(
        (data.lineItems || []).map((li, i) => ({
          ...li,
          key: i + "-" + Date.now(),
        }))
      );
    } finally {
      setParsing(false);
    }
  }

  function updateItem(key, patch) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function pickSuggestion(key, priceItem) {
    const eaUnitPrice = Math.ceil(priceItem.pallet_price / priceItem.pallet_qty);
    updateItem(key, {
      name: priceItem.name,
      spec: priceItem.spec,
      priceItemId: priceItem.id,
      eaUnitPrice,
      needsReview: false,
      reviewReason: "",
    });
  }

  function addBlankItem() {
    setItems((prev) => [
      ...prev,
      {
        key: "manual-" + Date.now(),
        name: "",
        spec: "",
        priceItemId: null,
        eaQty: 1,
        eaUnitPrice: 0,
        needsReview: true,
        reviewReason: "직접 입력",
        note: "EA",
        suggestions: [],
      },
    ]);
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  const supplyTotal = items.reduce((s, it) => s + (it.eaUnitPrice || 0) * (it.eaQty || 0), 0);
  const freightNum = Number(freight) || 0;
  const vatTotal = Math.round((supplyTotal + freightNum) * 0.1);
  const grandTotal = supplyTotal + freightNum + vatTotal;
  const hasReviewNeeded = items.some((it) => it.needsReview);

  async function handleSave() {
    if (items.length === 0) {
      alert("품목을 1개 이상 추가해주세요.");
      return;
    }
    if (hasReviewNeeded && !confirm("'확인 필요' 품목이 있습니다. 그래도 저장할까요?")) return;

    setSaving(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          contactName,
          contactPhone,
          deliveryAddress,
          deliveryDatetime,
          customerRequest,
          quoteDate,
          notes,
          freight: freightNum,
          freightNote: "회",
          rawInput: rawText,
          items: items.map((it) => ({
            name: it.name,
            spec: it.spec,
            eaQty: Number(it.eaQty) || 0,
            eaUnitPrice: Number(it.eaUnitPrice) || 0,
            note: it.note,
          })),
        }),
      });
      const data = await res.json();
      if (data.id) router.push(`/quotes/${data.id}`);
      else alert(data.error || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>새 견적서 작성</h1>
      <p className="subtle">채팅하듯 편하게 입력하면 품목을 자동으로 단가표와 매칭해 드립니다.</p>

      <div className="card">
        <label>입력 (예: 업체명, 제품, 사이즈, 수량PLT/EA, 운임)</label>
        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="업체명, 품목1 수량, 품목2 수량, 운임 금액" />
        <div className="flex gap-top">
          <button className="primary" onClick={handleParse} disabled={parsing}>
            {parsing ? "분석 중..." : "견적서 생성"}
          </button>
          <button onClick={addBlankItem}>품목 직접 추가</button>
          <span className="subtle">단가표 품목 {priceItems.length}개 로드됨</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="card">
          <h2>미리보기 — 확인 후 수정하세요</h2>

          <label>수신(업체명) — 선택사항, 비워두면 공란으로 생성됩니다</label>
          <div className="flex" style={{ gap: 8 }}>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onBlur={() => lookupCompany(company)}
              placeholder="예: 전국구조경 (비워둬도 됩니다)"
            />
            <button type="button" onClick={() => lookupCompany(company)} disabled={lookingUpCompany}>
              {lookingUpCompany ? "조회 중..." : "노션에서 조회"}
            </button>
          </div>
          {companyLookupMsg && <div className="subtle" style={{ marginTop: 4 }}>{companyLookupMsg}</div>}
          {companyMatches.length > 0 && (
            <select
              className="gap-top"
              defaultValue=""
              onChange={(e) => {
                const m = companyMatches.find((c) => c.id === e.target.value);
                if (m) applyCompanyMatch(m);
              }}
            >
              <option value="">후보에서 선택...</option>
              {companyMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.contact ? `· ${m.contact}` : ""} {m.region ? `(${m.region} ${m.detailRegion || ""})` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-top" style={{ gap: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <label>담당자</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <label>연락처</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <label>견적일</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
          </div>
          <label>배송지</label>
          <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />

          <table className="gap-top item-table">
            <thead>
              <tr>
                <th>품목명 / 규격</th>
                <th>단위</th>
                <th className="num">수량(EA)</th>
                <th className="num">EA단가</th>
                <th className="num">공급가액</th>
                <th>비고</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key} className={it.needsReview ? "row-warn" : ""}>
                  <td data-label="품목명 / 규격" className="item-name-cell">
                    {it.needsReview && <span className="badge warn">확인 필요</span>}
                    <div className="flex" style={{ marginTop: 4 }}>
                      <input value={it.name} onChange={(e) => updateItem(it.key, { name: e.target.value })} />
                    </div>
                    <input
                      style={{ marginTop: 4, fontSize: 12 }}
                      value={it.spec}
                      placeholder="규격"
                      onChange={(e) => updateItem(it.key, { spec: e.target.value })}
                    />
                    {it.suggestions && it.suggestions.length > 0 && (
                      <select
                        style={{ marginTop: 4, fontSize: 12, maxWidth: "100%" }}
                        defaultValue=""
                        onChange={(e) => {
                          const sel = it.suggestions.find((s) => String(s.id) === e.target.value);
                          if (sel) pickSuggestion(it.key, sel);
                        }}
                      >
                        <option value="">후보에서 선택...</option>
                        {it.suggestions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.spec} ({s.pallet_price.toLocaleString()}원/PLT, {s.pallet_qty}EA)
                          </option>
                        ))}
                      </select>
                    )}
                    {it.rawText && <div className="subtle" style={{ marginTop: 2 }}>원문: {it.rawText}</div>}
                  </td>
                  <td data-label="단위">EA</td>
                  <td data-label="수량(EA)" className="num">
                    <input
                      type="number"
                      className="num-input"
                      style={{ textAlign: "right" }}
                      value={it.eaQty}
                      onChange={(e) => updateItem(it.key, { eaQty: e.target.value })}
                    />
                  </td>
                  <td data-label="EA단가" className="num">
                    <input
                      type="number"
                      className="num-input"
                      style={{ textAlign: "right" }}
                      value={it.eaUnitPrice || 0}
                      onChange={(e) => updateItem(it.key, { eaUnitPrice: e.target.value })}
                    />
                  </td>
                  <td data-label="공급가액" className="num">{won((it.eaUnitPrice || 0) * (it.eaQty || 0))}</td>
                  <td data-label="비고">
                    <input value={it.note || ""} onChange={(e) => updateItem(it.key, { note: e.target.value })} className="note-input" />
                  </td>
                  <td data-label="">
                    <button className="small danger" onClick={() => removeItem(it.key)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex-between gap-top">
            <label style={{ margin: 0 }}>운임 (수동 입력, 부가세 별도 10%)</label>
            <input
              type="number"
              style={{ width: 160, textAlign: "right" }}
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>

          <label>특이사항 (줄바꿈으로 구분)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 70 }} />

          <div className="flex gap-top" style={{ gap: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <label style={{ marginTop: 0 }}>납기일시</label>
              <input
                value={deliveryDatetime}
                onChange={(e) => setDeliveryDatetime(e.target.value)}
                placeholder="예: 10/20(월) 오전 중"
              />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <label style={{ marginTop: 0 }}>고객 요청사항</label>
              <input
                value={customerRequest}
                onChange={(e) => setCustomerRequest(e.target.value)}
                placeholder="예: 하차 시 전화 요망"
              />
            </div>
          </div>

          <div className="card" style={{ background: "var(--gray-50)", marginTop: 16, marginBottom: 0 }}>
            <div className="flex-between">
              <span>공급가액 합계</span>
              <span>{won(supplyTotal + freightNum)}</span>
            </div>
            <div className="flex-between">
              <span>부가세</span>
              <span>{won(vatTotal)}</span>
            </div>
            <div className="flex-between" style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>
              <span>합계 (VAT 포함)</span>
              <span>{won(grandTotal)}</span>
            </div>
          </div>

          <div className="flex gap-top">
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "견적서 확정 및 저장"}
            </button>
            {hasReviewNeeded && <span className="badge warn">확인 필요 품목이 있습니다</span>}
          </div>
        </div>
      )}
    </>
  );
}
