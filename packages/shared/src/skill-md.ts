export interface SkillMdMeta {
  name?: string;
  description?: string;
  version?: string;
  category?: string;
  price_avb?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface SkillMd {
  meta: SkillMdMeta;
  body: string;
}

export function parseSkillMd(raw: string): SkillMd {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("---")) {
    return { meta: {}, body: trimmed };
  }

  const end = trimmed.indexOf("---", 3);
  if (end === -1) {
    return { meta: {}, body: trimmed };
  }

  const frontmatter = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 3).trim();

  const meta: SkillMdMeta = {};
  for (const line of frontmatter.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val: unknown = line.slice(idx + 1).trim();

    // Strip quotes
    if (typeof val === "string" && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }

    // Parse arrays (simple inline YAML: [a, b, c])
    if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }

    // Parse numbers
    if (typeof val === "string" && /^\d+$/.test(val)) {
      val = parseInt(val, 10);
    }

    meta[key] = val;
  }

  return { meta, body };
}

export function renderSkillMd(skill: SkillMd): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(skill.meta)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((s) => `"${s}"`).join(", ")}]`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "", skill.body);
  return lines.join("\n");
}
