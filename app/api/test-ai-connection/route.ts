import { NextResponse } from "next/server";

/**
 * POST /api/test-ai-connection
 * Test connectivity to AI provider with provided API key.
 * Returns { ok: true, model } or { ok: false, error }
 */
export async function POST(req: Request) {
  try {
    const { apiKey, baseUrl, model } = await req.json();

    if (!apiKey || !baseUrl) {
      return NextResponse.json({ ok: false, error: "Thiếu apiKey hoặc baseUrl" }, { status: 400 });
    }

    const testModel = model || "gpt-3.5-turbo"; // minimal test model

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, error: "API Key không hợp lệ (401/403)" });
    }
    if (res.status === 404) {
      return NextResponse.json({ ok: false, error: "Model không tồn tại (404)" });
    }
    if (!res.ok) {
      const errText = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}: ${errText}` });
    }

    const json = await res.json();
    const usedModel = json?.model || json?.choices?.[0]?.message?.role ? testModel : "unknown";

    return NextResponse.json({ ok: true, model: usedModel });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg });
  }
}
