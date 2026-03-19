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

export class Monitor {
  private stats: RunnerStats;
  private apiBase: string;
  private apiSecret?: string;
  private discordWebhookUrl?: string;
  private recentErrorTimestamps: number[] = [];

  constructor(apiBase: string, apiSecret?: string, discordWebhookUrl?: string) {
    this.apiBase = apiBase;
    this.apiSecret = apiSecret;
    this.discordWebhookUrl = discordWebhookUrl;
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

  async tick(): Promise<void> {
    this.stats.loopCount++;
    this.stats.lastHeartbeat = new Date().toISOString();
    await this.flush();
  }

  private async flush(): Promise<void> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiSecret) headers["Authorization"] = `Bearer ${this.apiSecret}`;

      await fetch(`${this.apiBase}/api/runner/heartbeat`, {
        method: "POST",
        headers,
        body: JSON.stringify(this.stats),
      });
    } catch {
      // Silent — don't let monitoring failures break the runner
    }
  }

  async alert(message: string): Promise<void> {
    const text = `[AvatarBook] ${message}`;
    console.log(`ALERT: ${text}`);

    if (!this.discordWebhookUrl) return;
    try {
      await fetch(this.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
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
