import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ElectronAPI } from '../common/types';
import type { AppConfig } from '../common/types';
import { useAudio } from './hooks/useAudio';
import { useAudioDevices } from './hooks/useAudioDevices';
import { ContextMenu } from './components/ContextMenu';
import { HotkeyModal } from './components/HotkeyModal';
import { EditButtonModal } from './components/EditButtonModal';

declare global { interface Window { electronAPI: ElectronAPI } }

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState('Ready');
  const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;index:number}|null>(null);
  const [hotkeyIndex, setHotkeyIndex] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const audioOutputs = useAudioDevices();
  const audio = useAudio();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const configRef = useRef<AppConfig | null>(null);
  const triggerIndexRef = useRef<(buttonIndex: number) => void>(() => {});

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      const cfg = await window.electronAPI.getConfig();
      if (disposed) return;
      setConfig(cfg);
      await audio.init(cfg.outputDeviceId);
      // Best-effort preload of already assigned sounds
      cfg.buttons.forEach(b => { if (b.path) audio.preload(b.path); });
      const removeTriggerButtonListener = window.electronAPI.onTriggerButton((i:number) => {
        // Route through triggerIndex to keep UI feedback consistent
        triggerIndexRef.current(i);
      });
      const removeHotkeysRegisteredListener = window.electronAPI.onHotkeysRegistered((results) => {
        const ok = results.filter(r => r.ok).map(r => r.accelerator);
        const fail = results.filter(r => !r.ok).map(r => r.accelerator);
        setStatus(fail.length ? `Some hotkeys failed: ${fail.join(', ')}` : (ok.length ? `Hotkeys active: ${ok.join(', ')}` : 'No hotkeys set'));
      });

      return () => {
        removeTriggerButtonListener();
        removeHotkeysRegisteredListener();
      };
    };

    let cleanup: (() => void) | undefined;
    bootstrap().then((nextCleanup) => {
      cleanup = nextCleanup;
    }).catch(() => {
      if (!disposed) setStatus('Failed to load app config');
    });

    return () => {
      disposed = true;
      cleanup?.();
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
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditable = target
        ? target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
        : null;
      const hasOpenModal = hotkeyIndex !== null || editIndex !== null;
      const isPlainSpace = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === ' ' || e.code === 'Space');

      if (isPlainSpace && !isEditable && !hasOpenModal) {
        e.preventDefault();
        audio.stopAll();
        setPlayingIndex(null);
        setStatus('Stopped all audio');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [audio, editIndex, hotkeyIndex]);

  // Suppress global hotkeys while modals or text inputs are active
  useEffect(() => {
    const shouldDisable = hotkeyIndex !== null || editIndex !== null;
    window.electronAPI.setHotkeysEnabled(!shouldDisable);
    return () => {
      // On unmount or state change, ensure we re-enable if no modals are open
      const stillDisable = hotkeyIndex !== null || editIndex !== null;
      if (!stillDisable) window.electronAPI.setHotkeysEnabled(true);
    };
  }, [hotkeyIndex, editIndex]);

  const assignAudio = useCallback(async (i: number) => {
    const filePath = await window.electronAPI.selectAudioFile();
    if (!filePath || !config) { setStatus('Assignment canceled'); return; }
    const next = await window.electronAPI.assignButtonAudio({ buttonIndex: i, filePath });
    setConfig(next);
    audio.preload(filePath);
    setStatus(`Assigned: ${next.buttons[i].label}`);
  }, [audio, config]);

  const assignAudioPath = useCallback(async (i: number, filePath: string) => {
    if (!config) return;
    const next = await window.electronAPI.assignButtonAudio({ buttonIndex: i, filePath });
    setConfig(next);
    audio.preload(filePath);
    setStatus(`Assigned: ${next.buttons[i].label}`);
  }, [audio, config]);

  const clearButton = useCallback(async (i:number) => {
    if (!config) return;
    const next = await window.electronAPI.clearButton({ buttonIndex: i });
    setConfig(next);
    setStatus('Button cleared');
  }, [config]);

  const setHotkey = useCallback(async (i:number, acc: string) => {
    if (!config) return;
    const result = await window.electronAPI.setButtonHotkey({ buttonIndex: i, accelerator: acc });
    if (!result.ok) {
      setStatus('Hotkey already in use');
      return;
    }
    setConfig(result.config);
    setStatus(`Hotkey set: ${result.accelerator}`);
  }, [config]);

  const triggerIndex = useCallback(async (i:number) => {
    const currentConfig = configRef.current;
    if (!currentConfig) return;
    const btn = currentConfig.buttons[i];
    if (!btn || !btn.path) { await assignAudio(i); return; }
    // Visual feedback for hotkeys and clicks
    setPlayingIndex(i);
    setTimeout(() => { setPlayingIndex(prev => (prev === i ? null : prev)); }, 220);
    await audio.trigger(btn, i);
  }, [audio, assignAudio]);

  useEffect(() => {
    triggerIndexRef.current = (i: number) => {
      void triggerIndex(i);
    };
  }, [triggerIndex]);

  const onOutputChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    await audio.setOutput(val || null);
    const next = await window.electronAPI.setOutputDevice({ deviceId: val || null });
    setConfig(next);
    setStatus(val ? 'Output device changed' : 'Using default output');
  }, [audio]);

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
          <button
            className="btn-stop"
            onClick={() => {
              audio.stopAll();
              setPlayingIndex(null);
              setStatus('Stopped all audio');
            }}
            title="Stop All (Space)"
            aria-keyshortcuts="Space"
          >
            Stop All
          </button>
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
              className={`sound-button ${b.path ? '' : 'empty'} ${playingIndex === i ? 'playing' : ''}`}
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
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onAssign={() => { closeCtx(); assignAudio(ctxMenu.index); }}
          onClear={() => { closeCtx(); clearButton(ctxMenu.index); }}
          onSetHotkey={() => { closeCtx(); setHotkeyIndex(ctxMenu.index); }}
          onEdit={() => { closeCtx(); setEditIndex(ctxMenu.index); }}
        />
      )}

      {hotkeyIndex !== null && (
        <HotkeyModal
          onCancel={() => setHotkeyIndex(null)}
          onSave={async (acc) => { await setHotkey(hotkeyIndex!, acc); setHotkeyIndex(null); }}
        />
      )}

      {editIndex !== null && (
        <EditButtonModal
          initialTitle={config.buttons[editIndex].label}
          initialPath={config.buttons[editIndex].path}
          onCancel={() => setEditIndex(null)}
          onSave={async (title, newPath) => {
            const next = await window.electronAPI.updateButtonDetails({
              buttonIndex: editIndex,
              label: title,
              filePath: newPath
            });
            setConfig(next);
            if (newPath) audio.preload(newPath);
            setStatus('Button updated');
            setEditIndex(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
