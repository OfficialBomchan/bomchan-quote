"use client";

import { useEffect, useState } from "react";

const emptyForm = { name: "", spec: "", pallet_qty: "", pallet_price: "", note: "" };

export default function AdminPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showDiscontinued, setShowDiscontinued] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  function load() {
    fetch("/api/price-items")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }
  useEffect(load, []);

  async function handleSyncSheet() {
    if (!confirm("구글 시트의 최신 단가로 단가표 전체를 교체합니다. 계속할까요?")) return;
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/price-items/sync-sheet", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg(data.error || "동기화 실패");
        return;
      }
      setSyncMsg(`${data.count}개 품목으로 동기화 완료 (단종 ${data.discontinuedCount}개 포함).`);
      load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: form.name,
      spec: form.spec,
      pallet_qty: Number(form.pallet_qty),
      pallet_price: Number(form.pallet_price),
      note: form.note,
    };
    if (editingId) {
      await fetch(`/api/price-items/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, discontinued: items.find((i) => i.id === editingId)?.discontinued }),
      });
    } else {
      await fetch("/api/price-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      spec: item.spec,
      pallet_qty: item.pallet_qty,
      pallet_price: item.pallet_price,
      note: item.note,
    });
  }

  async function toggleDiscontinued(item) {
    await fetch(`/api/price-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, discontinued: item.discontinued ? 0 : 1 }),
    });
    load();
  }

  async function deleteItem(item) {
    if (!confirm(`"${item.name} ${item.spec}" 품목을 완전히 삭제할까요? (단종 처리를 권장합니다)`)) return;
    await fetch(`/api/price-items/${item.id}`, { method: "DELETE" });
    load();
  }

  async function handleUpload() {
    if (!csvText.trim()) return;
    if (!confirm("현재 단가표 전체를 업로드한 CSV 내용으로 교체합니다. 계속할까요?")) return;
    const res = await fetch("/api/price-items/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText }),
    });
    const data = await res.json();
    if (data.ok) {
      setUploadMsg(`${data.count}개 품목으로 교체 완료.`);
      setCsvText("");
      load();
    } else {
      setUploadMsg(data.error || "업로드 실패");
    }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result));
    reader.readAsText(file, "utf-8");
  }

  const visible = items.filter((i) => showDiscontinued || !i.discontinued);

  return (
    <>
      <h1>단가표 관리</h1>
      <p className="subtle">단가표는 PLT 기준입니다. 견적서는 자동으로 EA 단가(올림)로 환산해서 보여줍니다.</p>

      <div className="card">
        <h2>구글 시트에서 최신 단가 가져오기</h2>
        <p className="subtle">
          봄찬 "도매단가표 (PLT)" 구글 시트와 연동되어 있습니다. 시트에서 단가를 수정하신 뒤 아래 버튼을 누르면
          바로 반영됩니다. 시트의 특이사항 칸에 "단종"이라고 적으면 자동으로 단종 처리됩니다.
        </p>
        <div className="flex gap-top">
          <button className="primary" onClick={handleSyncSheet} disabled={syncing}>
            {syncing ? "가져오는 중..." : "구글 시트에서 가져오기"}
          </button>
          {syncMsg && <span className="subtle">{syncMsg}</span>}
        </div>
      </div>

      <div className="card">
        <h2>엑셀/CSV로 전체 교체</h2>
        <p className="subtle">
          헤더: 품목명,규격,PLT수량,PLT단가,특이사항,단종여부(1 또는 공백). 엑셀에서 "CSV UTF-8로 저장" 후 업로드하세요.
        </p>
        <input type="file" accept=".csv" onChange={onFile} />
        <textarea className="gap-top" rows={5} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="CSV 내용 붙여넣기도 가능합니다" />
        <div className="flex gap-top">
          <button className="primary" onClick={handleUpload}>전체 교체 업로드</button>
          {uploadMsg && <span className="subtle">{uploadMsg}</span>}
        </div>
      </div>

      <div className="card">
        <h2>{editingId ? "품목 수정" : "품목 추가"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="flex" style={{ gap: 12 }}>
            <div className="col" style={{ flex: 2 }}>
              <label>품목명</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <label>규격</label>
              <input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} />
            </div>
          </div>
          <div className="flex" style={{ gap: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <label>PLT 수량(EA)</label>
              <input required type="number" value={form.pallet_qty} onChange={(e) => setForm({ ...form, pallet_qty: e.target.value })} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <label>PLT 단가(원)</label>
              <input required type="number" value={form.pallet_price} onChange={(e) => setForm({ ...form, pallet_price: e.target.value })} />
            </div>
          </div>
          <label>특이사항</label>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="flex gap-top">
            <button className="primary" type="submit">{editingId ? "수정 저장" : "추가"}</button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex-between">
          <h2>품목 목록 ({visible.length})</h2>
          <label style={{ margin: 0 }}>
            <input type="checkbox" checked={showDiscontinued} onChange={(e) => setShowDiscontinued(e.target.checked)} style={{ width: "auto", marginRight: 6 }} />
            단종 품목도 표시
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>품목명</th>
              <th>규격</th>
              <th className="num">PLT수량</th>
              <th className="num">PLT단가</th>
              <th className="num">EA단가(올림)</th>
              <th>특이사항</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((it) => (
              <tr key={it.id} className={it.discontinued ? "row-warn" : ""}>
                <td>{it.name}</td>
                <td>{it.spec}</td>
                <td className="num">{it.pallet_qty}</td>
                <td className="num">{it.pallet_price.toLocaleString()}</td>
                <td className="num">{Math.ceil(it.pallet_price / it.pallet_qty).toLocaleString()}</td>
                <td className="subtle">{it.note}</td>
                <td>
                  {it.discontinued ? <span className="badge off">단종</span> : <span className="badge ok">판매중</span>}
                </td>
                <td>
                  <div className="flex">
                    <button className="small" onClick={() => startEdit(it)}>수정</button>
                    <button className="small" onClick={() => toggleDiscontinued(it)}>
                      {it.discontinued ? "복구" : "단종처리"}
                    </button>
                    <button className="small danger" onClick={() => deleteItem(it)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
