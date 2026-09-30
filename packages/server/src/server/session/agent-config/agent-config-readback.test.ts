import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { AgentConfigReadbackSchema } from "@getpaseo/protocol/messages";
import type { ManagedAgent } from "../../agent/agent-manager.js";
import { createAgentConfigReadback } from "./agent-config-readback.js";

function managedAgent(overrides: Partial<ManagedAgent> = {}): ManagedAgent {
  return {
    id: "agent-a",
    provider: "codex",
    cwd: "/work/project",
    capabilities: {} as ManagedAgent["capabilities"],
    config: {
      provider: "codex",
      cwd: "/work/project",
      model: "gpt-test",
      env: { TOKEN: "secret-value" },
      mcpServers: { obsidian: { command: "obsidian-mcp", args: [] } },
      toolPolicy: { mode: "auto", preapproved: [] },
      systemPrompt: "private role prompt",
    },
    launchEnvironmentSha256: createHash("sha256")
      .update(JSON.stringify({ TOKEN: "secret-value" }))
      .digest("hex"),
    createdAt: new Date("2026-09-29T11:00:00.000Z"),
    updatedAt: new Date("2026-09-29T12:00:00.000Z"),
    availableModes: [],
    currentModeId: "default",
    pendingPermissions: new Map(),
    bufferedPermissionResolutions: new Map(),
    inFlightPermissionResponses: new Set(),
    pendingReplacement: false,
    persistence: null,
    historyPrimed: true,
    lastUserMessageAt: null,
    activeTurnId: null,
    activeTurnStartedAt: null,
    attention: {} as ManagedAgent["attention"],
    foregroundTurnWaiters: new Set(),
    finalizedForegroundTurnIds: new Set(),
    unsubscribeSession: null,
    labels: { ORCH_AGENT: "aries-eval", ORCH_PRINCIPAL: "fleet:aries-eval" },
    lifecycle: "closed",
    session: null,
    activeForegroundTurnId: null,
    ...overrides,
  } as ManagedAgent;
}

describe("agent config readback", () => {
  test("binds exact agent/revision and all configured profile fields while returning no raw values", () => {
    const result = createAgentConfigReadback(managedAgent());
    expect(AgentConfigReadbackSchema.parse(result)).toEqual(result);
    expect(result.agentId).toBe("agent-a");
    expect(result.revision).toBe("2026-09-29T12:00:00.000Z");
    expect(result.mcpServersSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.toolPolicySha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.envSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.systemPromptSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(JSON.stringify(result)).not.toContain("private role prompt");
  });

  test("canonical digest is stable for key order and changes for revision or config changes", () => {
    const original = managedAgent();
    const reordered = managedAgent({
      config: {
        ...original.config,
        mcpServers: { obsidian: { args: [], command: "obsidian-mcp" } },
        env: { TOKEN: "secret-value" },
      },
    });
    expect(createAgentConfigReadback(reordered).configSha256).toBe(
      createAgentConfigReadback(original).configSha256,
    );
    expect(
      createAgentConfigReadback(managedAgent({ updatedAt: new Date("2026-09-29T12:00:01.000Z") }))
        .configSha256,
    ).not.toBe(createAgentConfigReadback(original).configSha256);
    expect(
      createAgentConfigReadback(
        managedAgent({
          config: { ...original.config, mcpServers: { other: { command: "other", args: [] } } },
        }),
      ).mcpServersSha256,
    ).not.toBe(createAgentConfigReadback(original).mcpServersSha256);
  });

  test("legacy/imported records report unknown launch environment instead of fabricating a hash", () => {
    const result = createAgentConfigReadback(managedAgent({ launchEnvironmentSha256: undefined }));
    expect(result.envSha256).toBeNull();
    expect(AgentConfigReadbackSchema.parse(result).envSha256).toBeNull();
  });
});
