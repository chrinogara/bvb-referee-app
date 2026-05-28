import { Anthropic } from "https://sdk.anthropic.com/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'text' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey });

    // First translation attempt
    const translationResponse = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a professional translator for beach volleyball referee reports.

Translate this Italian text to English. Keep the meaning and context intact, especially for beach volleyball terminology.
Respond ONLY with the English translation, nothing else.

Italian text: "${text}"`,
        },
      ],
    });

    const translation = (
      translationResponse.content[0] as { type: string; text: string }
    ).text.trim();

    // Verify the translation is in English
    const verificationResponse = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Is this text in English? Respond with only "yes" or "no".

Text: "${translation}"`,
        },
      ],
    });

    const verificationText = (
      verificationResponse.content[0] as { type: string; text: string }
    ).text.trim().toLowerCase();
    const isEnglish = verificationText.includes("yes");

    if (!isEnglish) {
      return new Response(
        JSON.stringify({
          error: "Translation verification failed - result is not in English",
          translation,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        translation,
        original: text,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};
