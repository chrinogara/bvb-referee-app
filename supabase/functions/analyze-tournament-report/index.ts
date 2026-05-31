// ════════════════════════════════════════════════════════════════════════════
// analyze-tournament-report
//
// Receives the extracted text of a previous tournament report (any language —
// typically Italian or Dutch) and asks Claude to extract the situations that are
// useful for a pre-tournament referee briefing, mapped to the 5 briefing
// sections. All suggestions are returned in clear, professional ENGLISH suitable
// for beach volleyball refereeing.
//
// Request:  { text: string, tournamentName?: string, reportDate?: string }
// Response: { success: true, suggestions: {
//              key_points: string[],
//              common_faults: string[],
//              technical_focus: string[],
//              captain_communication: string[],
//              general_notes: string[]
//            } }
// ════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMPTY_SUGGESTIONS = {
  key_points: [],
  common_faults: [],
  technical_focus: [],
  captain_communication: [],
  general_notes: [],
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Parse body safely ──────────────────────────────────────────────────────
  let text: string | undefined;
  let tournamentName = "";
  let reportDate = "";
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: true, suggestions: EMPTY_SUGGESTIONS }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const body = JSON.parse(rawBody);
    text = body.text;
    tournamentName = body.tournamentName ?? "";
    reportDate = body.reportDate ?? "";
  } catch (parseError) {
    console.error("Body parse error:", parseError);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  if (!text || typeof text !== "string" || text.trim().length < 20) {
    return new Response(
      JSON.stringify({ success: true, suggestions: EMPTY_SUGGESTIONS }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY secret is not set");
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  // Keep the prompt within a sane size (reports can be long).
  const reportText = text.slice(0, 24000);

  const systemPrompt =
    `You are an expert beach volleyball Referee Coach (RC) preparing a ` +
    `pre-tournament briefing for referees. You receive a report from a PREVIOUS ` +
    `tournament (it may be written in Italian, Dutch, or English).\n\n` +
    `Your job: extract ONLY the situations that are useful for briefing referees ` +
    `before the next tournament, and organise them into 5 fixed sections.\n\n` +
    `SECTIONS:\n` +
    `- "key_points": the most important messages for the team (tournament-specific ` +
    `rules, what to emphasise, scheduling notes).\n` +
    `- "common_faults": recurring referee mistakes to avoid (e.g. delayed whistle, ` +
    `weak captain communication, inconsistent ball-mark protocol).\n` +
    `- "technical_focus": technical aspects to reinforce (protocol timing, line-judge ` +
    `eye contact, scoresheet accuracy, positioning).\n` +
    `- "captain_communication": standards for how referees interact with captains ` +
    `(tone, protest protocol, handling disagreements).\n` +
    `- "general_notes": organisational or logistical issues affecting referees ` +
    `(weather, courts, equipment, hospitality, scheduling, contacts).\n\n` +
    `RULES:\n` +
    `1. Output ALL suggestions in clear, professional ENGLISH suitable for beach ` +
    `volleyball refereeing — translate and rephrase as needed.\n` +
    `2. Each suggestion is ONE concise, actionable sentence (max ~25 words).\n` +
    `3. Include positive situations to reinforce where relevant.\n` +
    `4. Only include content actually supported by the report. If a section has ` +
    `nothing useful, return an empty array for it.\n` +
    `5. Maximum 5 suggestions per section.\n` +
    `6. Do NOT invent referee names, scores, or facts not in the report.\n\n` +
    `OUTPUT FORMAT: Respond with ONLY a valid JSON object, no markdown, no code ` +
    `fences, no explanation. Exact shape:\n` +
    `{"key_points":[],"common_faults":[],"technical_focus":[],` +
    `"captain_communication":[],"general_notes":[]}\n\n` +
    (tournamentName ? `Report tournament: ${tournamentName}\n` : "") +
    (reportDate ? `Report date: ${reportDate}\n` : "") +
    `\nREPORT TEXT:\n${reportText}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const data = await response.json();
    let raw: string = data?.content?.[0]?.text?.trim() ?? "";

    // Strip accidental code fences.
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }
    // Extract the first {...} block if extra text slipped in.
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace > 0 || lastBrace < raw.length - 1) {
      if (firstBrace !== -1 && lastBrace !== -1) {
        raw = raw.slice(firstBrace, lastBrace + 1);
      }
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse Claude JSON:", e, raw.slice(0, 200));
      return new Response(
        JSON.stringify({ success: true, suggestions: EMPTY_SUGGESTIONS }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Normalise: ensure every section is an array of trimmed non-empty strings.
    const suggestions: Record<string, string[]> = {};
    for (const key of Object.keys(EMPTY_SUGGESTIONS)) {
      const arr = Array.isArray(parsed[key]) ? (parsed[key] as unknown[]) : [];
      suggestions[key] = arr
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
        .slice(0, 5);
    }

    return new Response(
      JSON.stringify({ success: true, suggestions }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
