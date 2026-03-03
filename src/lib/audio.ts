const VOLUME_KEY = 'chant_volume';
const DEFAULT_VOLUME = 0.8;

export interface AudioState {
  src: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  title?: string;
  artist?: string;
}

type StateListener = (state: AudioState) => void;

class AudioManager {
  private audio: HTMLAudioElement;
  private _state: AudioState = {
    src: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: DEFAULT_VOLUME,
  };
  private listeners = new Set<StateListener>();
  private _volume: number;

  constructor() {
    this.audio = new Audio();
    this._volume = this._loadVolume();
    this.audio.volume = this._volume;
    this._state.volume = this._volume;

    this.audio.addEventListener('play', () => this._update({ playing: true }));
    this.audio.addEventListener('pause', () => this._update({ playing: false }));
    this.audio.addEventListener('ended', () => {
      this.audio.src = '';
      this._update({ src: null, playing: false, currentTime: 0, duration: 0, title: undefined, artist: undefined });
    });
    this.audio.addEventListener('timeupdate', () =>
      this._update({ currentTime: this.audio.currentTime })
    );
    this.audio.addEventListener('loadedmetadata', () =>
      this._update({ duration: this.audio.duration })
    );
  }

  private _loadVolume(): number {
    try {
      const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '');
      return isNaN(v) ? DEFAULT_VOLUME : Math.max(0, Math.min(1, v));
    } catch {
      return DEFAULT_VOLUME;
    }
  }

  private _update(patch: Partial<AudioState>) {
    this._state = { ...this._state, ...patch };
    this.listeners.forEach((cb) => cb({ ...this._state }));
  }

  play(src: string, meta?: { title?: string; artist?: string }) {
    if (this._state.src !== src) {
      this.audio.src = src;
      this._update({
        src,
        title: meta?.title,
        artist: meta?.artist,
        currentTime: 0,
        duration: 0,
        playing: false,
      });
    } else if (meta) {
      this._update({ title: meta.title, artist: meta.artist });
    }
    this.audio.volume = this._volume;
    this.audio.play().catch(() => {});
  }

  pause() {
    this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = '';
    this._update({ src: null, playing: false, currentTime: 0, duration: 0, title: undefined, artist: undefined });
  }

  seek(time: number) {
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, time));
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.audio.volume = this._volume;
    this._update({ volume: this._volume });
    try {
      localStorage.setItem(VOLUME_KEY, String(this._volume));
    } catch { /* ignore */ }
  }

  getVolume(): number {
    return this._volume;
  }

  get state(): AudioState {
    return { ...this._state };
  }

  onStateChange(cb: StateListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const audioManager = new AudioManager();
