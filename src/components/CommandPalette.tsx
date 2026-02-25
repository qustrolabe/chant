import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LuHouse,
  LuMicVocal,
  LuDisc3,
  LuMusic,
  LuSettings,
  LuWrench,
  LuPanelLeft,
  LuBot,
} from "react-icons/lu";

export function CommandPalette({
  open,
  onOpenChange,
  leftVisible,
  rightVisible,
  onToggleLeft,
  onToggleRight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leftVisible: boolean;
  rightVisible: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const run = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command Palette"
      container={document.body}
    >
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-xl bg-bg-surface border border-border-strong rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <CommandInput
            placeholder="Search commands..."
            className="w-full bg-transparent border-none outline-none px-4 py-4 text-fg-primary placeholder:text-fg-muted text-sm border-b border-border"
          />
          <CommandList className="max-h-[300px] overflow-auto p-2 scrollbar-hide">
            <CommandEmpty className="p-4 text-center text-xs text-fg-muted">
              No results found.
            </CommandEmpty>

            <CommandGroup
              heading="Navigation"
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted"
            >
              <CommandItem
                onSelect={() => run(() => navigate({ to: "/" }))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="library search"
              >
                <LuHouse className="w-4 h-4" />
                Library
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => navigate({ to: "/artists" }))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="artists search"
              >
                <LuMicVocal className="w-4 h-4" />
                Artists
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => navigate({ to: "/albums" }))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="albums search"
              >
                <LuDisc3 className="w-4 h-4" />
                Albums
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => navigate({ to: "/tracks" }))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="songs tracks search"
              >
                <LuMusic className="w-4 h-4" />
                Tracks
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className="my-1 border-t border-border" />

            <CommandGroup
              heading="Controls"
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted"
            >
              <CommandItem
                onSelect={() => run(onToggleLeft)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="toggle sidebar left"
              >
                <LuPanelLeft className="w-4 h-4" />
                {leftVisible ? "Hide" : "Show"} Sidebar
              </CommandItem>
              <CommandItem
                onSelect={() => run(onToggleRight)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="toggle agent chat right"
              >
                <LuBot className="w-4 h-4" />
                {rightVisible ? "Hide" : "Show"} Agent
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className="my-1 border-t border-border" />

            <CommandGroup
              heading="System"
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted"
            >
              <CommandItem
                onSelect={() => run(() => navigate({ to: "/settings" }))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="settings preferences"
              >
                <LuSettings className="w-4 h-4" />
                Settings
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => navigate({ to: "/debug" }))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary cursor-pointer transition-colors"
                value="debug tools database"
              >
                <LuWrench className="w-4 h-4" />
                Debug View
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </div>
      </div>
    </CommandDialog>
  );
}
