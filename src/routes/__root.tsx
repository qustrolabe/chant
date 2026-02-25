import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppTitleBar } from "../components/layout/TitleBar";
import { StatusBar } from "../components/layout/StatusBar";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "../components/CommandPalette";
import {
  LuHouse,
  LuMicVocal,
  LuDisc3,
  LuTable,
  LuSettings,
  LuWrench,
} from "react-icons/lu";

function RootLayout() {
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(320);
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(false);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const onMouseDown = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(side);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (dragging === "left") {
        const w = Math.max(180, Math.min(400, e.clientX - rect.left));
        setLeftWidth(w);
      } else {
        const w = Math.max(260, Math.min(500, rect.right - e.clientX));
        setRightWidth(w);
      }
    };
    const onMouseUp = () => setDragging(null);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-base text-fg-primary">
      <AppTitleBar
        leftVisible={leftVisible}
        rightVisible={rightVisible}
        onToggleLeft={() => setLeftVisible((v) => !v)}
        onToggleRight={() => setRightVisible((v) => !v)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        leftVisible={leftVisible}
        rightVisible={rightVisible}
        onToggleLeft={() => setLeftVisible((v) => !v)}
        onToggleRight={() => setRightVisible((v) => !v)}
      />

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        {leftVisible && (
          <>
            <aside
              className="flex flex-col overflow-hidden border-r border-border bg-bg-surface"
              style={{ width: leftWidth, minWidth: leftWidth }}
            >
              <div className="p-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Navigate
              </div>
              <nav className="flex flex-col gap-0.5 px-2">
                <NavItem icon={<LuHouse />} label="Library" to="/" />
                <NavItem icon={<LuMicVocal />} label="Artists" to="/artists" />
                <NavItem icon={<LuDisc3 />} label="Albums" to="/albums" />
                <NavItem icon={<LuTable />} label="Table" to="/table" />
              </nav>

              <div className="mt-4 p-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Development
              </div>
              <nav className="flex flex-col gap-0.5 px-2">
                <NavItem icon={<LuWrench />} label="Debug View" to="/debug" />
              </nav>

              <div className="mt-auto border-t border-border p-3">
                <NavItem icon={<LuSettings />} label="Settings" to="/settings" />
              </div>
            </aside>

            {/* Left resize handle */}
            <div
              className={`w-[3px] cursor-col-resize transition-colors hover:bg-accent/40 z-30 ${
                dragging === "left" ? "bg-accent/60" : "bg-transparent"
              }`}
              onMouseDown={onMouseDown("left")}
            />
          </>
        )}

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-auto bg-bg-base">
          <Outlet />
        </div>

        {/* ── Right Sidebar (Agent) ── */}
        {rightVisible && (
          <>
            {/* Right resize handle */}
            <div
              className={`w-[3px] cursor-col-resize transition-colors hover:bg-accent/40 z-30 ${
                dragging === "right" ? "bg-accent/60" : "bg-transparent"
              }`}
              onMouseDown={onMouseDown("right")}
            />

            <aside
              className="flex flex-col overflow-hidden border-l border-border bg-bg-surface"
              style={{ width: rightWidth, minWidth: rightWidth }}
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="inline-block h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgba(169,182,101,0.4)]" />
                <h2 className="text-xs font-semibold text-fg-secondary">
                  AI Agent
                </h2>
              </div>
              <div className="flex flex-1 flex-col gap-3 overflow-auto p-4 scrollbar-hide">
                <ChatBubble
                  from="agent"
                  text="Hey! I'm your music library assistant. I can help you find lyrics, fix metadata, organize albums, and more."
                />
                <ChatBubble
                  from="user"
                  text="Find all tracks missing album art"
                />
                <ChatBubble
                  from="agent"
                  text="I found 23 tracks without cover art across 4 albums. Would you like me to search for covers automatically?"
                />
              </div>
              <div className="border-t border-border p-3 bg-bg-base">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask the agent..."
                    className="flex-1 rounded-lg border border-border-strong bg-bg-input px-3 py-2.5 text-xs text-fg-secondary outline-none placeholder:text-fg-muted focus:border-accent/50 transition-all"
                  />
                  <button className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-base transition-all hover:bg-accent-hover active:scale-95">
                    Send
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
      <StatusBar />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}

function NavItem({
  icon,
  label,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      activeProps={{
        className:
          "bg-accent-muted font-semibold text-fg-primary shadow-sm shadow-black/20",
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all text-fg-muted hover:bg-bg-overlay hover:text-fg-secondary group`}
    >
      <span className="w-4 text-center text-sm group-hover:scale-110 transition-transform">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function ChatBubble({ from, text }: { from: "user" | "agent"; text: string }) {
  return (
    <div
      className={`flex ${from === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-lg ${
          from === "user"
            ? "rounded-br-none bg-accent text-bg-base"
            : "rounded-bl-none bg-bg-overlay text-fg-secondary border border-border"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
