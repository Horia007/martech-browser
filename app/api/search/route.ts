import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  buildClaudeSystemPrompt,
  parseFiltersFromClaude,
  searchMedia,
  type SearchFilters,
} from "@/lib/search";

const CLAUDE_MODEL = "claude-sonnet-4-6";

interface SearchRequestBody {
  query?: string;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error(
      "ANTHROPIC_API_KEY lipsește. Adaugă cheia în fișierul .env.local."
    );
  }

  return new Anthropic({ apiKey });
}

async function extractFiltersFromQuery(query: string): Promise<SearchFilters> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: buildClaudeSystemPrompt(),
    messages: [
      {
        role: "user",
        content: query,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude nu a returnat un răspuns text valid.");
  }

  return parseFiltersFromClaude(textBlock.text);
}

export async function POST(request: Request) {
  try {
    let body: SearchRequestBody;

    try {
      body = (await request.json()) as SearchRequestBody;
    } catch {
      return NextResponse.json(
        { error: "Corpul cererii trebuie să fie JSON valid." },
        { status: 400 }
      );
    }

    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Parametrul 'query' este obligatoriu și nu poate fi gol." },
        { status: 400 }
      );
    }

    const filters = await extractFiltersFromQuery(query);
    const result = searchMedia(filters);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "A apărut o eroare neașteptată la procesarea căutării.";

    const isClientError =
      message.includes("obligatoriu") ||
      message.includes("JSON valid") ||
      message.includes("has_text");

    const isConfigError = message.includes("ANTHROPIC_API_KEY");

    const status = isClientError ? 400 : isConfigError ? 500 : 502;

    console.error("[api/search]", error);

    return NextResponse.json({ error: message }, { status });
  }
}
