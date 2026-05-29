const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Parse body safely — req.json() throws on empty body
  let text: string | undefined;
  let targetLanguage = "english";
  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim().length === 0) {
      console.warn("Empty request body");
      return new Response(
        JSON.stringify({ success: true, translation: "", original: "" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const body = JSON.parse(rawBody);
    text = body.text;
    targetLanguage = body.targetLanguage ?? "english";
  } catch (parseError) {
    console.error("Body parse error:", parseError instanceof Error ? parseError.message : parseError);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ success: true, translation: text ?? "", original: text ?? "" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY secret is not set");
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const languageMap: Record<string, string> = {
    english: "English",
    french: "French",
    dutch: "Dutch",
  };
  const targetLang = languageMap[targetLanguage.toLowerCase()] || "English";

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
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content:
              `You are a professional translator specializing in beach volleyball referee reports.\n\n` +
              `IMPORTANT: Translate ONLY to ${targetLang}.\n\n` +
              `Translate the following Italian text to ${targetLang}. Keep meaning and context intact. ` +
              `Maintain professional beach volleyball terminology.\n` +
              `Output ONLY the ${targetLang} translation. No original text, no explanations, no quotes.\n\n` +
              `Text to translate:\n${text}`,
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

    if (
      (translation.startsWith('"') && translation.endsWith('"')) ||
      (translation.startsWith("'") && translation.endsWith("'"))
    ) {
      translation = translation.slice(1, -1);
    }

    if (!translation) translation = text;

    return new Response(
      JSON.stringify({ success: true, translation, original: text }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
