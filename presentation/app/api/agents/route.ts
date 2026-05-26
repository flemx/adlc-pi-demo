import { NextRequest } from "next/server";
import { ConfigErrorThrown, getAccessToken } from "@/lib/agentforceAuth";

/**
 * GET /api/agents
 *
 * 1. Query BotDefinition directly for agents of a service-agent type.
 * 2. Query BotVersion for the Active versions of those agents and merge in
 *    the highest active VersionNumber.
 *
 * We split into two SOQL calls because BotVersion → BotDefinition
 * relationship traversal in a WHERE clause is unreliable across orgs / API
 * versions. Two simple queries are 100 % portable.
 *
 * Response shape on success:
 *   {
 *     ok: true,
 *     instanceUrl: string,
 *     agents: Array<{
 *       id: string,            // BotDefinition.Id (used as agentId for AgentForce API)
 *       label: string,
 *       developerName: string,
 *       description: string | null,
 *       agentType: string,
 *       activeVersion: number, // 0 = no active version yet
 *     }>,
 *   }
 *
 * On failure: `{ ok:false, error, detail?, missing?, hint?, status }` plus a
 * 4xx/5xx HTTP status the UI can branch on.
 */
export const dynamic = "force-dynamic";

const API_VERSION = "v62.0";

// Only true service agents (the customer-facing ones the demo tab is for).
// AgentforceEmployeeAgent is excluded — those are internal employee copilots,
// not the service agents we want to test in this panel.
const AGENT_TYPES = ["EinsteinServiceAgent"] as const;

// NOTE: BotDefinition does NOT have a Description column. Use MasterLabel +
// DeveloperName for display; the planning HTML / agent docs hold the longer
// descriptions if we ever want to surface them.
const DEFINITION_SOQL = `
  SELECT Id, MasterLabel, DeveloperName, AgentType
  FROM BotDefinition
  WHERE AgentType IN ('${AGENT_TYPES.join("','")}')
  ORDER BY LastModifiedDate DESC
  LIMIT 200
`.replace(/\s+/g, " ").trim();

function activeVersionsSoql(ids: string[]) {
  // Quote and comma-join the ids for the IN clause.
  const list = ids.map((i) => `'${i.replace(/'/g, "")}'`).join(",");
  return `SELECT BotDefinitionId, VersionNumber FROM BotVersion WHERE Status='Active' AND BotDefinitionId IN (${list})`;
}

async function soql<T = any>(
  instanceUrl: string,
  token: string,
  query: string,
): Promise<{ ok: true; records: T[] } | { ok: false; status: number; body: string }> {
  const url = `${instanceUrl}/services/data/${API_VERSION}/query/?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    return { ok: false, status: r.status, body };
  }
  const json = (await r.json()) as { records?: T[] };
  return { ok: true, records: json.records ?? [] };
}

export async function GET(_req: NextRequest) {
  try {
    const { token, instanceUrl } = await getAccessToken();

    // ── 1. agents matching service-agent types ─────────────────────────────
    const defs = await soql<{
      Id: string;
      MasterLabel: string;
      DeveloperName: string;
      AgentType: string;
    }>(instanceUrl, token, DEFINITION_SOQL);

    if (!defs.ok) {
      return Response.json(
        {
          ok: false,
          error: `Salesforce BotDefinition query failed: HTTP ${defs.status}`,
          // Salesforce error bodies are tiny JSON arrays; pass through verbatim.
          detail: defs.body.slice(0, 800),
          query: DEFINITION_SOQL,
          hint:
            defs.status === 401
              ? "Connected app token rejected. Verify the OAuth scopes include `api` (and `chatbot_api` + `sfap_api` for chat)."
              : defs.status === 403
              ? "Connected-app user is missing read access to BotDefinition. Grant the integration user the 'View All Bot Resources' permission (or assign an Agentforce permission set)."
              : "Open the dev-server console for the full Salesforce error body, or hit /api/agents directly with curl.",
        },
        { status: 502 },
      );
    }

    if (defs.records.length === 0) {
      return Response.json({ ok: true, agents: [], instanceUrl });
    }

    // ── 2. active versions — also our "is this agent live?" filter ───────
    const ids = defs.records.map((d) => d.Id);
    const versions = await soql<{ BotDefinitionId: string; VersionNumber: number }>(
      instanceUrl,
      token,
      activeVersionsSoql(ids),
    );

    const activeByDef = new Map<string, number>();
    if (versions.ok) {
      for (const v of versions.records) {
        const cur = activeByDef.get(v.BotDefinitionId) ?? 0;
        if (v.VersionNumber > cur) activeByDef.set(v.BotDefinitionId, v.VersionNumber);
      }
    }
    // If the version query failed we don't have ground truth on which agents
    // are live — fall back to returning everything so the user can still see
    // the org, and surface the failure via `versionQueryFailed`.

    // We used to drop agents with no Active version, but the connected-app
    // integration user often has narrower BotVersion read access than the
    // human running `sf` CLI. That meant agents like ProntoOrderSupport —
    // which were genuinely active in the org — simply vanished here. Now we
    // surface every definition we can read; activeVersion = 0 just means
    // "we couldn't confirm an active version", not "there isn't one".
    const agents = defs.records.map((d) => ({
      id: d.Id,
      label: d.MasterLabel || d.DeveloperName,
      developerName: d.DeveloperName,
      description: null,
      agentType: d.AgentType,
      activeVersion: activeByDef.get(d.Id) ?? 0,
    }));

    return Response.json({
      ok: true,
      instanceUrl,
      agents,
      versionQueryFailed: !versions.ok,
      // Surface the count so the UI can hint when the version query came back
      // empty (perms / sharing) vs definitions also being empty.
      versionRowsSeen: versions.ok ? versions.records.length : 0,
    });
  } catch (err: any) {
    if (err instanceof ConfigErrorThrown) {
      return Response.json(err.payload, { status: 503 });
    }
    return Response.json(
      { ok: false, error: err?.message || "internal error" },
      { status: 500 },
    );
  }
}
