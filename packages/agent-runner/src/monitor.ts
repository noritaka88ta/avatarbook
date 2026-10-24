export interface RunnerStats {
  startedAt: string;
  lastHeartbeat: string;
  loopCount: number;
  postCount: number;
  reactionCount: number;
  skillOrderCount: number;
  fulfillCount: number;
  spawnCount: number;
  errorCount: number;
  lastErrors: Array<{ time: string; message: string }>;
  agentCount: number;
}

const MAX_ERRORS = 20;
const ERROR_WINDOW_MS = 10 * 60 * 1000; // 10 min
const ERROR_THRESHOLD = 5;

// セキュリティイベントは運用エラーとは別系統で扱う。
// 「システムが健全か(error)」と「誰かが攻撃してるか(security)」を混ぜると埋もれる。
const SEC_AGGREGATE_MS = 5 * 60 * 1000; // 同一種別はこの窓で集約し、1通にまとめる

interface SecurityBucket {
  countSinceAlert: number;
  totalCount: number;
  targets: Set<string>;
  lastDetail: string;
  lastAlertTs: number;
}

export class Monitor {
  private stats: RunnerStats;
  private apiBase: string;
  private apiSecret?: string;
  private slackWebhookUrl?: string;
  private recentErrorTimestamps: number[] = [];
  private securityBuckets = new Map<string, SecurityBucket>();

  constructor(apiBase: string, apiSecret?: string, slackWebhookUrl?: string) {
    this.apiBase = apiBase;
    this.apiSecret = apiSecret;
    this.slackWebhookUrl = slackWebhookUrl;
    this.stats = {
      startedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      loopCount: 0,
      postCount: 0,
      reactionCount: 0,
      skillOrderCount: 0,
      fulfillCount: 0,
      spawnCount: 0,
      errorCount: 0,
      lastErrors: [],
      agentCount: 0,
    };
  }

  async start(agentCount: number): Promise<void> {
    this.stats.agentCount = agentCount;
    await this.alert(`agent-runner started with ${agentCount} agents`);
    this.setupCrashHandlers();
  }

  recordPost(): void { this.stats.postCount++; }
  recordReaction(): void { this.stats.reactionCount++; }
  recordSkillOrder(): void { this.stats.skillOrderCount++; }
  recordFulfill(): void { this.stats.fulfillCount++; }
  recordSpawn(): void { this.stats.spawnCount++; }

  recordError(message: string): void {
    this.stats.errorCount++;
    this.stats.lastErrors.push({ time: new Date().toISOString(), message });
    if (this.stats.lastErrors.length > MAX_ERRORS) {
      this.stats.lastErrors.shift();
    }

    // Check error threshold
    const now = Date.now();
    this.recentErrorTimestamps.push(now);
    this.recentErrorTimestamps = this.recentErrorTimestamps.filter(
      (t) => now - t < ERROR_WINDOW_MS
    );
    if (this.recentErrorTimestamps.length >= ERROR_THRESHOLD) {
      this.alert(`ERROR THRESHOLD: ${this.recentErrorTimestamps.length} errors in 10min. Latest: ${message}`);
      this.recentErrorTimestamps = []; // reset to avoid spam
    }
  }

  /**
   * セキュリティイベント（攻撃シグナル）を記録し、Slackへ専用通知する。
   * 運用エラー(recordError)の閾値アラートとは別系統・別プレフィックス。
   * 初回は即時通知、その後は SEC_AGGREGATE_MS 窓で集約して1通にまとめる（連打スパム防止）。
   *
   * @param kind  イベント種別（例: "ssrf", "auth-bypass"）
   * @param detail 人間が読む要約（例: "bridge redirects to loopback"）
   * @param target 狙われた対象（例: "127.0.0.1:2375"）— 集約時に distinct 数を出す
   */
  recordSecurityEvent(kind: string, detail: string, target?: string): void {
    const now = Date.now();
    let b = this.securityBuckets.get(kind);
    if (!b) {
      b = { countSinceAlert: 0, totalCount: 0, targets: new Set(), lastDetail: detail, lastAlertTs: 0 };
      this.securityBuckets.set(kind, b);
    }
    b.countSinceAlert++;
    b.totalCount++;
    b.lastDetail = detail;
    if (target) b.targets.add(target);

    // 初回 or 集約窓を超えたら通知。それ以外はカウントだけ貯める。
    const firstHit = b.lastAlertTs === 0;
    if (firstHit || now - b.lastAlertTs >= SEC_AGGREGATE_MS) {
      const targetList = [...b.targets].slice(-8).join(", ");
      const burst = firstHit
        ? `初検知`
        : `直近${Math.round(SEC_AGGREGATE_MS / 60000)}分で${b.countSinceAlert}件`;
      this.alert(
        `🚨 SECURITY [${kind}] ${burst} — ${detail}` +
          (b.targets.size ? ` | ${b.targets.size}ターゲット: ${targetList}` : "") +
          ` | 累計${b.totalCount}件`,
      );
      b.countSinceAlert = 0;
      b.lastAlertTs = now;
    }
  }

  async tick(): Promise<void> {
    this.stats.loopCount++;
    this.stats.lastHeartbeat = new Date().toISOString();
    await this.flush();
  }

  private async flush(): Promise<void> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiSecret) headers["Authorization"] = `Bearer ${this.apiSecret}`;

      const url = `${this.apiBase}/api/runner/heartbeat`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(this.stats),
      });
      if (!res.ok) {
        console.error(`[Monitor] heartbeat ${res.status}`);
      }
    } catch (err) {
      console.error(`[Monitor] heartbeat flush failed: ${(err as Error).message}`);
    }
  }

  async alert(message: string): Promise<void> {
    const text = `[AvatarBook] ${message}`;
    console.log(`ALERT: ${text}`);

    if (!this.slackWebhookUrl) return;
    try {
      await fetch(this.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      // Silent
    }
  }

  private setupCrashHandlers(): void {
    process.on("uncaughtException", async (err) => {
      await this.alert(`CRASH (uncaughtException): ${err.message}`);
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason) => {
      const msg = reason instanceof Error ? reason.message : String(reason);
      await this.alert(`CRASH (unhandledRejection): ${msg}`);
      process.exit(1);
    });

    process.on("SIGTERM", async () => {
      await this.alert("Process received SIGTERM, shutting down");
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      await this.alert("Process received SIGINT, shutting down");
      process.exit(0);
    });
  }
}
