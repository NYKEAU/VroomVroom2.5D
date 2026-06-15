import { Howl, Howler } from 'howler';

import hoverOgg from '../assets/audio/sfx/hover.ogg';
import clickOgg from '../assets/audio/sfx/click.ogg';
import engineWav from '../assets/audio/sfx/engine-loop.wav';

const musicModules = import.meta.glob('/src/assets/audio/music/*.mp3', { eager: true });

const LS_KEY = 'vroomvroom_audio_volumes';

function loadVolumes() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { master: 1, music: 0.4, sfx: 0.7 };
}

function saveVolumes(v) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {}
}

function extractTrackName(path) {
  const filename = path.split('/').pop();
  return filename.replace(/\.mp3$/, '');
}

export default class AudioManager {
  constructor() {
    this._initialized = false;
    this._muted = false;

    const saved = loadVolumes();
    this._masterVolume = saved.master;
    this._musicVolume = saved.music;
    this._sfxVolume = saved.sfx;

    this._musicTracks = [];
    this._currentMusicIndex = -1;
    this._currentTrackName = '';
    this._musicHowl = null;

    this._hoverPool = [];
    this._clickPool = [];
    this._hoverIndex = 0;
    this._clickIndex = 0;
    this._engineHowl = null;
    this._engineRunning = false;
    this._engineFading = false;

    this._onChange = null;
  }

  set onChange(fn) { this._onChange = fn; }
  _notify() { if (this._onChange) this._onChange(); }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    this._loadMusic();
    this._loadSfx();
    this._loadEngine();
    this._applyMaster();
    this._playNextTrack();
  }

  _applyMaster() {
    Howler.volume(this._muted ? 0 : this._masterVolume);
  }

  _loadMusic() {
    const paths = Object.keys(musicModules);
    this._musicTracks = paths.map((p) => ({
      path: p,
      name: extractTrackName(p),
      src: musicModules[p].default || musicModules[p],
    }));
  }

  _loadSfx() {
    const POOL_SIZE = 4;
    for (let i = 0; i < POOL_SIZE; i++) {
      this._hoverPool.push(new Howl({ src: [hoverOgg], volume: this._sfxVolume, preload: true }));
      this._clickPool.push(new Howl({ src: [clickOgg], volume: this._sfxVolume, preload: true }));
    }
  }

  _loadEngine() {
    this._engineHowl = new Howl({
      src: [engineWav],
      volume: 0,
      loop: true,
      preload: true,
    });
  }

  _shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  _playNextTrack() {
    if (this._musicTracks.length === 0) return;

    if (this._musicHowl) {
      this._musicHowl.unload();
      this._musicHowl = null;
    }

    if (this._currentMusicIndex < 0 || this._currentMusicIndex >= this._musicTracks.length - 1) {
      this._musicTracks = this._shuffleArray(this._musicTracks);
      this._currentMusicIndex = 0;
    } else {
      this._currentMusicIndex++;
    }

    const track = this._musicTracks[this._currentMusicIndex];
    this._currentTrackName = track.name;

    this._musicHowl = new Howl({
      src: [track.src],
      volume: this._musicVolume,
      onend: () => this._playNextTrack(),
    });

    this._musicHowl.play();
  }

  get currentTrackName() {
    return this._currentTrackName;
  }

  playHover() {
    if (!this._initialized || this._hoverPool.length === 0) return;
    const howl = this._hoverPool[this._hoverIndex];
    this._hoverIndex = (this._hoverIndex + 1) % this._hoverPool.length;
    howl.volume(this._sfxVolume);
    howl.play();
  }

  playClick() {
    if (!this._initialized || this._clickPool.length === 0) return;
    const howl = this._clickPool[this._clickIndex];
    this._clickIndex = (this._clickIndex + 1) % this._clickPool.length;
    howl.volume(this._sfxVolume);
    howl.play();
  }

  setEngineSpeed(value) {
    if (!this._initialized || !this._engineHowl) return;

    const clamped = Math.max(0, Math.min(1, value));

    if (clamped > 0.05) {
      if (!this._engineRunning) {
        this._engineRunning = true;
        this._engineFading = false;
        this._engineHowl.volume(this._sfxVolume * 0.85);
        this._engineHowl.play();
      }
      const rate = 0.8 + clamped * 0.6;
      this._engineHowl.rate(rate);
    } else {
      if (this._engineRunning && !this._engineFading) {
        this._engineFading = true;
        const startVol = this._engineHowl.volume();
        const startTime = performance.now();
        const duration = 300;

        const fadeStep = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          this._engineHowl.volume(startVol * (1 - progress));

          if (progress < 1) {
            requestAnimationFrame(fadeStep);
          } else {
            this._engineHowl.stop();
            this._engineHowl.volume(0);
            this._engineRunning = false;
            this._engineFading = false;
          }
        };
        requestAnimationFrame(fadeStep);
      }
    }
  }

  setMasterVolume(v) {
    this._masterVolume = Math.max(0, Math.min(1, v));
    this._applyMaster();
    this._persist();
    this._notify();
  }

  setMusicVolume(v) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this._musicHowl) this._musicHowl.volume(this._musicVolume);
    this._persist();
    this._notify();
  }

  setSfxVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    this._hoverPool.forEach(h => h.volume(this._sfxVolume));
    this._clickPool.forEach(h => h.volume(this._sfxVolume));
    if (this._engineHowl && this._engineRunning) this._engineHowl.volume(this._sfxVolume * 0.85);
    this._persist();
    this._notify();
  }

  get masterVolume() { return this._masterVolume; }
  get musicVolume() { return this._musicVolume; }
  get sfxVolume() { return this._sfxVolume; }

  _persist() {
    saveVolumes({ master: this._masterVolume, music: this._musicVolume, sfx: this._sfxVolume });
  }

  toggleMute() {
    this._muted = !this._muted;
    this._applyMaster();
    return this._muted;
  }

  get isMuted() {
    return this._muted;
  }
}

export const audioManager = new AudioManager();
