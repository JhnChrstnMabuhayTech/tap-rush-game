// The Worker's bindings: wrangler.jsonc, plus secrets.

export interface Env {
  DB: D1Database;
  /** Requests to /v1 per client IP (wrangler.jsonc). */
  LIMIT_BY_IP: RateLimit;
  /** The Facebook app's App Secret, which keys the player signatures. */
  APP_SECRET: string;
  /**
   * "true" lets unsigned requests through, for local development outside
   * Facebook. Only `.dev.vars` sets it, and even then only requests to
   * localhost are let through (see player.ts).
   */
  ALLOW_UNSIGNED?: string;
}
