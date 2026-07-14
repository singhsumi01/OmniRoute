/**
 * GPT-5 tools+reasoning guard — `stripGpt5ReasoningWhenTools`.
 *
 * On the raw `openai` Chat Completions surface, GPT-5.x reasoning models reject a
 * request that carries BOTH function tools and an active `reasoning_effort` with
 * HTTP 400: "Function tools with reasoning_effort are not supported for
 * <model> in /v1/chat/completions. Please use /v1/responses instead."
 * (port of 9router#2540). OmniRoute's `forceResponsesUpstream` guard only fires
 * for `openai-compatible-*` connections carrying MCP/tool_search tool shapes —
 * the plain `openai` provider has no equivalent guard, so this scenario still
 * reaches the upstream 400 today. Strip `reasoning_effort`/`reasoning` when
 * function tools are present so the request succeeds on /v1/chat/completions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { stripGpt5ReasoningWhenTools } from "../../open-sse/services/gpt5SamplingGuard.ts";

test("strips reasoning_effort for openai gpt-5.x when function tools are present", () => {
  const body = {
    model: "gpt-5.6-sol",
    reasoning_effort: "high",
    tools: [{ type: "function", function: { name: "read_file" } }],
    messages: [],
  };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-5.6-sol");
  assert.equal(result.reasoning_effort, undefined);
});

test("strips nested reasoning.effort for openai gpt-5.x when function tools are present", () => {
  const body = {
    model: "gpt-5.6-sol",
    reasoning: { effort: "medium" },
    tools: [{ type: "function", function: { name: "read_file" } }],
  };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-5.6-sol");
  assert.equal(result.reasoning, undefined);
});

test("keeps reasoning_effort=none untouched (already non-reasoning mode)", () => {
  const body = {
    model: "gpt-5.6-sol",
    reasoning_effort: "none",
    tools: [{ type: "function", function: { name: "read_file" } }],
  };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-5.6-sol");
  assert.equal(result.reasoning_effort, "none");
});

test("keeps reasoning_effort when there are no tools", () => {
  const body = { model: "gpt-5.6-sol", reasoning_effort: "high", messages: [] };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-5.6-sol");
  assert.equal(result.reasoning_effort, "high");
});

test("keeps reasoning_effort when tools array is empty", () => {
  const body = { model: "gpt-5.6-sol", reasoning_effort: "high", tools: [] };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-5.6-sol");
  assert.equal(result.reasoning_effort, "high");
});

test("non-openai provider is untouched", () => {
  const body = {
    model: "gpt-5.6-sol",
    reasoning_effort: "high",
    tools: [{ type: "function", function: { name: "x" } }],
  };
  const result = stripGpt5ReasoningWhenTools(body, "codex", "gpt-5.6-sol");
  assert.equal(result.reasoning_effort, "high");
});

test("non-gpt-5 openai model is untouched", () => {
  const body = {
    model: "gpt-4o",
    reasoning_effort: "high",
    tools: [{ type: "function", function: { name: "x" } }],
  };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-4o");
  assert.equal(result.reasoning_effort, "high");
});

test("returns the same reference when nothing to strip", () => {
  const body = { model: "gpt-5.6-sol", tools: [{ type: "function" }], messages: [] };
  const result = stripGpt5ReasoningWhenTools(body, "openai", "gpt-5.6-sol");
  assert.equal(result, body);
});

test("logs the stripped fields when a logger is provided", () => {
  const calls: Array<[string, string]> = [];
  const log = { warn: (tag: string, message: string) => calls.push([tag, message]) };
  stripGpt5ReasoningWhenTools(
    {
      model: "gpt-5.6-sol",
      reasoning_effort: "high",
      tools: [{ type: "function", function: { name: "x" } }],
    },
    "openai",
    "gpt-5.6-sol",
    log
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "PARAMS");
  assert.match(calls[0][1], /reasoning_effort/);
});
