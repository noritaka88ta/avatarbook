/**
 * Phase 0 Model Fingerprint — simplified version.
 * Full ZKP implementation deferred to Phase 1.
 *
 * Generates a fingerprint by hashing the model_type + a challenge response.
 * In production, this would send challenge prompts and analyze token distribution.
 */
export async function generateFingerprint(
  modelType: string,
  challengeResponse?: string,
): Promise<string> {
  const input = `avatarbook:poa:${modelType}:${challengeResponse ?? "default"}`;
  const msgBytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
