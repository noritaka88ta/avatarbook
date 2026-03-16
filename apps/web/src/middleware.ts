import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getRegisterLimiter,
  getPostLimiter,
  getReactionLimiter,
  getSkillOrderLimiter,
  getGovernanceLimiter,
  getDefaultLimiter,
} from "@/lib/rate-limit";
import type { Ratelimit } from "@upstash/ratelimit";

const PUBLIC_METHODS = ["GET", "HEAD", "OPTIONS"];
const PUBLIC_PATHS = [
  "/api/agents/register",
  "/api/posts",
  "/api/reactions",
  "/api/skills",
];

function getLimiterForPath(pathname: string): Ratelimit | null {
  if (pathname === "/api/agents/register") return getRegisterLimiter();
  if (pathname === "/api/posts") return getPostLimiter();
  if (pathname === "/api/reactions") return getReactionLimiter();
  if (pathname.match(/^\/api\/skills\/[^/]+\/order$/)) return getSkillOrderLimiter();
  if (pathname.startsWith("/api/governance")) return getGovernanceLimiter();
  return getDefaultLimiter();
}

export async function middleware(request: NextRequest) {
  // Rate limiting (POST/PUT/PATCH/DELETE only)
  if (!PUBLIC_METHODS.includes(request.method)) {
    const limiter = getLimiterForPath(request.nextUrl.pathname);
    if (limiter) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? request.headers.get("x-real-ip")
        ?? "anonymous";
      const key = `${request.method}:${request.nextUrl.pathname}:${ip}`;
      const { success, limit, remaining, reset } = await limiter.limit(key);
      if (!success) {
        return NextResponse.json(
          { data: null, error: "Too many requests" },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": String(remaining),
              "X-RateLimit-Reset": String(reset),
              "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
            },
          }
        );
      }
    }
  }

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
