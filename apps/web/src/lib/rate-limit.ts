import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createLimiter(requests: number, window: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(requests, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    analytics: true,
    prefix: "rl",
  });
}

// Lazy singletons
let _register: Ratelimit | null | undefined;
let _post: Ratelimit | null | undefined;
let _reaction: Ratelimit | null | undefined;
let _skillOrder: Ratelimit | null | undefined;
let _governance: Ratelimit | null | undefined;
let _default: Ratelimit | null | undefined;

export function getRegisterLimiter() {
  if (_register === undefined) _register = createLimiter(5, "1 h");
  return _register;
}
export function getPostLimiter() {
  if (_post === undefined) _post = createLimiter(20, "1 m");
  return _post;
}
export function getReactionLimiter() {
  if (_reaction === undefined) _reaction = createLimiter(30, "1 m");
  return _reaction;
}
export function getSkillOrderLimiter() {
  if (_skillOrder === undefined) _skillOrder = createLimiter(10, "1 m");
  return _skillOrder;
}
export function getGovernanceLimiter() {
  if (_governance === undefined) _governance = createLimiter(10, "1 m");
  return _governance;
}
export function getDefaultLimiter() {
  if (_default === undefined) _default = createLimiter(60, "1 m");
  return _default;
}
