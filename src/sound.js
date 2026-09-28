const SOUND_STORAGE_KEY = 'sushi-stack-kitchen-sound-enabled';
const BGM_URL = new URL('../assets/audio/bossa-antigua.mp3', import.meta.url).href;
const BGM_VOLUME = 0.22;

function readEnabledSetting() {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function saveEnabledSetting(enabled) {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // Sound is still usable when preferences cannot be stored.
  }
}

export class GameSound {
  constructor() {
    this.enabled = readEnabledSetting();
    this.context = null;
    this.master = null;
    this.music = null;
    this.bgmAudio = null;
    this.bgmSource = null;
    this.bgmPlayPromise = null;
    this.bgmEpoch = 0;
    this.bgmRequested = false;
    this.effectEpoch = 0;
    this.effectNodes = new Set();
    this.pageVisible = typeof document === 'undefined' || !document.hidden;
    this.onPlaybackChange = null;
  }

  async unlock() {
    if (!this.enabled || !this.pageVisible || typeof window === 'undefined') {
      return false;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return false;
    }
    if (this.context?.state === 'closed') {
      this.stopBgm({ keepIntent: true });
      this.stopEffects();
      this.context = null;
      this.master = null;
      this.music = null;
      // A media element can only be attached to one MediaElementSource.
      this.bgmAudio = null;
      this.bgmSource = null;
    }
    if (!this.context) {
      try {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0.18;
        const softness = this.context.createBiquadFilter();
        softness.type = 'lowpass';
        softness.frequency.value = 2600;
        this.master.connect(softness);
        softness.connect(this.context.destination);
        this.music = this.context.createGain();
        this.music.gain.value = BGM_VOLUME;
        this.music.connect(this.context.destination);
      } catch {
        this.context = null;
        this.master = null;
        this.music = null;
        return false;
      }
    }
    if (this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch {
        // The next interaction retries if mobile autoplay is restricted.
      }
    }
    this.notifyPlayback();
    return this.context.state === 'running';
  }

  ensureBgmAudio() {
    if (!this.bgmAudio && typeof window !== 'undefined' && window.Audio) {
      const audio = new window.Audio();
      audio.preload = 'none';
      audio.loop = true;
      audio.volume = BGM_VOLUME;
      audio.src = BGM_URL;
      this.bgmAudio = audio;
      audio.onplaying = () => this.notifyPlayback();
      audio.onpause = () => this.notifyPlayback();
      audio.onerror = () => this.notifyPlayback();
    }
    if (this.bgmAudio && this.context && this.music && !this.bgmSource) {
      try {
        const source = this.context.createMediaElementSource(this.bgmAudio);
        source.connect(this.music);
        this.bgmSource = source;
        // Use a gain node so the same quiet mix also works on iOS.
        this.bgmAudio.volume = 1;
      } catch {
        // Native audio remains available when Web Audio routing is unsupported.
      }
    }
    return this.bgmAudio;
  }

  canPlayBgm() {
    return this.bgmRequested && this.enabled && this.pageVisible;
  }

  isBgmPlaying() {
    return Boolean(this.canPlayBgm() && this.bgmAudio && !this.bgmAudio.paused
      && (!this.context || this.context.state === 'running'));
  }

  notifyPlayback() {
    this.onPlaybackChange?.(this.isBgmPlaying());
  }

  resumeBgm() {
    if (!this.canPlayBgm()) {
      return Promise.resolve(false);
    }
    // Invoke play in the gesture's call stack, before awaiting audio unlock.
    const unlocking = this.unlock();
    const audio = this.ensureBgmAudio();
    if (!audio) {
      return Promise.resolve(false);
    }
    if (this.bgmPlayPromise) {
      return this.bgmPlayPromise;
    }
    if (!audio.paused) {
      return unlocking.then(() => this.canPlayBgm());
    }
    const epoch = this.bgmEpoch;
    let playing;
    try {
      playing = audio.play();
    } catch {
      return Promise.resolve(false);
    }
    const pending = Promise.all([playing, unlocking]).then(() => {
      if (epoch !== this.bgmEpoch || !this.canPlayBgm()) {
        if (!this.canPlayBgm()) {
          audio.pause();
        }
        return false;
      }
      this.notifyPlayback();
      return !audio.paused;
    }).catch(() => {
      this.notifyPlayback();
      return false;
    }).finally(() => {
      if (this.bgmPlayPromise === pending) {
        this.bgmPlayPromise = null;
      }
    });
    this.bgmPlayPromise = pending;
    return pending;
  }

  startBgm() {
    this.bgmRequested = true;
    return this.resumeBgm();
  }

  stopBgm({ keepIntent = false, suspendContext = false } = {}) {
    if (!keepIntent) {
      this.bgmRequested = false;
    }
    this.bgmEpoch += 1;
    this.bgmPlayPromise = null;
    this.bgmAudio?.pause();
    this.notifyPlayback();
    // Keep the playhead so toggling sound never restarts the opening.
    if (suspendContext) {
      this.stopEffects();
      if (this.context?.state === 'running') {
        this.context.suspend().catch(() => {});
      }
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    saveEnabledSetting(this.enabled);
    if (this.enabled) {
      void this.resumeBgm();
    } else {
      this.stopBgm({ keepIntent: true, suspendContext: true });
    }
    return this.enabled;
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  pauseForVisibility() {
    this.pageVisible = false;
    this.stopBgm({ keepIntent: true, suspendContext: true });
  }

  resumeAfterVisibility() {
    this.pageVisible = true;
    return this.resumeBgm();
  }

  stopEffects() {
    this.effectEpoch += 1;
    this.effectNodes.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The short percussion envelope may have already finished.
      }
    });
    this.effectNodes.clear();
  }

  tone(frequency, delay, duration, volume) {
    if (!this.enabled || !this.pageVisible || this.context?.state !== 'running') {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    this.effectNodes.add(oscillator);
    oscillator.onended = () => {
      this.effectNodes.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  tap(frequency, delay = 0, volume = 0.12) {
    // Brief, damped resonances evoke a small wooden/ceramic tap.
    this.tone(frequency, delay, 0.065, volume);
    this.tone(frequency * 2.17, delay, 0.027, volume * 0.15);
  }

  chime(frequency, delay = 0, volume = 0.12) {
    this.tone(frequency, delay, 0.32, volume);
    this.tone(frequency * 2.01, delay, 0.11, volume * 0.1);
  }

  play(name) {
    if (!this.enabled || !this.pageVisible) {
      return;
    }
    if (this.context?.state !== 'running') {
      const epoch = this.effectEpoch;
      this.unlock().then((unlocked) => {
        if (unlocked && epoch === this.effectEpoch) {
          this.play(name);
        }
      });
      return;
    }
    switch (name) {
      case 'pick':
        this.tap(440, 0, 0.11);
        break;
      case 'triple':
        this.chime(659, 0, 0.13);
        this.chime(880, 0.025, 0.075);
        break;
      case 'craft':
        this.tap(360, 0, 0.12);
        this.tap(480, 0.06, 0.08);
        break;
      case 'serve':
        this.chime(660, 0, 0.12);
        this.chime(990, 0.015, 0.065);
        break;
      case 'undo':
        this.tap(330, 0, 0.09);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((note, index) => this.chime(note, index * 0.1, 0.09));
        this.chime(659, .42, .055);
        this.chime(1047, .55, .05);
        break;
      case 'lose':
        this.tap(190, 0, .1);
        this.tap(150, .12, .075);
        this.tone(130, .23, .2, .05);
        break;
      default:
        this.tap(520, 0, 0.07);
    }
  }
}
