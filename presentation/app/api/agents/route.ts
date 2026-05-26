import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * GET /api/agents
 *
 * Lists service agents in the org by shelling out to `sf data query`. We use
 * the presenter's existing CLI auth instead of the Connected App's OAuth
 * client_credentials user because sharing rules on `BotDefinition` /
 * `BotVersion` regularly hide just-published agents from the integration user
 * even when the human running `sf` CLI sees them fine. Listing parity with
 * what the presenter sees in their terminal beats the architectural purity
 * of "everything goes through OAuth".
 *
 * The chat endpoints (/api/agents/session, /api/agents/message) still use
 * the OAuth token because the global `/einstein/ai-agent/v1` endpoint
 * requires it.
 *
 * Configurable via:
 *   SF_TARGET_ORG  sf CLI alias / username  (default: 'my-agentforce-org')
 */
export const dynamic = "force-dynamic";

const exec = promisify(execFile);

const TARGET_ORG = process.env.SF_TARGET_ORG || "my-agentforce-org";

const AGENT_TYPES = ["AgentforceEmployeeAgent", "EinsteinServiceAgent"] as const;

const DEFINITION_SOQL = `
  SELECT Id, MasterLabel, DeveloperName, AgentType
  FROM BotDefinition
  WHERE AgentType IN ('${AGENT_TYPES.join("','")}')
  ORDER BY LastModifiedDate DESC
  LIMIT 200
`.replace(/\s+/g, " ").trim();

const VERSIONS_SOQL = (ids: string[]) => {
  const list = ids.map((i) => `'${i.replace(/'/g, "")}'`).join(",");
  return `SELECT BotDefinitionId, VersionNumber FROM BotVersion WHERE Status='Active' AND BotDefinitionId IN (${list})`;
};

type Record = Record<string, any>;

async function sfQuery<T = Record>(query: string): Promise<{ ok: true; records: T[] } | { ok: false; error: string }> {
  try {
    const { stdout } = await exec(
      "sf",
      ["data", "query", "--query", query, "--target-org", TARGET_ORG, "--json"],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout);
    if (parsed.status !== 0) {
      return { ok: false, error: parsed.message || "sf data query non-zero status" };
    }
    return { ok: true, records: parsed.result?.records ?? [] };
  } catch (err: any) {
    // execFile rejects on non-zero exit; sf prints JSON to stdout in that case.
    const stdout = err?.stdout || "";
    if (stdout) {
      try {
        const parsed = JSON.parse(stdout);
        return { ok: false, error: parsed.message || parsed.name || `sf exit ${err.code}` };
      } catch {
        // fall through
      }
    }
    return { ok: false, error: err?.message || "sf CLI invocation failed" };
  }
}

export async function GET(_req: NextRequest) {
  const defs = await sfQuery<{
    Id: string;
    MasterLabel: string;
    DeveloperName: string;
    AgentType: string;
  }>(DEFINITION_SOQL);

  if (!defs.ok) {
    return Response.json(
      {
        ok: false,
        error: `BotDefinition query failed`,
        detail: defs.error,
        hint:
          /no\s+org/i.test(defs.error) || /no\s+default\s+org/i.test(defs.error)
            ? `Run: sf org login web --alias ${TARGET_ORG} --set-default`
            : `Verify the alias '${TARGET_ORG}' is authed: sf org list`,
        targetOrg: TARGET_ORG,
      },
      { status: 502 },
    );
  }

  if (defs.records.length === 0) {
    return Response.json({ ok: true, agents: [], targetOrg: TARGET_ORG });
  }

  const ids = defs.records.map((d) => d.Id);
  const versions = await sfQuery<{ BotDefinitionId: string; VersionNumber: number }>(VERSIONS_SOQL(ids));

  const activeByDef = new Map<string, number>();
  if (versions.ok) {
    for (const v of versions.records) {
      const cur = activeByDef.get(v.BotDefinitionId) ?? 0;
      if (v.VersionNumber > cur) activeByDef.set(v.BotDefinitionId, v.VersionNumber);
    }
  }

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
    agents,
    targetOrg: TARGET_ORG,
    versionQueryFailed: !versions.ok,
    versionRowsSeen: versions.ok ? versions.records.length : 0,
  });
}
