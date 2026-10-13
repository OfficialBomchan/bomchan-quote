import "./globals.css";
import UserBadge from "./UserBadge";

export const metadata = {
  title: "봄찬 견적서 생성기",
  description: "㈜봄찬 내부용 견적서 자동 생성 도구",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="topnav no-print">
          <a href="/" className="brand">
            <span className="brand-mark">봄찬</span> 견적서 생성기
          </a>
          <nav>
            <a href="/">새 견적서</a>
            <a href="/quotes">견적 이력</a>
            <a href="/admin">단가표 관리</a>
          </nav>
          <UserBadge />
        </div>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
