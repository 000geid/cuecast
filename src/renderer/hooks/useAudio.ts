import { useCallback, useRef } from 'react';
import type { ElectronAPI } from '../../common/types';

declare global { interface Window { electronAPI: ElectronAPI; __cuecastAudio?: any } }

export type ButtonConfig = {
  label: string;
  path: string | null;
  gain: number;
};

export function useAudio() {
  // Singleton across HMR/re-renders to avoid multiple contexts
  if (!window.__cuecastAudio) {
    window.__cuecastAudio = {
      ctx: null as AudioContext | null,
      mainGain: null as GainNode | null,
      dest: null as MediaStreamAudioDestinationNode | null,
      el: null as HTMLAudioElement | null,
      cache: new Map<string, AudioBuffer>(),
      active: new Set<{ src: AudioBufferSourceNode; gain: GainNode }>()
    };
  }
  const audioContextRef = useRef<AudioContext | null>(window.__cuecastAudio.ctx);
  const mainGainRef = useRef<GainNode | null>(window.__cuecastAudio.mainGain);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(window.__cuecastAudio.dest);
  const audioElRef = useRef<HTMLAudioElement | null>(window.__cuecastAudio.el);
  const cacheRef = useRef<Map<string, AudioBuffer>>(window.__cuecastAudio.cache);
  const activeRef = useRef<Set<{ src: AudioBufferSourceNode; gain: GainNode }>>(window.__cuecastAudio.active);

  const init = useCallback(async (outputDeviceId?: string | null) => {
    // Reuse existing context if present
    if (!audioContextRef.current) {
      // Use 'playback' for crackle resistance; allow hardware sampleRate
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'playback' });
      audioContextRef.current = ctx;
      const mainGain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      mainGain.connect(dest);
      mainGainRef.current = mainGain;
      destRef.current = dest;
      const el = document.createElement('audio');
      el.style.display = 'none';
      el.autoplay = true;
      el.muted = false;
      (el as any).srcObject = dest.stream;
      document.body.appendChild(el);
      audioElRef.current = el;
      // Warm-up render pipeline with a short silent buffer
      try {
        const silence = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.05)), ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = silence;
        src.connect(mainGain);
        src.start();
      } catch {}
      el.play().catch(() => {});
      // Persist singleton
      window.__cuecastAudio.ctx = ctx;
      window.__cuecastAudio.mainGain = mainGain;
      window.__cuecastAudio.dest = dest;
      window.__cuecastAudio.el = el;
    }
    const el = audioElRef.current as any;
    if (outputDeviceId && el?.setSinkId) {
      try { await el.setSinkId(outputDeviceId); } catch {}
    }
  }, []);

  const setOutput = useCallback(async (deviceId: string | null) => {
    const el = audioElRef.current as any;
    if (el && el.setSinkId) {
      try { await el.setSinkId(deviceId || ''); } catch {}
    }
  }, []);

  const trigger = useCallback(async (button: ButtonConfig) => {
    const ctx = audioContextRef.current;
    const mainGain = mainGainRef.current;
    if (!ctx || !mainGain || !button.path) return;
    if (ctx.state === 'suspended') await ctx.resume();
    let buf = cacheRef.current.get(button.path);
    if (!buf) {
      const arr = await window.electronAPI.readFileBytes(button.path);
      buf = await ctx.decodeAudioData(arr);
      cacheRef.current.set(button.path, buf);
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = 1.0;
    try { src.detune.value = 0; } catch {}
    // Fast fade-in to avoid clicks when starting playback
    const target = button.gain || 1.0;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.01);
    src.connect(g); g.connect(mainGain);
    activeRef.current.add({ src, gain: g });
    src.addEventListener('ended', () => {
      // Cleanup finished sources
      try { src.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      activeRef.current.forEach((pair) => { if (pair.src === src) activeRef.current.delete(pair); });
    });
    // Small scheduling offset helps avoid initial crackles on some systems
    src.start(audioContextRef.current!.currentTime + 0.005);
  }, []);

  const preload = useCallback(async (path: string) => {
    const ctx = audioContextRef.current;
    if (!ctx || !path || cacheRef.current.has(path)) return;
    try {
      const arr = await window.electronAPI.readFileBytes(path);
      const buf = await ctx.decodeAudioData(arr);
      cacheRef.current.set(path, buf);
    } catch {
      // ignore
    }
  }, []);

  const stopAll = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    activeRef.current.forEach(({ src, gain }) => {
      try {
        // Fast fade-out to prevent clicks, then stop
        const current = gain.gain.value || 0.0001;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(current, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + 0.03);
        src.stop(now + 0.035);
      } catch {}
    });
    // Clear after a tick to allow ended events to fire
    setTimeout(() => {
      activeRef.current.clear();
    }, 50);
  }, []);

  return { init, trigger, setOutput, preload, stopAll };
}
