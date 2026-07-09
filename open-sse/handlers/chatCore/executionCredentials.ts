/**
 * chatCore execution-credentials resolver (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Pure builder extracted from handleChatCore: derives the per-execution credentials object from the
 * resolved request context. Applies the native-Codex passthrough endpoint override, forces
 * apiType=responses (and the responses-upstream marker) for Azure AI Foundry / OCI when the model
 * routes to the OpenAI Responses format, stamps the ollama-cloud native-Claude-upstream marker when
 * targetFormat="claude" (read by DefaultExecutor.buildUrl/buildHeaders to route to the registry's
 * `claudeBaseUrl` instead of the openai bridge — port of decolua/9router#2475, scoped to this one
 * provider), and threads the Claude Code session id when present. Side-effect-free; behaviour is
 * byte-identical to the previous inline closure for every provider other than ollama-cloud.
 */

import { FORMATS } from "../../translator/formats.ts";

type CredentialsLike =
  | {
      providerSpecificData?: Record<string, unknown> | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

export function resolveExecutionCredentials(opts: {
  credentials: CredentialsLike;
  nativeCodexPassthrough: boolean;
  endpointPath: string;
  targetFormat: string;
  provider: string | null | undefined;
  ccSessionId: string | null;
}) {
  const { credentials, nativeCodexPassthrough, endpointPath, targetFormat, provider, ccSessionId } =
    opts;

  const nextCredentials = nativeCodexPassthrough
    ? { ...credentials, requestEndpointPath: endpointPath }
    : credentials;

  const providerSpecificData =
    nextCredentials?.providerSpecificData &&
    typeof nextCredentials.providerSpecificData === "object"
      ? { ...nextCredentials.providerSpecificData }
      : {};

  // Some providers (Azure AI Foundry, OCI OpenAI-compatible) choose upstream
  // endpoint path from providerSpecificData.apiType. When a model routes to
  // OpenAI Responses format, force apiType=responses unless explicitly set.
  if (
    targetFormat === FORMATS.OPENAI_RESPONSES &&
    (provider === "azure-ai" || provider === "oci") &&
    providerSpecificData.apiType !== "responses"
  ) {
    providerSpecificData.apiType = "responses";
  }

  if (targetFormat === FORMATS.OPENAI_RESPONSES && (provider === "azure-ai" || provider === "oci")) {
    providerSpecificData._omnirouteForceResponsesUpstream = true;
  }

  // Ollama Cloud native Claude passthrough (port of decolua/9router#2475): when
  // resolveChatCoreTargetFormat resolved targetFormat="claude" for ollama-cloud (a
  // Claude-format client), stamp a marker so DefaultExecutor.buildUrl/buildHeaders route to
  // the registry's `claudeBaseUrl` (https://ollama.com/v1/messages) instead of the default
  // openai-format bridge endpoint.
  if (targetFormat === FORMATS.CLAUDE && provider === "ollama-cloud") {
    providerSpecificData._omnirouteOllamaClaudeUpstream = true;
  }

  const withApiType = {
    ...nextCredentials,
    providerSpecificData,
  };

  if (!ccSessionId) return withApiType;

  return {
    ...withApiType,
    providerSpecificData: {
      ...(withApiType?.providerSpecificData || {}),
      ccSessionId,
    },
  };
}
