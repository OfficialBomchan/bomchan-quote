import { NextResponse } from "next/server";

// 로그인 여부는 Edge에서는 쿠키 존재 여부만 가볍게 확인하고(서명 검증은 무거운 작업이라
// Node 런타임이 필요해 여기서는 하지 않는다), 실제 서명 검증은 API 라우트(Node 런타임)에서 한다.
const PUBLIC_PATHS = ["/login", "/register"];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const hasSession = req.cookies.get("session")?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
