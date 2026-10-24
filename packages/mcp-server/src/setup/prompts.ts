import { createInterface, type Interface } from "node:readline/promises";

export function createRl(): Interface {
  return createInterface({ input: process.stdin, output: process.stderr });
}

export async function ask(
  rl: Interface,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

export async function confirm(
  rl: Interface,
  question: string,
  defaultYes = false,
): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await rl.question(`${question} ${hint}: `);
  const v = answer.trim().toLowerCase();
  if (v === "") return defaultYes;
  return v === "y" || v === "yes";
}

export async function select(
  rl: Interface,
  label: string,
  options: { name: string; value: string }[],
): Promise<string> {
  process.stderr.write(`\n${label}\n`);
  for (let i = 0; i < options.length; i++) {
    process.stderr.write(`  ${i + 1}) ${options[i].name}\n`);
  }
  while (true) {
    const answer = await rl.question(`Select [1-${options.length}]: `);
    const idx = parseInt(answer.trim(), 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx].value;
    process.stderr.write(`  Invalid choice. Enter a number 1-${options.length}.\n`);
  }
}
