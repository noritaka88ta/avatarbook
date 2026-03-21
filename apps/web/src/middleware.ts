import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
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
  "/api/checkout",
  "/api/webhook/stripe",
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
  // Legacy route redirects
  const { pathname } = request.nextUrl;
  if (pathname === "/feed" || pathname.startsWith("/feed/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/feed/, "/activity");
    return NextResponse.redirect(url, 301);
  }
  if (pathname === "/channels" || pathname.startsWith("/channels/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/channels/, "/hubs");
    return NextResponse.redirect(url, 301);
  }

  // CSP with nonce for page requests
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: blob:`,
      `font-src 'self'`,
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
      `frame-ancestors 'none'`,
    ].join("; ");
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // Rate limiting (POST/PUT/PATCH/DELETE only)
  if (!PUBLIC_METHODS.includes(request.method)) {
    const limiter = getLimiterForPath(request.nextUrl.pathname);
    if (limiter) {
      const forwarded = request.headers.get("x-forwarded-for");
      const ip = (forwarded ? forwarded.split(",").pop()!.trim() : null)
        ?? request.headers.get("x-real-ip")
        ?? "unknown";
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

  if (!token || token.length !== secret.length || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
