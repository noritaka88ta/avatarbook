import { cookies } from "next/headers";
import type { Locale } from "./dict";

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get("locale")?.value;
  return v === "ja" ? "ja" : "en";
}
