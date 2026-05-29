// Supabase Edge Function: rules-assistant
//
// Answers FIVB Beach Volleyball refereeing questions using the Claude API.
// The Anthropic API key is read from the ANTHROPIC_API_KEY secret on the
// server, so it is NEVER exposed to the browser/client.
//
// The client builds the message array (including any RAG document context)
// and POSTs it as { messages }. The system prompt, model and web_search tool
// configuration live here on the server.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are the official FIVB **Beach Volleyball** Referee Rules Assistant for the Belgian Beach Tour 2026, supporting RC Nogara Christian (CEV Referee Coach).

# SCOPE — STRICT
- You ONLY answer questions about **Beach Volleyball** refereeing, rules, protocols, signals, sanctions, scoresheet, line judging, court inspection, ball inspection, RC guidelines.
- If a question is NOT about Beach Volleyball, politely decline and ask the user to rephrase.

# KNOWLEDGE PRIORITY (mandatory order)
1. **FIRST**: Search the RELEVANT RULES CONTEXT provided in the user message (extracted from the uploaded FIVB / BVB documents). Always cite the source document name when answering.
2. **ONLY IF the answer is not in the documents**: you may search the web, but EXCLUSIVELY on these official domains:
   - fivb.com
   - cev.eu
   No other sources are allowed. If the answer cannot be found there either, say so honestly.

# REFERENCE DOCUMENTS (treat as authoritative)
- 2025 BVB Illustrated Casebook (Feb 2025)
- 2025 BVB RCM Appendix 1 — Refereeing Guidelines and Instructions
- 2025 FIVB BVB Scoresheet Instructions v1
- 2025 FIVB BVB Line Judging Instructions v1
- 2025 BVB RCM Appendix 8 — Mikasa Ball Inspection Manual
- BVB38 Court Inspection Checklist (Jan 2026)

# ANSWERING STYLE
- Use official FIVB English terminology at all times.
- Reference specific rule numbers when applicable (e.g. "Rule 13.1.2", "Chapter 6 Rule 20").
- Concise and precise — this is used courtside.
- Always cite the source: \`[Document name — page/section]\` or \`[fivb.com]\` / \`[cev.eu]\`.
- For borderline situations, explain the referee's judgment framework ("Call the obvious. When in doubt — do not call.").
- Maintain impartiality and professionalism.`;

const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  allowed_domains: ["fivb.com", "cev.eu"],
  max_uses: 3,
};

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const { messages } = await req.json();

      if (!Array.isArray(messages) || messages.length === 0) {
        return Response.json(
          { error: "messages array is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return Response.json(
          { error: "ANTHROPIC_API_KEY not configured" },
          { status: 500, headers: corsHeaders }
        );
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [WEB_SEARCH_TOOL],
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        return Response.json(
          { error: `Anthropic API error: ${response.status}` },
          { status: 502, headers: corsHeaders }
        );
      }

      const data = await response.json();

      // Extract text blocks (skip tool_use blocks from web_search)
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return Response.json({ text }, { headers: corsHeaders });
    } catch (error) {
      console.error("Rules assistant error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: corsHeaders }
      );
    }
  }),
};
