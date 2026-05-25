/**
 * Server-side helpers for the Salesforce AgentForce API.
 *
 * Auth model (per AGENTFORCE_API_GUIDE.md): OAuth 2.0 client-credentials flow
 * against the connected app installed in the demo org. The access token is
 * also a valid Bearer token for the global AgentForce endpoint at
 * https://api.salesforce.com/einstein/ai-agent/v1.
 *
 * Required env vars (set in .env.local — server-side only):
 *   SALESFORCE_CLIENT_ID         consumer key of the connected app
 *   SALESFORCE_CLIENT_SECRET     consumer secret of the connected app
 *   NEXT_PUBLIC_SALESFORCE_INSTANCE_URL   org instance URL, e.g.
 *                                         https://orgfarm-22ccc7c65d.my.salesforce.com
 *
 * The instance URL is `NEXT_PUBLIC_*` only because the front-end also displays
 * it (footer, links). Tokens themselves never reach the client — every
 * outbound call lives behind /api/agents/* routes that mint and forward
 * tokens server-side.
 */

export const AGENTFORCE_BASE_URL = "https://api.salesforce.com/einstein/ai-agent/v1";

export type AgentforceConfig = {
  clientId: string;
  clientSecret: string;
  instanceUrl: string;
};

export type ConfigError = {
  ok: false;
  error: string;
  hint: string;
  missing: string[];
};

/** Read + validate env. Returns either a usable config or a typed error payload. */
export function readConfig(): AgentforceConfig | ConfigError {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const instanceUrl = process.env.NEXT_PUBLIC_SALESFORCE_INSTANCE_URL;

  const missing: string[] = [];
  if (!clientId) missing.push("SALESFORCE_CLIENT_ID");
  if (!clientSecret) missing.push("SALESFORCE_CLIENT_SECRET");
  if (!instanceUrl) missing.push("NEXT_PUBLIC_SALESFORCE_INSTANCE_URL");

  if (missing.length) {
    return {
      ok: false,
      error: "AgentForce connected app not configured",
      hint:
        "Add the connected-app credentials to presentation/.env.local. " +
        "See presentation/.env.example for the full template.",
      missing,
    };
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    instanceUrl: instanceUrl!.replace(/\/$/, ""),
  };
}

// ── token cache (in-memory, lives for the life of the Node process) ────────

type CachedToken = { token: string; expiresAt: number; instanceUrl: string };
let cached: CachedToken | null = null;

/**
 * Get a valid access token, minting a new one if the cache is empty or expired.
 * The Salesforce token endpoint returns no expiry hint by default — we treat
 * tokens as good for 25 minutes (well under the typical 30-minute server-set
 * lifetime).
 */
export async function getAccessToken(): Promise<{ token: string; instanceUrl: string }> {
  const cfg = readConfig();
  if (!("clientId" in cfg)) throw new ConfigErrorThrown(cfg);

  // 60s safety buffer
  if (cached && cached.expiresAt - 60_000 > Date.now() && cached.instanceUrl === cfg.instanceUrl) {
    return { token: cached.token, instanceUrl: cached.instanceUrl };
  }

  const tokenUrl = `${cfg.instanceUrl}/services/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(
      `OAuth client_credentials failed: ${r.status} ${r.statusText} — ${text.slice(0, 200)}`,
    );
  }

  const data = (await r.json()) as { access_token?: string; instance_url?: string };
  if (!data.access_token) {
    throw new Error("Token endpoint returned no access_token");
  }

  cached = {
    token: data.access_token,
    instanceUrl: cfg.instanceUrl,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };

  return { token: cached.token, instanceUrl: cached.instanceUrl };
}

/** Surface a configuration miss as a typed error so route handlers can JSON-respond. */
export class ConfigErrorThrown extends Error {
  payload: ConfigError;
  constructor(payload: ConfigError) {
    super(payload.error);
    this.payload = payload;
  }
}
