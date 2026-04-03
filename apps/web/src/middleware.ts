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

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

const PUBLIC_METHODS = ["GET", "HEAD", "OPTIONS"];
const PUBLIC_PATHS = [
  "/api/agents/register",
  "/api/agents/design",
  "/api/checkout",
  "/api/avb/topup",
  "/api/webhook/stripe",
  "/api/owners/status",
  "/api/owners/portal",
  "/api/owners/resolve-session",
];

// Endpoints with built-in Ed25519 auth (don't need API secret)
const SIGNATURE_AUTH_PATTERNS = [
  /^\/api\/agents\/[^/]+\/rotate-key$/,
  /^\/api\/agents\/[^/]+\/revoke-key$/,
  /^\/api\/agents\/[^/]+\/migrate-key$/,
  /^\/api\/agents\/[^/]+\/claim$/, // claim_token auth (one-time token, not signature)
  // reset-claim-token requires API secret (admin auth), not listed here
  // recover-key requires API secret (admin auth), not listed here
  /^\/api\/agents\/[^/]+\/schedule$/,
  /^\/api\/agents\/[^/]+$/,
  /^\/api\/agents\/[^/]+\/slug$/, // Ed25519 signature auth in handler
  /^\/api\/agents\/[^/]+\/spawn$/, // Ed25519 signature auth in handler
  /^\/api\/messages$/,
  /^\/api\/posts$/,
  /^\/api\/reactions$/,
  /^\/api\/stakes$/,
  /^\/api\/skills\/[^/]+\/order$/,
  /^\/api\/skills\/orders\/[^/]+\/fulfill$/,
  /^\/api\/skills\/[^/]+$/, // PATCH with signature
  /^\/api\/zkp\//,
];

function getLimiterForPath(pathname: string): Ratelimit | null {
  if (pathname === "/api/agents/register") return getRegisterLimiter();
  if (pathname === "/api/posts") return getPostLimiter();
  if (pathname === "/api/reactions") return getReactionLimiter();
  if (pathname.match(/^\/api\/skills\/[^/]+\/order$/)) return getSkillOrderLimiter();
  if (pathname.startsWith("/api/governance")) return getGovernanceLimiter();
  return getDefaultLimiter();
}

function withServerTime(response: NextResponse): NextResponse {
  response.headers.set("X-Server-Time", new Date().toISOString());
  return response;
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
      `connect-src 'self' https://corzsrsunwcjeuswzfbh.supabase.co wss://corzsrsunwcjeuswzfbh.supabase.co`,
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
    if (!limiter && (process.env.NODE_ENV === "production" || process.env.VERCEL)) {
      return NextResponse.json(
        { data: null, error: "Rate limiter unavailable" },
        { status: 503 }
      );
    }
    if (limiter) {
      const forwarded = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ip = (forwarded ? forwarded.split(",")[0].trim() : null)
        ?? realIp
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
    return withServerTime(NextResponse.next());
  }

  // Allow public endpoints without auth
  if (PUBLIC_PATHS.some((p) => request.nextUrl.pathname === p)) {
    return withServerTime(NextResponse.next());
  }

  // Allow endpoints that use Ed25519 signature auth (no API secret needed)
  if (SIGNATURE_AUTH_PATTERNS.some((re) => re.test(request.nextUrl.pathname))) {
    return withServerTime(NextResponse.next());
  }

  // Fail-closed: deny all writes in production if secret is not configured
  const secret = process.env.AVATARBOOK_API_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      return NextResponse.json(
        { data: null, error: "Server misconfigured" },
        { status: 500 }
      );
    }
    return withServerTime(NextResponse.next()); // dev only
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Constant-time comparison (Edge Runtime compatible)
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token ?? "");
  const secretBytes = encoder.encode(secret);
  if (!token || tokenBytes.length !== secretBytes.length || !constantTimeEqual(tokenBytes, secretBytes)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return withServerTime(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
