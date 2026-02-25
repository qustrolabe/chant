import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { commands } from "../bindings";
import { open } from "@tauri-apps/plugin-dialog";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  const [musicDir, setMusicDir] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const res = await commands.getSetting("music_dir");
      if (res.status === "ok") {
        setMusicDir(res.data);
      }
    }
    loadSettings();
  }, []);

  const handlePickFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Music Directory",
    });

    if (selected && typeof selected === "string") {
      const res = await commands.setSetting("music_dir", selected);
      if (res.status === "ok") {
        setMusicDir(selected);
        await commands.addCollection({ path: selected, label: "Main Library" });
      }
    }
  };

  const handleScan = async () => {
    setScanning(true);
    const collections = await commands.listCollections();
    if (collections.status === "ok" && collections.data.length > 0) {
      await commands.scanCollection(collections.data[0].id);
    }
    setScanning(false);
  };

  const handleClearAllData = async () => {
    setClearing(true);
    const res = await commands.clearAllData();
    if (res.status === "ok") {
      // Reload to reset all in-memory caches (cover art, etc.)
      window.location.reload();
    } else {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-light mb-8 text-fg-primary">Settings</h1>

      <div className="space-y-6">
        <div className="bg-bg-overlay rounded-xl p-6 border border-border-strong shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-fg-secondary">
            Library
          </h2>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-wider text-fg-muted font-bold">
              Music Folder
            </label>
            <div className="flex gap-3">
              <div className="flex-1 bg-bg-input rounded-lg px-4 py-2.5 border border-border text-sm text-fg-secondary truncate">
                {musicDir || "No folder selected"}
              </div>
              <button
                type="button"
                onClick={handlePickFolder}
                className="px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium text-bg-base transition-colors"
              >
                Choose
              </button>
            </div>

            {musicDir && (
              <div className="mt-6 flex items-center justify-between p-4 bg-bg-overlay rounded-lg border border-border">
                <div>
                  <h3 className="text-sm font-medium text-fg-secondary">
                    Maintenance
                  </h3>
                  <p className="text-xs text-fg-muted">
                    Scan for new tracks and update database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={scanning}
                  className="px-6 py-2 bg-bg-surface hover:bg-bg-overlay disabled:opacity-50 rounded-lg text-xs font-bold uppercase tracking-widest transition-all text-fg-secondary"
                >
                  {scanning ? "Scanning..." : "Scan Now"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-overlay rounded-xl p-6 border border-border-strong shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-fg-secondary">
            Application
          </h2>
          <div className="text-xs text-fg-muted">
            Chant v0.1.0 (Development Build)
          </div>
        </div>

        <div className="bg-bg-overlay rounded-xl p-6 border border-red-900/50 shadow-xl">
          <h2 className="text-xl font-semibold mb-1 text-red-400">
            Danger Zone
          </h2>
          <p className="text-xs text-fg-muted mb-4">
            These actions are irreversible.
          </p>
          <div className="flex items-center justify-between p-4 bg-bg-base rounded-lg border border-red-900/30">
            <div>
              <h3 className="text-sm font-medium text-fg-secondary">
                Clear all data
              </h3>
              <p className="text-xs text-fg-muted">
                Delete all tracks, albums, artists, collections and cached cover art.
                Your music files are not affected.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {confirmClear ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    disabled={clearing}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-bg-overlay hover:bg-bg-surface text-fg-muted transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllData}
                    disabled={clearing}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                  >
                    {clearing ? "Clearing..." : "Yes, delete everything"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-red-700/60 text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  Clear all data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
