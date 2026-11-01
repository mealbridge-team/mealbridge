import type { AgAiEvent, AgAiOutputItem, AgLlmAdapter, AgLlmRequest, AgLlmResponse } from "ag-studio";

type TurnReply = { id: string; text: string; toolCalls: { callId: string; name: string; arguments: string }[] } | { error: string };

// AG Studio's agents talk to models through an adapter. This one forwards each turn to our own
// /api/insights/llm route (which calls Gemini with the server-side key) and replays the answer as
// Studio's message and tool-call events.
export function geminiAdapter(endpoint = "/api/insights/llm"): AgLlmAdapter {
  return {
    executeTurn(request: AgLlmRequest, options) {
      const reply: Promise<TurnReply> = fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: request.input,
          instructions: request.instructions,
          tools: request.tools?.filter((t) => t.kind !== "provided").map(({ name, description, parameters }) => ({ name, description, parameters })),
          toolChoice: request.toolChoice,
          responseFormat: request.responseFormat,
        }),
        signal: options?.signal,
      })
        .then((res) => res.json() as Promise<TurnReply>)
        .catch((err: unknown): TurnReply => ({ error: err instanceof Error && err.name === "AbortError" ? "Cancelled." : "Couldn't reach the server." }));

      const complete: Promise<AgLlmResponse> = reply.then((r) => {
        if ("error" in r) {
          return { id: crypto.randomUUID(), createdAt: Date.now(), output: [], status: "failed", error: { code: "llm_error", message: r.error } };
        }
        const output: AgAiOutputItem[] = [];
        if (r.text) {
          output.push({
            id: `msg_${r.id}`,
            kind: "output",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "text", text: r.text, annotations: [] }],
          });
        }
        for (const call of r.toolCalls) {
          output.push({ id: `fc_${call.callId}`, kind: "output", type: "function_call", callId: call.callId, name: call.name, arguments: call.arguments, status: "completed" });
        }
        return { id: r.id, createdAt: Date.now(), output, status: "completed", model: "gemini" };
      });

      async function* stream(): AsyncGenerator<AgAiEvent> {
        const r = await reply;
        if ("error" in r) return;
        if (r.text) {
          const messageId = `msg_${r.id}`;
          yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant" };
          yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: r.text };
          yield { type: "TEXT_MESSAGE_END", messageId };
        }
        for (const call of r.toolCalls) {
          yield { type: "TOOL_CALL_START", toolCallId: call.callId, toolCallName: call.name };
          yield { type: "TOOL_CALL_ARGS", toolCallId: call.callId, delta: call.arguments };
          yield { type: "TOOL_CALL_END", toolCallId: call.callId };
        }
      }

      return { stream: stream(), complete };
    },
  };
}
