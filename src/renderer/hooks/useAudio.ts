import { useCallback, useState } from 'react';
import type { ButtonConfig, ElectronAPI } from '../../common/types';

declare global { interface Window { electronAPI: ElectronAPI; __cuecastAudio?: any } }

type PlaybackVoice = {
  src: AudioBufferSourceNode;
  gain: GainNode;
};

export type CueLoadState = 'idle' | 'loading' | 'ready' | 'error';

export function useAudio() {
  // Singleton across HMR/re-renders to avoid multiple contexts
  if (!window.__cuecastAudio) {
    window.__cuecastAudio = {
      ctx: null as AudioContext | null,
      mainGain: null as GainNode | null,
      streamDest: null as MediaStreamAudioDestinationNode | null,
      el: null as HTMLAudioElement | null,
      cache: new Map<string, AudioBuffer>(),
      cachePromises: new Map<string, Promise<AudioBuffer>>(),
      currentPlayback: null as PlaybackVoice | null,
      unlockListenersBound: false,
      outputMode: 'direct' as 'direct' | 'element'
    };
  }
  const [loadStates, setLoadStates] = useState<Record<string, CueLoadState>>({});

  const setLoadState = useCallback((path: string, next: CueLoadState) => {
    setLoadStates((current) => (current[path] === next ? current : { ...current, [path]: next }));
  }, []);

  const stopPlayback = useCallback((playback: PlaybackVoice, stopTime: number, immediate = false) => {
    try {
      playback.gain.gain.cancelScheduledValues(stopTime);
      if (immediate) {
        playback.gain.gain.setValueAtTime(0.0001, stopTime);
        playback.src.stop(stopTime);
        return;
      }
      const current = playback.gain.gain.value || 0.0001;
      playback.gain.gain.setValueAtTime(current, stopTime);
      playback.gain.gain.linearRampToValueAtTime(0.0001, stopTime + 0.01);
      playback.src.stop(stopTime + 0.012);
    } catch {}
  }, []);

  const ensureStarted = useCallback(async (reason: string) => {
    const ctx = window.__cuecastAudio.ctx as AudioContext | null;
    const el = window.__cuecastAudio.el as (HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }) | null;
    if (!ctx || !el) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (error) {
      window.electronAPI.log('warn', 'AudioContext resume failed', { reason, error: String(error) });
    }

    try {
      await el.play();
    } catch (error) {
      window.electronAPI.log('warn', 'Audio output element play failed', { reason, error: String(error) });
    }

    const started = ctx.state === 'running' && !el.paused;
    if (!started) {
      window.electronAPI.log('warn', 'Audio pipeline is not fully started', {
        reason,
        contextState: ctx.state,
        elementPaused: el.paused
      });
    }
    return started;
  }, []);

  const ensureContextRunning = useCallback(async (reason: string) => {
    const ctx = window.__cuecastAudio.ctx as AudioContext | null;
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (error) {
      window.electronAPI.log('warn', 'AudioContext resume failed', { reason, error: String(error) });
    }

    const started = ctx.state === 'running';
    if (!started) {
      window.electronAPI.log('warn', 'Audio context is not running', { reason, contextState: ctx.state });
    }
    return started;
  }, []);

  const bindUnlockListeners = useCallback(() => {
    if (window.__cuecastAudio.unlockListenersBound) return;

    const unlock = () => {
      if (window.__cuecastAudio.outputMode === 'element') {
        void ensureStarted('user-gesture');
      } else {
        void ensureContextRunning('user-gesture');
      }
    };

    const options: AddEventListenerOptions = { capture: true };
    document.addEventListener('pointerdown', unlock, options);
    document.addEventListener('keydown', unlock, options);
    document.addEventListener('touchstart', unlock, options);

    window.__cuecastAudio.unlockListenersBound = true;
  }, [ensureContextRunning, ensureStarted]);

  const init = useCallback(async (outputDeviceId?: string | null) => {
    // Reuse existing context if present
    if (!window.__cuecastAudio.ctx) {
      // Prefer lower latency for soundboard-style triggering.
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
      const mainGain = ctx.createGain();
      mainGain.connect(ctx.destination);
      const el = document.createElement('audio');
      el.style.display = 'none';
      el.autoplay = true;
      el.muted = false;
      document.body.appendChild(el);
      // Warm-up render pipeline with a short silent buffer
      try {
        const silence = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.05)), ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = silence;
        src.connect(mainGain);
        src.start();
      } catch {}
      // Persist singleton
      window.__cuecastAudio.ctx = ctx;
      window.__cuecastAudio.mainGain = mainGain;
      window.__cuecastAudio.el = el;
    }
    bindUnlockListeners();
    await setOutput(outputDeviceId ?? null);
  }, [bindUnlockListeners]);

  const setOutput = useCallback(async (deviceId: string | null) => {
    const ctx = window.__cuecastAudio.ctx as AudioContext | null;
    const mainGain = window.__cuecastAudio.mainGain as GainNode | null;
    const el = window.__cuecastAudio.el as (HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }) | null;
    if (!ctx || !mainGain) return;

    if (!deviceId) {
      try { mainGain.disconnect(); } catch {}
      mainGain.connect(ctx.destination);
      window.__cuecastAudio.outputMode = 'direct';
      if (el) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {}
      }
      await ensureContextRunning('set-output-direct');
      return;
    }

    if (!window.__cuecastAudio.streamDest) {
      window.__cuecastAudio.streamDest = ctx.createMediaStreamDestination();
    }

    if (el) {
      (el as any).srcObject = window.__cuecastAudio.streamDest.stream;
      if (el.setSinkId) {
        try { await el.setSinkId(deviceId); } catch {}
      }
    }
    try { mainGain.disconnect(); } catch {}
    mainGain.connect(window.__cuecastAudio.streamDest);
    window.__cuecastAudio.outputMode = 'element';
    await ensureStarted('set-output-device');
  }, [ensureContextRunning, ensureStarted]);

  const getOrLoadBuffer = useCallback(async (path: string) => {
    const ctx = window.__cuecastAudio.ctx as AudioContext | null;
    if (!ctx) {
      throw new Error('Audio context is not initialized');
    }

    const cached = window.__cuecastAudio.cache.get(path) as AudioBuffer | undefined;
    if (cached) {
      setLoadState(path, 'ready');
      return cached;
    }

    const existingLoad = window.__cuecastAudio.cachePromises.get(path) as Promise<AudioBuffer> | undefined;
    if (existingLoad) {
      return existingLoad;
    }

    setLoadState(path, 'loading');
    const loadPromise = (async () => {
      const arr = await window.electronAPI.readFileBytes(path);
      const buf = await ctx.decodeAudioData(arr);
      window.__cuecastAudio.cache.set(path, buf);
      window.__cuecastAudio.cachePromises.delete(path);
      setLoadState(path, 'ready');
      return buf;
    })().catch((error) => {
      window.__cuecastAudio.cachePromises.delete(path);
      setLoadState(path, 'error');
      throw error;
    });

    window.__cuecastAudio.cachePromises.set(path, loadPromise);
    return loadPromise;
  }, [setLoadState]);

  const trigger = useCallback(async (button: ButtonConfig, buttonIndex?: number) => {
    const ctx = window.__cuecastAudio.ctx as AudioContext | null;
    const mainGain = window.__cuecastAudio.mainGain as GainNode | null;
    if (!ctx || !mainGain || !button.path) return;
    if (window.__cuecastAudio.outputMode === 'element') {
      const outputEl = window.__cuecastAudio.el as HTMLAudioElement | null;
      if (ctx.state !== 'running' || (outputEl && outputEl.paused)) {
        await ensureStarted(`trigger:${buttonIndex ?? 'unknown'}`);
      }
    } else if (ctx.state !== 'running') {
      await ensureContextRunning(`trigger:${buttonIndex ?? 'unknown'}`);
    }
    const readyBuffer = window.__cuecastAudio.cache.get(button.path) as AudioBuffer | undefined;
    const buf = readyBuffer ?? await getOrLoadBuffer(button.path);
    const now = ctx.currentTime;
    const currentPlayback = window.__cuecastAudio.currentPlayback as PlaybackVoice | null;
    if (currentPlayback) {
      stopPlayback(currentPlayback, now, true);
      window.__cuecastAudio.currentPlayback = null;
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = 1.0;
    try { src.detune.value = 0; } catch {}
    const target = button.gain ?? 1.0;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(target, now + 0.002);
    src.connect(g); g.connect(mainGain);
    const playback: PlaybackVoice = { src, gain: g };
    window.__cuecastAudio.currentPlayback = playback;
    src.addEventListener('ended', () => {
      // Cleanup finished sources
      try { src.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      if (window.__cuecastAudio.currentPlayback === playback) {
        window.__cuecastAudio.currentPlayback = null;
      }
    });
    src.start(now);
  }, [ensureStarted, getOrLoadBuffer, stopPlayback]);

  const preload = useCallback(async (path: string) => {
    if (!path) return;
    try {
      await getOrLoadBuffer(path);
    } catch {
      // ignore
    }
  }, [getOrLoadBuffer]);

  const stopAll = useCallback(() => {
    const ctx = window.__cuecastAudio.ctx as AudioContext | null;
    if (!ctx) return;
    const now = ctx.currentTime;
    const currentPlayback = window.__cuecastAudio.currentPlayback as PlaybackVoice | null;
    if (!currentPlayback) return;
    stopPlayback(currentPlayback, now, true);
    window.__cuecastAudio.currentPlayback = null;
  }, [stopPlayback]);

  return { init, trigger, setOutput, preload, stopAll, loadStates };
}
