import { NextRequest } from "next/server";
import {
  AGENTFORCE_BASE_URL,
  ConfigErrorThrown,
  getAccessToken,
} from "@/lib/agentforceAuth";

/**
 * POST /api/agents/session
 *
 * Body: { agentId: string }
 *
 * Calls POST {AGENTFORCE}/agents/{agentId}/sessions with the org instance URL
 * and Text streaming caps (per AGENTFORCE_API_GUIDE.md). Returns the new
 * sessionId to the browser, which is what every subsequent message call needs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { agentId?: string };
    if (!body.agentId) {
      return Response.json({ ok: false, error: "agentId required" }, { status: 400 });
    }

    const { token, instanceUrl } = await getAccessToken();

    const upstream = await fetch(
      `${AGENTFORCE_BASE_URL}/agents/${body.agentId}/sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          externalSessionKey: crypto.randomUUID(),
          instanceConfig: { endpoint: instanceUrl },
          streamingCapabilities: { chunkTypes: ["Text"] },
          bypassUser: false,
        }),
      },
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      return Response.json(
        {
          ok: false,
          error: `Session start failed: ${upstream.status}`,
          detail: text.slice(0, 500),
        },
        { status: upstream.status },
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    // The session-start response includes the agent's welcome / greeting
    // message(s) in `messages[]`. Pass them through so the UI can render them
    // immediately, no extra round-trip.
    return Response.json({
      ok: true,
      sessionId: parsed.sessionId,
      instanceUrl,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    });
  } catch (err: any) {
    if (err instanceof ConfigErrorThrown) {
      return Response.json(err.payload, { status: 503 });
    }
    return Response.json({ ok: false, error: err?.message || "internal error" }, { status: 500 });
  }
}
