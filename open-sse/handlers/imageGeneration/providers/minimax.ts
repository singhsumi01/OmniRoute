// #2482: MiniMax Text-to-Image provider handler.
// MiniMax's image_generation endpoint is synchronous (unlike its video/music
// endpoints, which are task-based and polled) and returns image URLs directly
// in `data.image_urls`. This normalizes that response into the OpenAI-compatible
// images payload the rest of the handler expects.

import { saveCallLog } from "@/lib/usageDb";
import { sanitizeErrorMessage } from "../../../utils/error.ts";

interface MinimaxImageGenArgs {
  model: string;
  provider: string;
  providerConfig: { baseUrl: string };
  body: { prompt?: string; size?: string; n?: number; response_format?: string };
  credentials: { apiKey?: string; accessToken?: string };
  log?: {
    info?: (tag: string, msg: string) => void;
    error?: (tag: string, msg: string) => void;
  } | null;
}

const MINIMAX_ASPECT_RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]);

function mapMinimaxAspectRatio(size?: string): string {
  if (size && MINIMAX_ASPECT_RATIOS.has(size)) return size;
  return "1:1";
}

export async function handleMinimaxImageGeneration({
  model,
  provider,
  providerConfig,
  body,
  credentials,
  log,
}: MinimaxImageGenArgs) {
  const startTime = Date.now();
  const token = credentials?.apiKey || credentials?.accessToken || "";
  const prompt = typeof body.prompt === "string" ? body.prompt : String(body.prompt ?? "");
  const aspectRatio = mapMinimaxAspectRatio(body.size);

  const upstreamBody = {
    model: model || "image-01",
    prompt,
    aspect_ratio: aspectRatio,
    n: body.n ?? 1,
    response_format: "url",
  };

  if (log) {
    log.info?.(
      "IMAGE",
      `${provider}/${model} (minimax-image) | prompt: "${prompt.slice(0, 60)}..." | aspect_ratio: ${aspectRatio}`
    );
  }

  try {
    const response = await fetch(providerConfig.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (log) log.error?.("IMAGE", `${provider} error ${response.status}: ${errorText.slice(0, 200)}`);

      saveCallLog({
        method: "POST",
        path: "/v1/images/generations",
        status: response.status,
        model: `${provider}/${model}`,
        provider,
        duration: Date.now() - startTime,
        error: errorText.slice(0, 500),
        requestBody: upstreamBody,
      }).catch(() => {});

      return { success: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    const imageUrls: unknown[] = Array.isArray(data?.data?.image_urls) ? data.data.image_urls : [];

    if (imageUrls.length === 0) {
      const errorMsg = data?.base_resp?.status_msg || "No images returned from MiniMax";
      saveCallLog({
        method: "POST",
        path: "/v1/images/generations",
        status: 502,
        model: `${provider}/${model}`,
        provider,
        duration: Date.now() - startTime,
        error: errorMsg,
      }).catch(() => {});
      return { success: false, status: 502, error: errorMsg };
    }

    const images = imageUrls.map((url) => ({ url, revised_prompt: prompt }));

    saveCallLog({
      method: "POST",
      path: "/v1/images/generations",
      status: 200,
      model: `${provider}/${model}`,
      provider,
      duration: Date.now() - startTime,
      responseBody: { images_count: images.length },
    }).catch(() => {});

    return {
      success: true,
      data: { created: Math.floor(Date.now() / 1000), data: images },
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (log) log.error?.("IMAGE", `${provider} fetch error: ${errMsg}`);

    saveCallLog({
      method: "POST",
      path: "/v1/images/generations",
      status: 502,
      model: `${provider}/${model}`,
      provider,
      duration: Date.now() - startTime,
      error: errMsg,
    }).catch(() => {});

    return {
      success: false,
      status: 502,
      error: `Image provider error: ${sanitizeErrorMessage(errMsg)}`,
    };
  }
}
