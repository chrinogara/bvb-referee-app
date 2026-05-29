// Supabase Edge Function: translate-with-claude
//
// Translates Italian text to English using the Claude API.
// The Anthropic API key is read from the ANTHROPIC_API_KEY secret on the
// server, so it is NEVER exposed to the browser/client.
//
// Set the secret with:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Call from the client with supabase.functions.invoke('translate-with-claude', { body: { text } })

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage = "english" } = await req.json();

    // Nothing to translate
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: true, translation: text ?? "", original: text ?? "" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const languageMap: Record<string, string> = {
      "english": "English",
      "french": "French",
      "dutch": "Dutch",
    };

    const targetLang = languageMap[targetLanguage.toLowerCase()] || "English";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content:
              `You are a professional translator for beach volleyball referee reports.\n\n` +
              `Translate the following Italian text to ${targetLang}. Keep the meaning and ` +
              `context intact, especially beach volleyball terminology.\n` +
              `Respond ONLY with the ${targetLang} translation, without quotes, explanations, ` +
              `or any additional text.\n\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = await response.json();
    let translation: string = data?.content?.[0]?.text?.trim() ?? "";

    // Strip surrounding quotes if Claude wrapped the response
    if (
      (translation.startsWith('"') && translation.endsWith('"')) ||
      (translation.startsWith("'") && translation.endsWith("'"))
    ) {
      translation = translation.slice(1, -1);
    }

    // Fall back to the original text if no translation came back
    if (!translation) translation = text;

    return new Response(
      JSON.stringify({ success: true, translation, original: text }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
