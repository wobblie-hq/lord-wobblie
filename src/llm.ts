const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export async function llm(messages: LLMMessage[], json = true): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.2,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = (await response.json()) as any;
  return data.choices[0].message.content;
}
