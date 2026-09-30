import { createHash } from "node:crypto";
import type { AgentConfigReadback } from "@getpaseo/protocol/messages";
import type { ManagedAgent } from "../../agent/agent-manager.js";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function valueDigest(value: unknown): string {
  return sha256(canonicalJson(value ?? null));
}

/**
 * Read-only and privacy preserving: no env values, MCP config, provider options,
 * or system-prompt bytes leave the daemon. Fingerprints use sorted-key canonical
 * JSON and describe the persisted ManagedAgent projection. They deliberately do
 * not attest providerLaunchConfig overlays such as daemonAppendSystemPrompt or
 * the runtime-injected Paseo MCP server; provider/session behavior is separate.
 */
export function createAgentConfigReadback(agent: ManagedAgent): AgentConfigReadback {
  const revision = agent.updatedAt.toISOString();
  const config = agent.config;
  const fields = {
    featureValuesSha256: valueDigest(config.featureValues),
    envSha256: agent.launchEnvironmentSha256 ?? null,
    providerOptionsSha256: valueDigest(config.providerOptions),
    toolPolicySha256: valueDigest(config.toolPolicy),
    mcpServersSha256: valueDigest(config.mcpServers),
    systemPromptSha256:
      config.systemPrompt === undefined ? null : sha256(canonicalJson(config.systemPrompt)),
  };
  const identity = {
    contract: "paseo.agent-config-readback.v1" as const,
    projection: "agent-manager-stored-config" as const,
    agentId: agent.id,
    revision,
    provider: agent.provider,
    cwd: agent.cwd,
    model: config.model ?? null,
    modeId: config.modeId ?? agent.currentModeId ?? null,
    thinkingOptionId: config.thinkingOptionId ?? null,
    ...fields,
  };
  return { ...identity, configSha256: sha256(canonicalJson(identity)) };
}
