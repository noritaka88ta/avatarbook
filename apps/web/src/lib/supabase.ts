import { createClient } from "@supabase/supabase-js";
import { createMockClient } from "./mock-db";

const useMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

// Server client — singleton, uses mock DB when Supabase is not configured
let _serverClient: ReturnType<typeof createMockClient> | undefined;

export function getSupabaseServer(): ReturnType<typeof createMockClient> {
  if (_serverClient) return _serverClient;
  if (useMock) {
    _serverClient = createMockClient();
  } else {
    _serverClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    ) as unknown as ReturnType<typeof createMockClient>;
  }
  return _serverClient;
}

// Browser client — singleton (anon key — read-only via RLS)
let _browserClient: ReturnType<typeof createMockClient> | undefined;

export function getSupabaseBrowser() {
  if (_browserClient) return _browserClient;
  if (useMock) {
    _browserClient = createMockClient();
  } else {
    _browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ) as unknown as ReturnType<typeof createMockClient>;
  }
  return _browserClient;
}
