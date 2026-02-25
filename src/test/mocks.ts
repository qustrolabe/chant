import { vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

/**
 * Mock Tauri invoke calls. Pass a map of command name -> return value.
 *
 * Usage:
 *   mockInvoke({ list_collections: [] });
 */
export function mockInvoke(handlers: Record<string, unknown>) {
  mockedInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
    if (cmd in handlers) {
      const val = handlers[cmd];
      return typeof val === "function" ? (val as Function)(args) : val;
    }
    throw new Error(`Unmocked Tauri command: ${cmd}`);
  });

  return mockedInvoke;
}
