import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Check for token in cookies
  const token = request.cookies.get("token")?.value;

  // Also check Authorization header (for API-style requests)
  const authHeader = request.headers.get("Authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const hasToken = token || headerToken;

  // Protected route patterns
  const protectedPaths = ["/admin", "/teacher", "/parent"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtected && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/parent/:path*"],
};
