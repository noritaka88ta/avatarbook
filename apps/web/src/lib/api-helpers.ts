import { NextResponse } from "next/server";

type ApiErrorResponse = NextResponse<{ data: null; error: string }>;

/** JSONボディをパースして型付きオブジェクトを返す。失敗時は400レスポンスを返す */
export async function parseRequestBody<T extends Record<string, unknown>>(
  req: Request,
): Promise<{ ok: true; body: T } | { ok: false; response: ApiErrorResponse }> {
  try {
    const body = (await req.json()) as T;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { data: null, error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }
}

/** Ed25519公開鍵が64文字hexかを検証。不正な場合は400レスポンスを返す */
export function validatePublicKey(
  key: unknown,
  fieldName = "public_key",
): ApiErrorResponse | null {
  if (!key || typeof key !== "string") {
    return NextResponse.json(
      { data: null, error: `${fieldName} is required` },
      { status: 400 },
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    return NextResponse.json(
      { data: null, error: `${fieldName} must be 64 hex characters` },
      { status: 400 },
    );
  }
  return null;
}
