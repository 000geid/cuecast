import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import i18n from 'i18next';
import type { AppConfig, ElectronAPI } from '../../common/types';
import type { RecentAudioEntry } from '../components/InspectorPanel';
import { normalizeAccelerator } from '../lib/accelerators';
import { useAudio } from './useAudio';
import { useAudioDevices } from './useAudioDevices';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

type ContextMenuState = { x: number; y: number; index: number } | null;
type CueDraft = { label: string; filePath: string | null; gain: number };
type EventItem = { id: number; text: string };

const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'ogg', 'flac']);

function labelFromPath(filePath: string): string {
  const segment = filePath.split(/[\\/]/).pop() ?? filePath;
  return segment.replace(/\.[^.]+$/, '') || segment;
}

function clampGain(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1.5, value));
}

function buildDraft(config: AppConfig, index: number | null): CueDraft {
  if (index === null) {
    return { label: '', filePath: null, gain: 1 };
  }

  const button = config.buttons[index];
  return {
    label: button.label,
    filePath: button.path,
    gain: clampGain(button.gain)
  };
}

function upsertRecentAudio(list: RecentAudioEntry[], filePath: string): RecentAudioEntry[] {
  const nextEntry = {
    path: filePath,
    label: labelFromPath(filePath)
  };
  return [nextEntry, ...list.filter((entry) => entry.path !== filePath)].slice(0, 8);
}

function acceleratorFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) modifiers.push('CommandOrControl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');

  let key = event.key;
  if (key === ' ') key = 'Space';
  if (key.startsWith('Arrow')) key = key.replace('Arrow', '');
  const isFn = /^F\d{1,2}$/i.test(key);
  const isChar = key.length === 1;

  if (!modifiers.length && !isFn && !isChar) {
    return null;
  }

  const normalizedKey = isChar ? key.toUpperCase() : key;
  return normalizeAccelerator(modifiers.length ? `${modifiers.join('+')}+${normalizedKey}` : normalizedKey);
}

