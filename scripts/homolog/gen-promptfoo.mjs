import fs from "node:fs";
import path from "node:path";
import { pickSmokeModels } from "./lib/providerTiers.mjs";

const baseUrl = process.env.HOMOLOG_BASE_URL;
const critical = (process.env.HOMOLOG_CRITICAL_PROVIDERS || "").split(",").filter(Boolean);

const res = await fetch(`${baseUrl}/v1/models`, {
  headers: { Authorization: `Bearer ${process.env.HOMOLOG_API_KEY}` },
});
if (!res.ok) throw new Error(`/v1/models HTTP ${res.status}`);
const catalog = (await res.json()).data;

const picks = pickSmokeModels(catalog, critical);
const missing = picks.filter((p) => !p.model);
const providers = picks
  .filter((p) => p.model)
  .map((p) => ({
    id: `openai:chat:${p.model}`,
    label: p.provider,
    config: {
      apiBaseUrl: `${baseUrl}/v1`,
      apiKeyEnvar: "HOMOLOG_API_KEY",
      max_tokens: 5,
      temperature: 0,
    },
  }));

const config = {
  description: "OmniRoute homolog — smoke real 1 request/provider crítico",
  prompts: ["Reply with exactly: OK"],
  providers,
  tests: [{ assert: [{ type: "icontains", value: "OK" }] }],
};
fs.mkdirSync("homolog-report", { recursive: true });
fs.writeFileSync(
  path.join("homolog-report", "promptfooconfig.yaml"),
  JSON.stringify(config, null, 2) // promptfoo aceita JSON como config YAML-compatível
);
fs.writeFileSync(
  path.join("homolog-report", "provider-misses.json"),
  JSON.stringify(missing, null, 2)
);
console.log(
  `[gen-promptfoo] ${providers.length} providers no smoke, ${missing.length} misses de catálogo`
);
