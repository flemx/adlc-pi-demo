import { NextRequest } from "next/server";
import {
  AGENTFORCE_BASE_URL,
  ConfigErrorThrown,
  getAccessToken,
} from "@/lib/agentforceAuth";

/**
 * POST /api/agents/message
 *
 * Body: { sessionId: string, sequenceId: number, text: string }
 *
 * Proxies POST {AGENTFORCE}/sessions/{sessionId}/messages/stream and pipes
 * the upstream Server-Sent Events stream straight back to the browser. The
 * browser parses `data: {...}\n\n` lines client-side using ReadableStream.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      sequenceId?: number;
      text?: string;
    };

    if (!body.sessionId || typeof body.sequenceId !== "number" || !body.text) {
      return Response.json(
        { ok: false, error: "sessionId, sequenceId, text are all required" },
        { status: 400 },
      );
    }

    const { token } = await getAccessToken();

    const upstream = await fetch(
      `${AGENTFORCE_BASE_URL}/sessions/${body.sessionId}/messages/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: {
            type: "Text",
            sequenceId: body.sequenceId,
            text: body.text,
          },
        }),
      },
    );

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return Response.json(
        {
          ok: false,
          error: `Stream failed: ${upstream.status}`,
          detail: text.slice(0, 500),
          // Mirror Salesforce's 404 so the client can reset its session cleanly.
          sessionExpired: upstream.status === 404,
        },
        { status: upstream.status === 404 ? 410 : 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Disable Nginx-style buffering if we're ever fronted by one.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    if (err instanceof ConfigErrorThrown) {
      return Response.json(err.payload, { status: 503 });
    }
    return Response.json({ ok: false, error: err?.message || "internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/agents/message?sessionId=...
 *
 * Best-effort end-of-session cleanup. AgentForce expires sessions server-side
 * after 24h, so this is mostly cosmetic — it lets a presenter reset between
 * runs without waiting for expiry.
 */
export async function DELETE(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return Response.json({ ok: false, error: "sessionId required" }, { status: 400 });
    }

    const { token } = await getAccessToken();

    const r = await fetch(`${AGENTFORCE_BASE_URL}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-session-end-reason": "UserRequest",
      },
    });

    return Response.json({ ok: r.ok, status: r.status });
  } catch (err: any) {
    if (err instanceof ConfigErrorThrown) {
      return Response.json(err.payload, { status: 503 });
    }
    return Response.json({ ok: false, error: err?.message || "internal error" }, { status: 500 });
  }
}
