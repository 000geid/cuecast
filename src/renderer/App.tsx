import React, { useCallback, useEffect, useRef, useState } from 'react';

type ButtonConfig = {
  label: string;
  path: string | null;
  gain: number;
};

type AppConfig = {
  buttons: ButtonConfig[];
  hotkeys: Record<string, number>;
  outputDeviceId: string | null;
};

import type { ElectronAPI } from '../common/types';
declare global { interface Window { electronAPI: ElectronAPI } }

function useAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  const init = useCallback(async (outputDeviceId?: string | null) => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive', sampleRate: 44100 });
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
    el.play().catch(() => {});
    if (outputDeviceId && (el as any).setSinkId) {
      try { await (el as any).setSinkId(outputDeviceId); } catch {}
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
    g.gain.value = button.gain || 1.0;
    src.connect(g); g.connect(mainGain);
    src.start(0);
  }, []);

  return { init, trigger, setOutput };
}

function normalizeAccelerator(acc: string): string {
  return acc
    .replace(/\bCmd\b/g, 'Command')
    .replace(/\bCtrl\b/g, 'Control')
    .replace(/\bCmdOrCtrl\b/g, 'CommandOrControl')
    .replace(/\bEsc\b/g, 'Escape');
}

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState('Ready');
  const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;index:number}|null>(null);
  const [hotkeyIndex, setHotkeyIndex] = useState<number | null>(null);
  const [hotkeyText, setHotkeyText] = useState<string>('');
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const audio = useAudio();

  useEffect(() => {
    (async () => {
      const cfg = await window.electronAPI.getConfig();
      setConfig(cfg);
      await audio.init(cfg.outputDeviceId);
      window.electronAPI.onTriggerButton((i:number) => {
        if (!cfg || !cfg.buttons[i]) return;
        audio.trigger(cfg.buttons[i]);
      });
      window.electronAPI.onHotkeysRegistered?.((results) => {
        const ok = results.filter(r => r.ok).map(r => r.accelerator);
        const fail = results.filter(r => !r.ok).map(r => r.accelerator);
        setStatus(fail.length ? `Some hotkeys failed: ${fail.join(', ')}` : (ok.length ? `Hotkeys active: ${ok.join(', ')}` : 'No hotkeys set'));
      });
    })();
  }, []);

  // Populate available audio output devices; update on device changes
  useEffect(() => {
    let disposed = false;
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outs = devices.filter(d => d.kind === 'audiooutput');
        if (!disposed) setAudioOutputs(outs);
      } catch {
        // ignore
      }
    };
    loadDevices();
    const onChange = () => loadDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      disposed = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+Shift+D toggles console log level
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'D') {
        e.preventDefault();
        try {
          const current = await window.electronAPI.getLogSettings();
          const order: Array<'error'|'warn'|'info'|'debug'> = ['error','warn','info','debug'];
          const idx = order.indexOf(current.level as any);
          const next = order[(idx + 1) % order.length];
          await window.electronAPI.setLogSettings({ level: next } as any);
          setStatus(`Console log level: ${next}`);
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const updateConfig = useCallback(async (partial: Partial<AppConfig>) => {
    const next = await window.electronAPI.updateConfig({ ...(config||{}), ...partial });
    setConfig(next);
  }, [config]);

  const assignAudio = useCallback(async (i: number) => {
    const filePath = await window.electronAPI.selectAudioFile();
    if (!filePath || !config) { setStatus('Assignment canceled'); return; }
    const name = filePath.split('/').pop()?.split('.')[0] || 'Unknown';
    const buttons = [...config.buttons];
    buttons[i] = { ...buttons[i], label: name, path: filePath };
    await updateConfig({ buttons });
    setStatus(`Assigned: ${name}`);
  }, [config, updateConfig]);

  const assignAudioPath = useCallback(async (i: number, filePath: string) => {
    if (!config) return;
    const name = filePath.split('/').pop()?.split('.')[0] || 'Unknown';
    const buttons = [...config.buttons];
    buttons[i] = { ...buttons[i], label: name, path: filePath };
    await updateConfig({ buttons });
    setStatus(`Assigned: ${name}`);
  }, [config, updateConfig]);

  const clearButton = useCallback(async (i:number) => {
    if (!config) return;
    const buttons = [...config.buttons];
    buttons[i] = { label: 'Empty', path: null, gain: 1.0 };
    const hotkeys = { ...config.hotkeys };
    Object.keys(hotkeys).forEach(k => { if (hotkeys[k] === i) delete hotkeys[k]; });
    await updateConfig({ buttons, hotkeys });
    setStatus('Button cleared');
  }, [config, updateConfig]);

  const setHotkey = useCallback(async (i:number, acc: string) => {
    if (!config) return;
    const normalized = normalizeAccelerator(acc);
    const conflict = config.hotkeys[normalized];
    if (conflict !== undefined && conflict !== i) { setStatus('Hotkey already in use'); return; }
    const hotkeys = { ...config.hotkeys };
    Object.keys(hotkeys).forEach(k => { if (hotkeys[k] === i) delete hotkeys[k]; });
    hotkeys[normalized] = i;
    await updateConfig({ hotkeys });
    setStatus(`Hotkey set: ${normalized}`);
  }, [config, updateConfig]);

  const triggerIndex = useCallback(async (i:number) => {
    if (!config) return;
    const btn = config.buttons[i];
    if (!btn || !btn.path) { await assignAudio(i); return; }
    await audio.trigger(btn);
  }, [config, audio, assignAudio]);

  const onOutputChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    await audio.setOutput(val || null);
    await updateConfig({ outputDeviceId: val || null });
    setStatus(val ? 'Output device changed' : 'Using default output');
  }, [audio, updateConfig]);

  const onContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, index });
  }, []);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.context-menu')) setCtxMenu(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const onHotkeyKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    if (['Control','Meta','Alt','Shift'].includes(e.key)) return;
    const mods: string[] = [];
    if (e.ctrlKey || e.metaKey) mods.push('CommandOrControl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.startsWith('Arrow')) key = key.replace('Arrow','');
    if (key === 'Escape') key = 'Escape';
    const isFn = /^F\d{1,2}$/.test(key);
    const isChar = key.length === 1;
    if (mods.length || isFn || isChar) {
      const acc = mods.length ? `${mods.join('+')}+${isChar ? key.toUpperCase() : key}` : (isChar ? key.toUpperCase() : key);
      setHotkeyText(acc);
    }
  }, []);

  const assignedHotkey = (i: number) => {
    if (!config) return '';
    return Object.keys(config.hotkeys).find(k => config.hotkeys[k] === i) || '';
  };

  if (!config) return null;

  return (
    <div className="app">
      <header className="header">
        <h1>CueCast</h1>
        <div className="controls">
          <select id="output-device" className="device-select" onChange={onOutputChange} defaultValue={config.outputDeviceId || ''}>
            <option value="">Default Output</option>
            {audioOutputs.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Audio Device ${d.deviceId.slice(0,8)}`}</option>
            ))}
          </select>
        </div>
      </header>
      <main className="main">
        <div className="button-grid">
          {config.buttons.map((b, i) => (
            <div
              key={i}
              className={`sound-button ${b.path ? '' : 'empty'}`}
              onClick={() => triggerIndex(i)}
              onContextMenu={(e) => onContextMenu(e, i)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerIndex(i); } }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer?.files || []);
                const audio = files.find(f => ['wav','mp3','ogg','flac'].includes((f.name.split('.').pop()||'').toLowerCase()));
                if (audio) assignAudioPath(i, (audio as any).path);
                else setStatus('Invalid file type. Use .wav, .mp3, .ogg, or .flac');
              }}
            >
              <div className="button-label">{b.label}</div>
              <div className="button-hotkey">{assignedHotkey(i)}</div>
            </div>
          ))}
        </div>
      </main>
      <footer className="footer">
        <div className="status">{status}</div>
        <div className="info">Right-click buttons to assign audio files</div>
      </footer>

      {ctxMenu && (
        <div
          id="context-menu"
          className="context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y, position: 'fixed' }}
        >
          <div className="context-menu-item" onClick={() => { closeCtx(); assignAudio(ctxMenu.index); }}>Assign Audio File</div>
          <div className="context-menu-item" onClick={() => { closeCtx(); clearButton(ctxMenu.index); }}>Clear</div>
          <div className="context-menu-item" onClick={() => { closeCtx(); setHotkeyIndex(ctxMenu.index); setHotkeyText(''); }}>Set Hotkey</div>
        </div>
      )}

      {hotkeyIndex !== null && (
        <div id="hotkey-modal" className="modal" role="dialog" aria-modal="true" tabIndex={0}
          onKeyDown={onHotkeyKeyDown}
        >
          <div className="modal-content">
            <h3>Set Hotkey</h3>
            <p>Press the key combination you want to use:</p>
            <div id="hotkey-display" className="hotkey-display">{hotkeyText || 'Press keys...'}</div>
            <div className="modal-buttons">
              <button id="hotkey-cancel" onClick={() => setHotkeyIndex(null)}>Cancel</button>
              <button id="hotkey-save" disabled={!hotkeyText} onClick={async () => {
                await setHotkey(hotkeyIndex!, hotkeyText);
                setHotkeyIndex(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
