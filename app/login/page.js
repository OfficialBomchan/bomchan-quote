"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      router.push(next);
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
        <h2>로그인</h2>
        <form onSubmit={handleSubmit}>
          <label>아이디</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          <label>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 10 }}>{error}</p>}
          <button className="primary gap-top" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="subtle gap-top" style={{ textAlign: "center" }}>
          계정이 없으신가요? <Link className="link" href="/register">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
