/**
 * chatCore wire target-format resolver (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Pure resolution of the provider alias + the upstream target format used to translate the request:
 * apiFormat==="responses" forces OpenAI Responses; otherwise the model's registry target format, then
 * a narrow ollama-cloud Claude-native override (a Claude-format client talking to ollama-cloud skips
 * the lossy claude->openai bridge and resolves straight to targetFormat="claude" — port of
 * decolua/9router#2475, scoped to this one provider; see DefaultExecutor.buildUrl for the matching
 * `claudeBaseUrl` routing), then the per-model custom override (#2905), then the provider default.
 * Returns both `alias` (reused by the handler when stripping the `alias/` prefix off the upstream
 * model id) and `targetFormat`. Side-effect-free; byte-identical to the previous inline block for
 * every provider other than ollama-cloud. Sits alongside the other request-setup resolvers
 * (resolveChatCoreRequestSetup / resolveChatCoreRequestFormat).
 */

import { PROVIDER_ID_TO_ALIAS, getModelTargetFormat } from "../../config/providerModels.ts";
import { getTargetFormat } from "../../services/provider.ts";
import { FORMATS } from "../../translator/formats.ts";

// Providers with a native Claude-format (`/v1/messages`) upstream (registry `claudeBaseUrl`) that a
// Claude-format client should be routed to directly instead of through the openai bridge. Kept as an
// explicit allowlist (not a generic transport framework) — port of decolua/9router#2475.
const CLAUDE_NATIVE_PASSTHROUGH_PROVIDERS = new Set(["ollama-cloud"]);

export function resolveChatCoreTargetFormat(opts: {
  provider: string;
  resolvedModel: string;
  apiFormat: string | undefined;
  customModelTargetFormat: string | undefined;
  providerSpecificData: unknown;
  sourceFormat?: string;
}) {
  const {
    provider,
    resolvedModel,
    apiFormat,
    customModelTargetFormat,
    providerSpecificData,
    sourceFormat,
  } = opts;
  const alias = PROVIDER_ID_TO_ALIAS[provider] || provider;
  const modelTargetFormat = getModelTargetFormat(alias, resolvedModel);
  const claudeNativeOverride =
    sourceFormat === FORMATS.CLAUDE && CLAUDE_NATIVE_PASSTHROUGH_PROVIDERS.has(provider)
      ? FORMATS.CLAUDE
      : undefined;
  const targetFormat =
    apiFormat === "responses"
      ? FORMATS.OPENAI_RESPONSES
      : modelTargetFormat ||
        claudeNativeOverride ||
        customModelTargetFormat ||
        getTargetFormat(provider, providerSpecificData);
  return { alias, targetFormat };
}

export type ChatCoreTargetFormat = ReturnType<typeof resolveChatCoreTargetFormat>;
