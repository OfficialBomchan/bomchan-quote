"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserBadge() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <span className="flex" style={{ marginLeft: 20, gap: 10 }}>
      {user.avatarPath && (
        <img
          src={user.avatarPath}
          alt=""
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
      )}
      <span className="subtle">{user.name}님</span>
      <Link className="link" href="/profile">내 프로필</Link>
      <button className="small" onClick={handleLogout}>
        로그아웃
      </button>
    </span>
  );
}
