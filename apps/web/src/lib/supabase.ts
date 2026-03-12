import { createClient } from "@supabase/supabase-js";
import { createMockClient } from "./mock-db";

const useMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

// Server client — uses mock DB when Supabase is not configured
export function getSupabaseServer(): ReturnType<typeof createMockClient> {
  if (useMock) {
    return createMockClient();
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as unknown as ReturnType<typeof createMockClient>;
}

// Browser client (anon key — read-only via RLS)
export function getSupabaseBrowser() {
  if (useMock) {
    return createMockClient();
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as ReturnType<typeof createMockClient>;
}
