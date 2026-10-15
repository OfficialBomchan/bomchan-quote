"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

function won(n) {
  return (n || 0).toLocaleString("ko-KR") + "원";
}

// 파일명에 못 쓰는 문자(\ / : * ? " < > |)를 지우고, 업체명이 있으면 앞에 붙여준다.
function buildPdfFileName(quote) {
  const company = (quote.company || "").trim().replace(/[\\/:*?"<>|]/g, "");
  return company ? `${company}_${quote.quote_no}.pdf` : `${quote.quote_no}.pdf`;
}

// 자갈/마사토/폴라이트/황토볼 같은 입자류는 규격이 "20-30"처럼 입자 크기(mm)
// 범위라서 뒤에 mm을 붙여준다. 판석류는 두께(T) 표기라 단위가 달라 건드리지 않는다.
function formatSpec(name, spec) {
  if (!spec) return spec;
  if (/판석/.test(name || "")) return spec;
  if (/^\d+\s*-\s*\d+$/.test(spec.trim())) return `${spec}mm`;
  return spec;
}

// .quote-doc의 CSS max-width와 같은 값. 화면 폭이 이보다 좁을 때(모바일)
// 레이아웃을 다시 짜지(reflow) 않고 데스크톱 모습 그대로 통째로 축소해서,
// 다운로드되는 PDF와 똑같은 비율로 보이게 한다.
const DOC_DESIGN_WIDTH = 820;

export default function QuoteDetailPage() {
  const { id } = useParams();
  const [quote, setQuote] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState("");
  const [docZoom, setDocZoom] = useState(1);
  const quoteRef = useRef(null);
  const docWrapRef = useRef(null);

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then((r) => r.json())
      .then((d) => setQuote(d.quote));
  }, [id]);

  useEffect(() => {
    function updateZoom() {
      if (!docWrapRef.current) return;
      const available = docWrapRef.current.clientWidth;
      setDocZoom(available < DOC_DESIGN_WIDTH ? available / DOC_DESIGN_WIDTH : 1);
    }
    updateZoom();
    window.addEventListener("resize", updateZoom);
    return () => window.removeEventListener("resize", updateZoom);
  }, [quote]);

  async function handleDownloadPdf() {
    if (!quoteRef.current || downloading) return;

    // 아이폰 사파리는 자바스크립트로 blob URL을 직접 열거나 POST 응답을 저장하는 걸
    // 잘 못 한다. 그래서 아이폰에서는 1) 서버에 스크린샷을 보내 PDF를 만들고,
    // 2) 그 결과를 "평범한 GET 링크"로 다시 받아오는 2단계 방식을 쓴다 — GET 링크여야
    // 사파리의 "공유 > 파일에 저장"이 안정적으로 동작한다.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    setDownloading(true);
    setDownloadMsg("");
    // 화면에서 보기 좋으라고 걸어둔 축소(zoom)를 캡처 직전엔 잠깐 풀어야 한다.
    // 안 풀면 캡처 자체가 축소된 채로 찍혀서 PDF 결과물이 작게 나온다.
    setDocZoom(1);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const html2canvas = (await import("html2canvas")).default;

      // 모바일 화면 폭과 상관없이 항상 PC(데스크톱) 레이아웃 기준으로 캡처해서
      // PDF 결과물이 어느 기기에서 만들든 동일하게 나오게 한다.
      const DESKTOP_CAPTURE_WIDTH = 900;
      const canvas = await html2canvas(quoteRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: DESKTOP_CAPTURE_WIDTH,
        windowHeight: Math.max(1600, quoteRef.current.scrollHeight + 200),
      });
      const imgData = canvas.toDataURL("image/png");

      if (isIOS) {
        setDownloadMsg("PDF를 만들고 있습니다...");
        const res = await fetch(`/api/quotes/${quote.id}/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imgData, fileName: buildPdfFileName(quote) }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setDownloadMsg(data.error || "PDF 생성에 실패했습니다.");
          return;
        }
        setDownloadMsg("PDF로 이동합니다. 공유 버튼(⬆️)을 눌러 '파일에 저장'을 선택해주세요. (뒤로가기로 돌아올 수 있어요)");
        window.location.href = data.url;
        return;
      }

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let renderWidth = pageWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;
      if (renderHeight > pageHeight) {
        renderHeight = pageHeight;
        renderWidth = (canvas.width * renderHeight) / canvas.height;
      }
      const x = (pageWidth - renderWidth) / 2;
      const y = 0;

      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      const fileName = buildPdfFileName(quote);
      pdf.save(fileName);
      setDownloadMsg(`"${fileName}" 파일이 다운로드 폴더에 저장됐습니다 (A4, ${pageWidth}×${pageHeight}mm).`);
    } catch (err) {
      setDownloadMsg("PDF 생성 중 오류가 발생했습니다: " + (err?.message || err));
    } finally {
      setDownloading(false);
      if (docWrapRef.current) {
        const available = docWrapRef.current.clientWidth;
        setDocZoom(available < DOC_DESIGN_WIDTH ? available / DOC_DESIGN_WIDTH : 1);
      }
    }
  }

  if (!quote) return <p className="subtle">불러오는 중...</p>;

  const notesLines = (quote.notes || "").split("\n").filter(Boolean);

  return (
    <>
      <div className="flex-between no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{quote.quote_no}</h1>
        <div className="flex">
          <a className="link" href={`/?copyFrom=${quote.id}`}>복사해서 새로 만들기</a>
          <button onClick={() => window.print()}>인쇄</button>
          <button className="primary" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? "PDF 생성 중..." : "PDF 다운로드"}
          </button>
        </div>
      </div>
      {downloadMsg && <p className="subtle no-print" style={{ marginTop: -10, marginBottom: 16 }}>{downloadMsg}</p>}

      <div ref={docWrapRef}>
      <div className="quote-doc" ref={quoteRef} style={{ zoom: docZoom }}>
        <div className="quote-header">
          <div>
            <div className="company">㈜봄찬</div>
            <div className="tag">B2B · B</div>
            <div className="slogan">전세계 석재를 전국 어디서나 가장 합리적으로</div>
          </div>
          <div className="title-block">
            <div className="title">견 적 서</div>
            <div className="quote-no">견적번호 · {quote.quote_no}</div>
          </div>
        </div>

        <div className="info-boxes">
          <div className="info-box">
            <div className="label">수신</div>
            <div className="main">{quote.company}</div>
            {quote.contact_name && <div className="sub">{quote.contact_name}</div>}
          </div>
          <div className="info-box">
            <div className="label">견적일</div>
            <div className="main">{quote.quote_date}</div>
            <div className="sub">유효기간 {quote.valid_until}까지</div>
          </div>
        </div>

        <table className="quote-table">
          <thead>
            <tr>
              <th>품목명</th>
              <th>단위</th>
              <th className="num">수량</th>
              <th className="num">단가</th>
              <th className="num col-money">공급가액</th>
              <th className="num">부가세</th>
              <th className="num col-money">합계</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={i}>
                <td>
                  {it.name}
                  {it.spec && <div className="item-spec">{formatSpec(it.name, it.spec)}</div>}
                </td>
                <td>{it.unit}</td>
                <td className="num">{it.qty.toLocaleString()}</td>
                <td className="num">{it.unitPrice.toLocaleString()}</td>
                <td className="num col-money">{it.supply.toLocaleString()}</td>
                <td className="num">{it.vat.toLocaleString()}</td>
                <td className="num col-money">{it.total.toLocaleString()}</td>
                <td>{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="total-bar">
          <span>합계 (VAT 포함)</span>
          <span className="amount">{won(quote.total_amount)}</span>
        </div>

        {(notesLines.length > 0 || quote.delivery_address || quote.delivery_datetime || quote.customer_request || quote.contact_name) && (
          <div className="notes-box">
            <div className="title">특이사항</div>
            {notesLines.map((line, i) => (
              <div key={i}>* {line}</div>
            ))}
            {quote.delivery_datetime && <div>* 납기일시 : {quote.delivery_datetime}</div>}
            {quote.delivery_address && <div>* 배송지 : {quote.delivery_address}</div>}
            {quote.contact_name && <div>* 연락처 : {quote.contact_name} · {quote.contact_phone}</div>}
            {quote.customer_request && <div>* 고객 요청사항 : {quote.customer_request}</div>}
          </div>
        )}

        <div className="quote-footer">
          <div className="valid-text">본 견적서는 발행일로부터 21일간 유효합니다.</div>
          <div className="manager-block">
            {quote.manager_avatar_path ? (
              <img className="avatar" src={quote.manager_avatar_path} alt="" />
            ) : (
              <div className="avatar">{quote.manager_name?.slice(0, 1)}</div>
            )}
            <div className="manager">
              <div className="name">{quote.manager_name}</div>
              <div>{quote.manager_title}</div>
              <div>{quote.manager_phone}</div>
              <div>{quote.manager_email}</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
