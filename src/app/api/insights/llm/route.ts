import { generateText, jsonSchema, Output, tool, type ModelMessage, type ToolSet } from "ai";
import { geminiModel, takeAiCall } from "@/ai/model";
import { allow } from "@/lib/rate-limit";

// Server side of the AG Studio agents' LLM adapter. Studio runs the agent loop in the browser and
// sends one turn at a time in its own (OpenAI Responses-like) format; this route turns that into a
// Gemini call through the AI SDK and returns the text and tool calls. The key never leaves here.

type Item =
  | { type: "message"; role: "user" | "system" | "assistant"; content: { type: string; text?: string; refusal?: string }[] }
  | { type: "function_call"; callId: string; name: string; arguments: string }
  | { type: "function_call_output"; callId: string; output: string }
  | { type: "reasoning" };

type TurnRequest = {
  input: Item[];
  instructions?: string;
  tools?: { name: string; description: string; parameters: Record<string, unknown> }[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  responseFormat?: { type: "text" } | { type: "json"; name: string; schema: Record<string, unknown> };
};

const MAX_BODY_BYTES = 600_000;

// Gemini 3 wants each function call's thought signature back on the next turn. Studio doesn't carry
// provider metadata, so we remember them here by call id (single instance; misses fall back to the
// provider's documented skip value).
const signatures = new Map<string, string>();
function remember(callId: string, signature: unknown) {
  if (typeof signature !== "string") return;
  signatures.set(callId, signature);
  if (signatures.size > 2000) signatures.delete(signatures.keys().next().value!);
}

function toMessages(items: Item[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  const toolNames = new Map<string, string>();
  for (const item of items) {
    if (item.type === "message") {
      const text = item.content.map((c) => c.text ?? c.refusal ?? "").join("\n");
      if (!text) continue;
      if (item.role === "assistant") messages.push({ role: "assistant", content: [{ type: "text", text }] });
      else messages.push({ role: item.role === "system" ? "system" : "user", content: text });
    } else if (item.type === "function_call") {
      toolNames.set(item.callId, item.name);
      let input: unknown = {};
      try {
        input = JSON.parse(item.arguments || "{}");
      } catch {
        input = {};
      }
      const part = {
        type: "tool-call" as const,
        toolCallId: item.callId,
        toolName: item.name,
        input,
        providerOptions: signatures.has(item.callId) ? { google: { thoughtSignature: signatures.get(item.callId)! } } : undefined,
      };
      const last = messages.at(-1);
      // Parallel calls from one model turn belong in one assistant message.
      if (last?.role === "assistant" && Array.isArray(last.content) && last.content.every((p) => p.type === "tool-call")) last.content.push(part);
      else messages.push({ role: "assistant", content: [part] });
    } else if (item.type === "function_call_output") {
      const part = {
        type: "tool-result" as const,
        toolCallId: item.callId,
        toolName: toolNames.get(item.callId) ?? "tool",
        output: { type: "text" as const, value: item.output.slice(0, 40_000) },
      };
      const last = messages.at(-1);
      if (last?.role === "tool") last.content.push(part);
      else messages.push({ role: "tool", content: [part] });
    }
  }
  return messages;
}

function reply(text: string, toolCalls: { callId: string; name: string; arguments: string }[] = []) {
  return Response.json({ id: crypto.randomUUID(), text, toolCalls });
}

// Failures go back as failures, not as an answer: otherwise a delegated agent would take the error
// text as its result and report success to the user.
function failure(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return failure("This conversation got too long. Please start a new chat.", 413);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`insights:${ip}`, 60, 10 * 60_000)) {
    return failure("Lots of questions at once from you. Give it a minute and ask again.", 429);
  }
  // Waits for a free slot in Gemini's per-minute limit, so a multi-agent run queues rather than fails.
  if (!(await takeAiCall("fast", 45_000))) {
    return failure("Gemini is busy or today's allowance for this public demo is used up. The dashboard itself still works.", 429);
  }

  let body: TurnRequest;
  try {
    body = JSON.parse(raw) as TurnRequest;
  } catch {
    return failure("Couldn't read that request.", 400);
  }

  const tools: ToolSet = {};
  for (const t of body.tools ?? []) {
    tools[t.name] = tool({ description: t.description, inputSchema: jsonSchema(t.parameters as never) });
  }
  const choice = body.toolChoice;
  const json = body.responseFormat?.type === "json" ? body.responseFormat : null;

  try {
    const result = await generateText({
      model: geminiModel("fast"),
      system: body.instructions,
      messages: toMessages(body.input),
      tools: Object.keys(tools).length ? tools : undefined,
      toolChoice: !choice ? undefined : typeof choice === "string" ? choice : { type: "tool", toolName: choice.name },
      output: json && Object.keys(tools).length === 0 ? Output.object({ schema: jsonSchema(json.schema as never) }) : undefined,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
      maxOutputTokens: 4000,
    });
    const toolCalls = result.toolCalls.map((c) => {
      remember(c.toolCallId, c.providerMetadata?.google?.thoughtSignature);
      return { callId: c.toolCallId, name: c.toolName, arguments: JSON.stringify(c.input ?? {}) };
    });
    return reply(result.text, toolCalls);
  } catch (err) {
    console.error("insights turn failed", err);
    return err instanceof Error && /429|quota|rate/i.test(err.message)
      ? failure("Gemini's free tier is busy right now. Wait a few seconds and ask again.", 429)
      : failure("Gemini returned an error. Try again, or rephrase the question.", 502);
  }
}
