/**
 * Tests for Ollama Cloud's native Claude-format (`/v1/messages`) passthrough transport
 * (port of decolua/9router#2475).
 *
 * Covers:
 *   1. buildUrl routes to the registry's claudeBaseUrl when
 *      providerSpecificData._omnirouteOllamaClaudeUpstream === true.
 *   2. The default openai-format chat/completions path is preserved otherwise.
 *   3. buildHeaders adds Anthropic-Version only on the native-claude path; the
 *      Authorization: Bearer scheme (registry authHeader) is unchanged on both paths.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { DefaultExecutor } from "@omniroute/open-sse/executors/default.ts";

test("DefaultExecutor.buildUrl routes ollama-cloud to claudeBaseUrl when the native-claude marker is set", () => {
  const executor = new DefaultExecutor("ollama-cloud");

  const url = executor.buildUrl("deepseek-v4-pro", true, 0, {
    apiKey: "test-key",
    providerSpecificData: { _omnirouteOllamaClaudeUpstream: true },
  });

  assert.equal(url, "https://ollama.com/v1/messages");
});

test("DefaultExecutor.buildUrl keeps the default openai bridge path when the marker is absent", () => {
  const executor = new DefaultExecutor("ollama-cloud");

  const url = executor.buildUrl("deepseek-v4-pro", true, 0, {
    apiKey: "test-key",
    providerSpecificData: {},
  });

  assert.equal(url, "https://ollama.com/v1/chat/completions");
});

test("DefaultExecutor.buildUrl keeps the default openai bridge path with no credentials at all", () => {
  const executor = new DefaultExecutor("ollama-cloud");
  const url = executor.buildUrl("deepseek-v4-pro", true, 0, null);
  assert.equal(url, "https://ollama.com/v1/chat/completions");
});

test("DefaultExecutor.buildHeaders adds Anthropic-Version only on the native-claude path", () => {
  const executor = new DefaultExecutor("ollama-cloud");

  const claudeHeaders = executor.buildHeaders(
    { apiKey: "test-key", providerSpecificData: { _omnirouteOllamaClaudeUpstream: true } },
    true
  );
  assert.equal(claudeHeaders["Anthropic-Version"], "2023-06-01");
  assert.equal(claudeHeaders["Authorization"], "Bearer test-key");

  const openaiHeaders = executor.buildHeaders(
    { apiKey: "test-key", providerSpecificData: {} },
    true
  );
  assert.equal("Anthropic-Version" in openaiHeaders, false);
  assert.equal(openaiHeaders["Authorization"], "Bearer test-key");
});
