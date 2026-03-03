import { useState, useEffect, useCallback } from 'react';
import { audioManager, AudioState } from '@/lib/audio';
import { LuPlay, LuPause, LuX, LuVolume2, LuVolumeX } from 'react-icons/lu';

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const s = Math.floor(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PlayerBar() {
  const [state, setState] = useState<AudioState>(() => audioManager.state);

  useEffect(() => {
    return audioManager.onStateChange(setState);
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    audioManager.seek(Number(e.target.value));
  }, []);

  const togglePlay = useCallback(() => {
    if (state.playing) {
      audioManager.pause();
    } else if (state.src) {
      audioManager.play(state.src);
    }
  }, [state.playing, state.src]);

  if (!state.src) return null;

  const title = state.title ?? 'Unknown Track';
  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;

  return (
    <div className="flex items-center gap-3 border-t border-border bg-bg-surface px-4 select-none shrink-0 h-10">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="shrink-0 text-fg-secondary hover:text-fg-primary transition-colors"
        title={state.playing ? 'Pause' : 'Play'}
      >
        {state.playing ? <LuPause size={14} /> : <LuPlay size={14} />}
      </button>

      {/* Track info */}
      <div className="w-48 min-w-0 shrink-0">
        <div className="truncate text-[12px] font-medium text-fg-primary leading-tight">{title}</div>
        {state.artist && (
          <div className="truncate text-[10px] text-fg-muted leading-tight">{state.artist}</div>
        )}
      </div>

      {/* Progress */}
      <div className="flex flex-1 items-center gap-2">
        <span className="shrink-0 text-[10px] text-fg-muted tabular-nums w-8 text-right">
          {formatTime(state.currentTime)}
        </span>
        <div className="relative flex-1 h-1">
          {/* Track fill */}
          <div
            className="absolute inset-y-0 left-0 bg-accent/40 rounded-full pointer-events-none"
            style={{ width: `${progress * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={state.duration || 0}
            step={0.1}
            value={state.currentTime}
            onChange={handleScrub}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          />
        </div>
        <span className="shrink-0 text-[10px] text-fg-muted tabular-nums w-8">
          {formatTime(state.duration)}
        </span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => audioManager.setVolume(state.volume === 0 ? 0.8 : 0)}
          className="text-fg-muted hover:text-fg-primary transition-colors"
          title={state.volume === 0 ? 'Unmute' : 'Mute'}
        >
          {state.volume === 0 ? <LuVolumeX size={13} /> : <LuVolume2 size={13} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          onChange={(e) => audioManager.setVolume(Number(e.target.value))}
          className="w-20 cursor-pointer accent-amber-500"
          title={`Volume ${Math.round(state.volume * 100)}%`}
        />
      </div>

      {/* Close */}
      <button
        onClick={() => audioManager.stop()}
        className="shrink-0 text-fg-muted hover:text-fg-primary transition-colors"
        title="Stop"
      >
        <LuX size={12} />
      </button>
    </div>
  );
}
