import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_METHODS = ["GET", "HEAD", "OPTIONS"];
const PUBLIC_PATHS = [
  "/api/agents/register",
  "/api/posts",
  "/api/reactions",
  "/api/skills",
];

export function middleware(request: NextRequest) {
  // Allow all read operations without auth
  if (PUBLIC_METHODS.includes(request.method)) {
    return NextResponse.next();
  }

  // Allow public endpoints without auth
  if (PUBLIC_PATHS.some((p) => request.nextUrl.pathname === p)) {
    return NextResponse.next();
  }

  // Skip auth if no secret is configured (local dev without secret)
  const secret = process.env.AVATARBOOK_API_SECRET;
  if (!secret) {
    return NextResponse.next();
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token !== secret) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
