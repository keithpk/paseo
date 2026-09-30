import { describe, expect, test } from "vitest";
import {
  AgentConfigReadRequestMessageSchema,
  AgentConfigReadResponseMessageSchema,
  ServerInfoStatusPayloadSchema,
} from "./messages.js";

const readback = {
  contract: "paseo.agent-config-readback.v1",
  agentId: "agent-a",
  revision: "2026-09-29T12:00:00.000Z",
  provider: "codex",
  cwd: "/workspace",
  model: "gpt-test",
  modeId: "default",
  thinkingOptionId: null,
  featureValuesSha256: "a".repeat(64),
  envSha256: "b".repeat(64),
  providerOptionsSha256: "c".repeat(64),
  toolPolicySha256: "d".repeat(64),
  mcpServersSha256: "e".repeat(64),
  systemPromptSha256: null,
  configSha256: "f".repeat(64),
};

describe("authenticated per-agent config readback wire contract", () => {
  test("requires exact agent/request identity and fingerprints, without raw config fields", () => {
    expect(AgentConfigReadRequestMessageSchema.parse({
      type: "agent.config.read.request", agentId: "agent-a", requestId: "read-1",
    })).toBeTruthy();
    expect(AgentConfigReadResponseMessageSchema.parse({
      type: "agent.config.read.response",
      payload: { requestId: "read-1", agentId: "agent-a", accepted: true, error: null, readback },
    })).toBeTruthy();
    expect(AgentConfigReadResponseMessageSchema.safeParse({
      type: "agent.config.read.response",
      payload: { requestId: "read-1", agentId: "agent-a", accepted: true, error: null,
        readback: { ...readback, mcpServersSha256: "not-a-digest" } },
    }).success).toBe(false);
    expect(readback).not.toHaveProperty("env");
    expect(readback).not.toHaveProperty("mcpServers");
    expect(readback).not.toHaveProperty("systemPrompt");
    expect(JSON.stringify(readback)).not.toContain("secret-value");
    expect(JSON.stringify(readback)).not.toContain("prompt contents");
  });

  test("new daemon advertises capability while old server-info remains valid", () => {
    const base = { status: "server_info", serverId: "server-a" };
    expect(ServerInfoStatusPayloadSchema.parse({ ...base, features: { agentConfigReadback: true } })
      .features?.agentConfigReadback).toBe(true);
    expect(ServerInfoStatusPayloadSchema.parse(base).features?.agentConfigReadback).toBeUndefined();
  });
});
