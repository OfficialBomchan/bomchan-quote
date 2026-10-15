"use client";

import { useEffect, useRef, useState } from "react";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef(null);

  function load() {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        if (d.user) {
          setName(d.user.name || "");
          setPhone(d.user.phone || "");
          setEmail(d.user.email || "");
          setTitle(d.user.title || "㈜봄찬 · 매니저");
        }
      });
  }
  useEffect(load, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, title }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(data.error || "저장 실패");
        return;
      }
      setSaveMsg("저장되었습니다.");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/auth/avatar", { method: "POST", body: formData });
      let data;
      try {
        data = await res.json();
      } catch {
        setUploadMsg(`업로드 실패 (서버 응답 오류, 상태 코드 ${res.status})`);
        return;
      }
      if (!res.ok) {
        setUploadMsg(data.error || "업로드 실패");
        return;
      }
      setUploadMsg("프로필 사진이 변경되었습니다.");
      load();
    } catch (err) {
      setUploadMsg("업로드 중 오류가 발생했습니다: " + (err?.message || err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!user) return <p className="subtle">불러오는 중...</p>;

  return (
    <>
      <h1>내 프로필</h1>
      <p className="subtle">여기서 설정한 이름·연락처·사진은 앞으로 작성하는 견적서 하단 담당자 정보로 사용됩니다.</p>

      <div className="card">
        <h2>프로필 사진</h2>
        <div className="flex">
          {user.avatarPath ? (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={user.avatarPath}
                alt="프로필 사진"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                overflow: "hidden",
                background: "var(--green-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--green)",
                flexShrink: 0,
              }}
            >
              {name.slice(0, 1) || "?"}
            </div>
          )}
          <div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} disabled={uploading} />
            <div className="subtle" style={{ marginTop: 4 }}>jpg/png/webp, 10MB 이하</div>
            {uploadMsg && <div className="subtle" style={{ marginTop: 4 }}>{uploadMsg}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>담당자 정보</h2>
        <form onSubmit={handleSave}>
          <label>이름</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>직책</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="㈜봄찬 · 매니저" />
          <label>연락처</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" />
          <label>이메일</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@bomchan.com" />
          {saveMsg && <p className="subtle" style={{ marginTop: 8 }}>{saveMsg}</p>}
          <button className="primary gap-top" type="submit" disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </form>
      </div>
    </>
  );
}