export function useCuecastController() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState(i18n.t('status.consoleReady'));
  const [events, setEvents] = useState<EventItem[]>([{ id: 0, text: i18n.t('status.armed') }]);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const [hotkeyIndex, setHotkeyIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [recentAudio, setRecentAudio] = useState<RecentAudioEntry[]>([]);
  const [draft, setDraft] = useState<CueDraft>({ label: '', filePath: null, gain: 1 });

  const audioOutputs = useAudioDevices();
  const audio = useAudio();
  const {
    init: initAudio,
    trigger: triggerAudio,
    setOutput: setAudioOutput,
    preload: preloadAudio,
    stopAll: stopAllPlayback,
    loadStates
  } = audio;
  const configRef = useRef<AppConfig | null>(null);
  const triggerIndexRef = useRef<(buttonIndex: number) => void>(() => {});
  const eventIdRef = useRef(1);
  const playingTimeoutRef = useRef<number | null>(null);
  const lastLocalHotkeyRef = useRef<{ index: number; at: number } | null>(null);

  const pushStatus = useCallback((message: string) => {
    setStatus(message);
    setEvents((current) => [{ id: eventIdRef.current++, text: message }, ...current].slice(0, 6));
  }, []);

  const syncConfig = useCallback(
    (nextConfig: AppConfig) => {
      setConfig(nextConfig);
      if (selectedIndex !== null && selectedIndex >= nextConfig.buttons.length) {
        setSelectedIndex(null);
      }
    },
    [selectedIndex]
  );

  const registerRecentAudio = useCallback((filePath: string) => {
    setRecentAudio((current) => upsertRecentAudio(current, filePath));
  }, []);

  const assignedHotkey = useCallback(
    (index: number) => {
      if (!config) return '';
      return Object.keys(config.hotkeys).find((key) => config.hotkeys[key] === index) || '';
    },
    [config]
  );

  const cueLoadState = useCallback(
    (index: number) => {
      if (!config) return 'idle' as const;
      const path = config.buttons[index]?.path;
      if (!path) return 'idle' as const;
      return loadStates[path] ?? 'idle';
    },
    [config, loadStates]
  );

  const selectIndex = useCallback((index: number) => {
    setSelectedIndex(index);
    setShowSettings(false);
    setCtxMenu(null);
  }, []);

  const assignAudioPath = useCallback(
    async (index: number, filePath: string) => {
      if (!configRef.current) return;
      const nextConfig = await window.electronAPI.assignButtonAudio({ buttonIndex: index, filePath });
      syncConfig(nextConfig);
      preloadAudio(filePath);
      registerRecentAudio(filePath);
      setSelectedIndex(index);
      pushStatus(i18n.t('events.assigned', { label: nextConfig.buttons[index].label }));
    },
    [preloadAudio, pushStatus, registerRecentAudio, syncConfig]
  );

  const assignAudio = useCallback(
    async (index: number) => {
      const filePath = await window.electronAPI.selectAudioFile();
      if (!filePath) {
        pushStatus(i18n.t('events.assignmentCanceled'));
        return;
      }
      await assignAudioPath(index, filePath);
    },
    [assignAudioPath, pushStatus]
  );

  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
    if (!showSettings) {
      setSelectedIndex(null);
    }
  }, [showSettings]);

  const clearButton = useCallback(
    async (index: number) => {
      if (!configRef.current) return;
      const nextConfig = await window.electronAPI.clearButton({ buttonIndex: index });
      syncConfig(nextConfig);
      if (selectedIndex === index) {
        setDraft(buildDraft(nextConfig, index));
      }
      pushStatus(i18n.t('events.cueCleared', { number: index + 1 }));
    },
    [pushStatus, selectedIndex, syncConfig]
  );

  const clearSelectedHotkey = useCallback(async () => {
    if (selectedIndex === null || !configRef.current) return;
    const nextConfig = await window.electronAPI.clearButtonHotkey({ buttonIndex: selectedIndex });
    syncConfig(nextConfig);
    pushStatus(i18n.t('events.hotkeyCleared', { number: selectedIndex + 1 }));
  }, [pushStatus, selectedIndex, syncConfig]);

  const setHotkey = useCallback(
    async (index: number, accelerator: string) => {
      if (!configRef.current) return;
      const result = await window.electronAPI.setButtonHotkey({ buttonIndex: index, accelerator });
      if (!result.ok) {
        pushStatus(i18n.t('events.hotkeyInUse'));
        return;
      }
      syncConfig(result.config);
      pushStatus(i18n.t('events.hotkeySet', { accelerator: result.accelerator }));
    },
    [pushStatus, syncConfig]
  );

  const saveSelectedCue = useCallback(async () => {
    if (selectedIndex === null || !configRef.current) return;
    const nextConfig = await window.electronAPI.updateButtonDetails({
      buttonIndex: selectedIndex,
      label: draft.label.trim() || 'Untitled',
      filePath: draft.filePath,
      gain: clampGain(draft.gain)
    });
    syncConfig(nextConfig);
    if (draft.filePath) {
      preloadAudio(draft.filePath);
      registerRecentAudio(draft.filePath);
    }
    pushStatus(i18n.t('events.cueUpdated', { number: selectedIndex + 1 }));
  }, [draft, preloadAudio, pushStatus, registerRecentAudio, selectedIndex, syncConfig]);

  const chooseFileForSelectedCue = useCallback(async () => {
    const filePath = await window.electronAPI.selectAudioFile();
    if (!filePath) {
      pushStatus(i18n.t('events.fileSelectionCanceled'));
      return;
    }

    setDraft((current) => ({
      ...current,
      filePath,
      label: current.label === 'Empty' || !current.label.trim() ? labelFromPath(filePath) : current.label
    }));
    registerRecentAudio(filePath);
    pushStatus(i18n.t('events.loadedFile', { name: labelFromPath(filePath) }));
  }, [pushStatus, registerRecentAudio]);

  const triggerIndex = useCallback(
    async (index: number) => {
      const currentConfig = configRef.current;
      if (!currentConfig) return;

      const button = currentConfig.buttons[index];
      if (!button || !button.path) {
        await assignAudio(index);
        return;
      }

      setPlayingIndex(index);
      if (playingTimeoutRef.current !== null) {
        window.clearTimeout(playingTimeoutRef.current);
      }
      playingTimeoutRef.current = window.setTimeout(() => {
        setPlayingIndex((previous) => (previous === index ? null : previous));
        playingTimeoutRef.current = null;
      }, 220);
      await triggerAudio(button, index);
    },
    [assignAudio, triggerAudio]
  );

  const stopAllAudio = useCallback(() => {
    stopAllPlayback();
    setPlayingIndex(null);
    pushStatus(i18n.t('events.stoppedAll'));
  }, [pushStatus, stopAllPlayback]);

  const onOutputChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      await setAudioOutput(value || null);
      const nextConfig = await window.electronAPI.setOutputDevice({ deviceId: value || null });
      syncConfig(nextConfig);
      pushStatus(value ? i18n.t('events.outputChanged') : i18n.t('events.usingDefault'));
    },
    [pushStatus, setAudioOutput, syncConfig]
  );

  const onContextMenu = useCallback((event: React.MouseEvent, index: number) => {
    event.preventDefault();
    setCtxMenu({ x: event.clientX, y: event.clientY, index });
    setSelectedIndex(index);
  }, []);

  const handleDropAudio = useCallback(
    async (index: number, dataTransfer: DataTransfer | null) => {
      if (!dataTransfer) return;

      const recentPath = dataTransfer.getData('text/cuecast-audio-path');
      if (recentPath) {
        await assignAudioPath(index, recentPath);
        return;
      }

      const files = Array.from(dataTransfer.files || []);
      const audioFile = files.find((file) => AUDIO_EXTENSIONS.has((file.name.split('.').pop() || '').toLowerCase()));

      if (audioFile) {
        await assignAudioPath(index, (audioFile as File & { path?: string }).path || audioFile.name);
      } else {
        pushStatus(i18n.t('events.invalidFileType'));
      }
    },
    [assignAudioPath, pushStatus]
  );

  const assignRecentToSelected = useCallback(
    (filePath: string) => {
      if (selectedIndex === null) return;
      setDraft((current) => ({
        ...current,
        filePath,
        label: current.label === 'Empty' || !current.label.trim() ? labelFromPath(filePath) : current.label
      }));
      pushStatus(i18n.t('events.loadedRecent', { name: labelFromPath(filePath) }));
    },
    [pushStatus, selectedIndex]
  );

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (!config) return;
    setDraft(buildDraft(config, selectedIndex));
  }, [config, selectedIndex]);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      const nextConfig = await window.electronAPI.getConfig();
      if (disposed) return;

      syncConfig(nextConfig);
      setRecentAudio(
        nextConfig.buttons
          .map((button) => button.path)
          .filter((path): path is string => Boolean(path))
          .reduce<RecentAudioEntry[]>((list, path) => upsertRecentAudio(list, path), [])
      );
      await initAudio(nextConfig.outputDeviceId);
      nextConfig.buttons.forEach((button) => {
        if (button.path) {
          preloadAudio(button.path);
        }
      });

      const removeTriggerButtonListener = window.electronAPI.onTriggerButton((index: number) => {
        const recentLocalHotkey = lastLocalHotkeyRef.current;
        if (
          document.hasFocus() &&
          recentLocalHotkey &&
          recentLocalHotkey.index === index &&
          performance.now() - recentLocalHotkey.at < 25
        ) {
          return;
        }
        triggerIndexRef.current(index);
      });
      const removeHotkeysRegisteredListener = window.electronAPI.onHotkeysRegistered((results) => {
        const ok = results.filter((result) => result.ok).map((result) => result.accelerator);
        const fail = results.filter((result) => !result.ok).map((result) => result.accelerator);

        if (fail.length) {
          pushStatus(i18n.t('events.hotkeysFailed', { list: fail.join(', ') }));
        } else if (ok.length) {
          pushStatus(i18n.t('events.hotkeysActive', { list: ok.join(', ') }));
        } else {
          pushStatus(i18n.t('events.noHotkeys'));
        }
      });

      return () => {
        removeTriggerButtonListener();
        removeHotkeysRegisteredListener();
      };
    };

    let cleanup: (() => void) | undefined;
    bootstrap()
      .then((nextCleanup) => {
        cleanup = nextCleanup;
      })
      .catch(() => {
        if (!disposed) {
          pushStatus(i18n.t('events.failedConfig'));
        }
      });

    return () => {
      if (playingTimeoutRef.current !== null) {
        window.clearTimeout(playingTimeoutRef.current);
      }
      disposed = true;
      cleanup?.();
    };
  }, [initAudio, preloadAudio, pushStatus, syncConfig]);

  useEffect(() => {
    const onKey = async (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toUpperCase() === 'D') {
        event.preventDefault();
        try {
          const current = await window.electronAPI.getLogSettings();
          const order: Array<'error' | 'warn' | 'info' | 'debug'> = ['error', 'warn', 'info', 'debug'];
          const idx = order.indexOf(current.level as never);
          const next = order[(idx + 1) % order.length];
          await window.electronAPI.setLogSettings({ level: next });
          pushStatus(i18n.t('events.logLevel', { level: next }));
        } catch {
          // ignore
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditable = target
        ? target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
        : null;
      const hasOpenModal = hotkeyIndex !== null;
      const isPlainSpace =
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === ' ' || event.code === 'Space');

      const currentConfig = configRef.current;
      if (currentConfig && !isEditable && !hasOpenModal) {
        const accelerator = acceleratorFromKeyboardEvent(event);
        if (accelerator) {
          const match = currentConfig.hotkeys[accelerator];
          if (match !== undefined) {
            event.preventDefault();
            lastLocalHotkeyRef.current = { index: match, at: performance.now() };
            void triggerIndex(match);
            return;
          }
        }
      }

      if (isPlainSpace && !isEditable && !hasOpenModal) {
        event.preventDefault();
        stopAllAudio();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hotkeyIndex, pushStatus, stopAllAudio, triggerIndex]);

  useEffect(() => {
    window.electronAPI.setHotkeysEnabled(hotkeyIndex === null);
  }, [hotkeyIndex]);

  useEffect(() => {
    return () => window.electronAPI.setHotkeysEnabled(true);
  }, []);

  useEffect(() => {
    triggerIndexRef.current = (index: number) => {
      void triggerIndex(index);
    };
  }, [triggerIndex]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.context-menu')) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (!config || selectedIndex === null) return false;
    const button = config.buttons[selectedIndex];
    return (
      draft.label !== button.label ||
      draft.filePath !== button.path ||
      clampGain(draft.gain) !== clampGain(button.gain)
    );
  }, [config, draft, selectedIndex]);

  const outputDeviceLabel = useMemo(() => {
    if (!config?.outputDeviceId) return i18n.t('inspector.defaultOutputDevice');
    return audioOutputs.find((device) => device.deviceId === config.outputDeviceId)?.label || i18n.t('inspector.selectedOutputDevice');
  }, [audioOutputs, config?.outputDeviceId]);

  const selectedButton = selectedIndex !== null && config ? config.buttons[selectedIndex] : null;

  return {
    config,
    status,
    events,
    ctxMenu,
    hotkeyIndex,
    showSettings,
    selectedIndex,
    playingIndex,
    recentAudio,
    draft,
    audioOutputs,
    cueLoadState,
    hasUnsavedChanges,
    outputDeviceLabel,
    selectedButton,
    assignedHotkey,
    selectIndex,
    setDraft,
    setCtxMenu,
    setHotkeyIndex,
    toggleSettings,
    setSelectedIndex,
    stopAllAudio,
    onOutputChange,
    onContextMenu,
    handleDropAudio,
    chooseFileForSelectedCue,
    saveSelectedCue,
    clearSelectedHotkey,
    triggerIndex,
    assignRecentToSelected,
    clearButton,
    assignAudio,
    setHotkey
  };
}
