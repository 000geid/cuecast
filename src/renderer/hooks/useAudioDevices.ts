import { useEffect, useState } from 'react';

export function useAudioDevices() {
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

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

  return audioOutputs;
}

