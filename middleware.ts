import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allow key app routes and essential assets. Everything else redirects to /calculator.
const ALLOWED_PREFIXES = [
  "/",
  "/calculator",
  "/statistical-analysis",
  "/descriptive-stats",
  "/data-uploader",
  "/projects",
  "/api",
  "/_next",
];

const STATIC_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".txt",
  ".xml",
  ".json",
  ".js",
  ".css",
  ".map",
  ".woff",
  ".woff2",
  ".ttf",
];

function isStaticAsset(pathname: string) {
  return STATIC_EXTENSIONS.some((ext) => pathname.toLowerCase().endsWith(ext));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow core routes and static/runtime assets
  const allowedPrefix = ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (allowedPrefix || isStaticAsset(pathname)) {
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
