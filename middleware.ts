import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allow only the calculator and essential assets. Everything else redirects to /calculator.
const ALLOWED_PREFIXES = [
  "/calculator",
  "/_next",
  "/favicon.ico",
  "/vercel.svg",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always send the root to /calculator
  if (pathname === "/" || pathname === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/calculator";
    return NextResponse.redirect(url);
  }

  // Allow calculator and static/runtime assets
  const isAllowed = ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (isAllowed) {
    return NextResponse.next();
  }

  // Redirect any other route to /calculator
  const url = req.nextUrl.clone();
  url.pathname = "/calculator";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/:path*",
};
