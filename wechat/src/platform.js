export function createWechatPlatform(api, raf, cancelRaf) {
  const canvas = api.createCanvas();
  let audio = null, enabled = true, foreground = true, audioReady = false;
  function playMusic() {
    if (!enabled || !foreground || !audioReady) return;
    if (!audio) {
      audio = api.createInnerAudioContext(); audio.loop = true; audio.volume = .22;
      audio.src = 'resources/assets/audio/bossa-antigua.mp3';
      audio.onError?.(() => {}); // Music failure must not block the puzzle.
    }
    audio.play();
  }
  function size() {
    const info = api.getWindowInfo ? api.getWindowInfo() : api.getSystemInfoSync();
    const capsule = api.getMenuButtonBoundingClientRect?.();
    return { width: info.windowWidth, height: info.windowHeight, ratio: Math.min(3, info.pixelRatio || 1), top: Math.max(info.safeArea?.top || 0, capsule?.bottom ? capsule.bottom + 5 : 0), bottom: Math.max(0, info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight)) };
  }
  const platform = {
    canvas, size, now: () => Date.now(), raf: callback => raf(callback), cancelRaf: id => cancelRaf(id),
    get(key) { try { return api.getStorageSync(key); } catch { return null; } },
    set(key, value) { try { api.setStorageSync(key, value); return true; } catch { return false; } },
    image(src) {
      return new Promise((resolve, reject) => {
        const img = api.createImage();
        const timer = setTimeout(() => { img.onload = null; img.onerror = null; reject(new Error('Image timeout')); }, 15000);
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => { clearTimeout(timer); reject(new Error('Image failed: ' + src)); };
        img.src = src;
      });
    },
    loadResources(onProgress) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => { settled = true; reject(new Error('Package timeout')); }, 30000);
        const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
        const task = api.loadSubpackage({ name: 'resources', success: () => finish(), fail: error => finish(error) });
        task?.onProgressUpdate?.(event => { if (!settled) onProgress(event.progress / 100); });
      });
    },
    resource(path) { return path === 'sushi-atlas-v2.png' ? 'boot/sushi-atlas-v2.png' : 'resources/assets/' + path; },
    musicReady() { audioReady = true; playMusic(); },
    sound(value) { enabled = value; if (value) playMusic(); else audio?.pause(); },
    effect(name) { if (enabled && foreground) api.vibrateShort?.({ type: name === 'win' ? 'medium' : name === 'lose' ? 'heavy' : 'light', fail() {} }); },
    bind(handlers) {
      const pointer = (e, action) => { const t = (e.changedTouches || e.touches)?.[0]; if (t) action({ x: t.clientX, y: t.clientY, id: t.identifier }); };
      api.onTouchStart(e => { playMusic(); pointer(e, handlers.down); });
      api.onTouchMove(e => pointer(e, handlers.move));
      api.onTouchEnd(e => pointer(e, handlers.up));
      api.onTouchCancel(() => handlers.cancel());
      api.onWindowResize?.(handlers.resize);
      api.onHide(() => { foreground = false; audio?.pause(); handlers.hide(); });
      api.onShow(() => { foreground = true; playMusic(); handlers.show(); });
    }
  };
  return platform;
}
