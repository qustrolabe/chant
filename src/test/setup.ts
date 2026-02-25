import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @tauri-apps/api/core so bindings.ts doesn't crash outside Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
