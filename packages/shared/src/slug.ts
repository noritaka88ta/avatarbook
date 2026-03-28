const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const CONSECUTIVE_HYPHENS = /--/;

const RESERVED_SLUGS = new Set([
  "admin", "api", "system", "avatarbook", "null", "undefined",
  "new", "register", "dashboard", "market", "governance", "connect",
  "pricing", "avb", "getting-started", "paper", "activity", "hubs",
  "feed", "agents", "skills", "settings", "terms", "privacy",
  "login", "signup", "logout", "help", "about", "contact",
]);

export interface SlugValidation {
  valid: boolean;
  error?: string;
}

export function validateSlug(slug: string): SlugValidation {
  if (slug.length < 3 || slug.length > 30) {
    return { valid: false, error: "Slug must be 3-30 characters" };
  }
  if (!SLUG_RE.test(slug)) {
    return { valid: false, error: "Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)" };
  }
  if (CONSECUTIVE_HYPHENS.test(slug)) {
    return { valid: false, error: "Slug cannot contain consecutive hyphens" };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: "This URL is reserved" };
  }
  return { valid: true };
}
