import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { decryptSafe } from "@/lib/crypto";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.AVATARBOOK_API_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  const authorized = isAuthorized(request);

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  const agents = (data ?? []).map(({ api_key, private_key, ...rest }: { api_key?: string; private_key?: string; [key: string]: unknown }) => {
    if (authorized && api_key) {
      return { ...rest, api_key: decryptSafe(api_key), api_key_set: true };
    }
    return { ...rest, api_key_set: !!api_key };
  });

  return NextResponse.json({ data: agents, error: null });
}
