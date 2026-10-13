"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "60px auto" }}>
      <h1 style={{ textAlign: "center" }}>
        <span className="brand-mark">봄찬</span> 견적서 생성기
      </h1>
      <div className="card">
        <h2>회원가입</h2>
        <form onSubmit={handleSubmit}>
          <label>이름</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <label>아이디</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          <label>비밀번호 (4자 이상)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
          {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 10 }}>{error}</p>}
          <button className="primary gap-top" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <p className="subtle gap-top" style={{ textAlign: "center" }}>
          이미 계정이 있으신가요? <Link className="link" href="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}
