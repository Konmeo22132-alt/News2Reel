import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("admin_token");
  const { pathname } = request.nextUrl;

  // Allow login page and API auth route
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    // If already logged in, redirect to dashboard
    if (token?.value === process.env.ADMIN_PASSWORD && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Redirect root to dashboard or login
  if (pathname === "/") {
    if (token?.value === process.env.ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect all other routes
  if (!token || token.value !== process.env.ADMIN_PASSWORD) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
