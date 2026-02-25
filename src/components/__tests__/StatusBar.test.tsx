import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "../layout/StatusBar";

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => ({
    location: { pathname: "/table" },
  }),
}));

// Mock bindings
vi.mock("../../bindings", () => ({
  commands: {
    getLibraryStats: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        totalTracks: 42,
        totalAlbums: 5,
        totalArtists: 10,
        totalSizeBytes: 1048576,
        totalCollections: 1,
        totalDurationSecs: 3600,
      },
    }),
  },
}));

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<StatusBar />);
    expect(screen.getByText("Table")).toBeInTheDocument();
  });

  it("shows version number", () => {
    render(<StatusBar />);
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("shows current view name for /table", () => {
    render(<StatusBar />);
    expect(screen.getByText("Table")).toBeInTheDocument();
  });
});
