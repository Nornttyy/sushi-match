import assert from 'node:assert/strict';
import test from 'node:test';
import { GameSound } from '../src/sound.js';

class FakeAudioParam {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  constructor() {
    this.gain = new FakeAudioParam();
    this.frequency = new FakeAudioParam();
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}

function replaceGlobal(testContext, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  testContext.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else delete globalThis[key];
  });
}

function environment(testContext, { delayedPlay = false, supportsWebAudio = true } = {}) {
  const created = [];
  const pending = [];
  const stored = new Map();
  class FakeAudio {
    constructor() {
      this.paused = true;
      this.currentTime = 0;
      this.playCalls = 0;
      this.failNextPlay = false;
      created.push(this);
    }
    play() {
      this.playCalls += 1;
      if (this.failNextPlay) {
        this.failNextPlay = false;
        return Promise.reject(new Error('Autoplay unavailable'));
      }
      this.paused = false;
      if (!delayedPlay) return Promise.resolve();
      return new Promise((resolve) => pending.push(() => {
        this.paused = false;
        resolve();
      }));
    }
    pause() { this.paused = true; }
  }
  replaceGlobal(testContext, 'document', { hidden: false });
  replaceGlobal(testContext, 'localStorage', {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value)
  });
  replaceGlobal(testContext, 'window', {
    AudioContext: supportsWebAudio ? FakeAudioContext : undefined,
    Audio: FakeAudio
  });
  return { created, pending, stored };
}

test('menu and game music share one player without restarting or layering playback', async (t) => {
  const { created } = environment(t);
  const sounds = new GameSound();
  await sounds.unlock();
  assert.equal(created.length, 0, 'unlocking a click effect must not start loading music');
  const starting = sounds.startBgm();
  assert.equal(created[0].playCalls, 1, 'play must run before leaving the gesture call stack');
  assert.equal(await starting, true);
  const audio = created[0];
  assert.equal(audio.loop, true);
  assert.match(audio.src, /assets\/audio\/bossa-antigua\.mp3$/);
  audio.currentTime = 18;
  assert.equal(await sounds.startBgm(), true);
  assert.equal(await sounds.resumeBgm(), true);
  assert.equal(created.length, 1);
  assert.equal(audio.playCalls, 1);
  assert.equal(audio.currentTime, 18, 'moving between menu and gameplay preserves the music');
});

test('mute and backgrounding stop audio, while resuming preserves the track position', async (t) => {
  const { created, stored } = environment(t);
  const sounds = new GameSound();
  await sounds.startBgm();
  const audio = created[0];
  audio.currentTime = 42;
  sounds.pauseForVisibility();
  assert.equal(audio.paused, true);
  assert.equal(sounds.context.state, 'suspended');
  assert.equal(await sounds.resumeAfterVisibility(), true);
  assert.equal(audio.currentTime, 42);

  sounds.setEnabled(false);
  assert.equal(audio.paused, true);
  assert.equal(stored.get('sushi-stack-kitchen-sound-enabled'), 'false');
  sounds.pauseForVisibility();
  assert.equal(await sounds.resumeAfterVisibility(), false, 'returning to a tab must respect mute');
  sounds.setEnabled(true);
  await sounds.resumeBgm();
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 42);

  sounds.stopBgm();
  assert.equal(audio.paused, true);
  assert.equal(await sounds.resumeAfterVisibility(), false, 'an explicit stop clears music intent');
});

test('a pending media play cannot restart music after an explicit stop', async (t) => {
  const { created, pending } = environment(t, { delayedPlay: true });
  const sounds = new GameSound();
  const starting = sounds.startBgm();
  sounds.stopBgm();
  pending.shift()();
  assert.equal(await starting, false);
  assert.equal(created[0].paused, true);
});

test('a stale play completion does not stop a newer game session', async (t) => {
  const { created, pending } = environment(t, { delayedPlay: true });
  const sounds = new GameSound();
  const oldStart = sounds.startBgm();
  sounds.stopBgm();
  const newStart = sounds.startBgm();
  pending.shift()();
  assert.equal(await oldStart, false);
  assert.equal(created[0].paused, false);
  pending.shift()();
  assert.equal(await newStart, true);
});

test('a blocked media start remains retryable and does not break sound effects', async (t) => {
  environment(t);
  const sounds = new GameSound();
  await sounds.unlock();
  const audio = sounds.ensureBgmAudio();
  audio.failNextPlay = true;
  assert.equal(await sounds.startBgm(), false);
  assert.doesNotThrow(() => sounds.play('pick'));
  assert.equal(await sounds.startBgm(), true);
});

test('recorded music can play with native audio when Web Audio is unavailable', async (t) => {
  const { created } = environment(t, { supportsWebAudio: false });
  const sounds = new GameSound();
  assert.equal(await sounds.startBgm(), true);
  assert.ok(created[0].volume < 0.3);
  sounds.setEnabled(false);
  assert.equal(created[0].paused, true);
});
