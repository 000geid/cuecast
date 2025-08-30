// Local type copies to avoid ESM/CJS module wrapper in renderer build
// This prevents 'exports is not defined' when loaded via <script> tag.
interface ButtonConfig {
  label: string;
  path: string | null;
  gain: number;
}
interface AppConfig {
  buttons: ButtonConfig[];
  hotkeys: { [key: string]: number };
  outputDeviceId: string | null;
}

class CueCast {
  private config: AppConfig | null = null;
  private audioContext: AudioContext | null = null;
  private audioBuffers = new Map<string, AudioBuffer>();
  private currentButtonIndex: number | null = null;
  private hotkeyCapture: string | null = null;
  private gainNode: GainNode | null = null;
  private outputDestination: MediaStreamAudioDestinationNode | null = null;
  private outputElement: HTMLAudioElement | null = null;
  
  constructor() {
    this.initializeApp();
  }
  
  private async initializeApp(): Promise<void> {
    try {
      window.electronAPI.log('info', 'Renderer initializing');
      this.config = await window.electronAPI.getConfig();
      window.electronAPI.log('debug', 'Config received in renderer', { buttons: this.config.buttons.length });
      this.setupUI();
      this.setupEventListeners();
      this.setupAudioContext();
      await this.loadAudioDevices();
      
      console.log('CueCast initialized successfully');
      this.updateStatus('Ready');
    } catch (error) {
      console.error('Error initializing app:', error);
      this.updateStatus('Error during initialization');
    }
  }
  
  private setupUI(): void {
    if (!this.config) return;
    
    const buttonGrid = document.getElementById('button-grid')!;
    buttonGrid.innerHTML = '';
    
    this.config.buttons.forEach((button, index) => {
      const buttonElement = this.createButtonElement(button, index);
      buttonGrid.appendChild(buttonElement);
    });
    
    if (this.config.outputDeviceId) {
      const deviceSelect = document.getElementById('output-device') as HTMLSelectElement;
      deviceSelect.value = this.config.outputDeviceId;
    }
  }
  
  private createButtonElement(button: ButtonConfig, index: number): HTMLDivElement {
    if (!this.config) throw new Error('Config not initialized');
    
    const buttonEl = document.createElement('div');
    buttonEl.className = `sound-button ${button.path ? '' : 'empty'}`;
    buttonEl.dataset.index = index.toString();
    buttonEl.tabIndex = 0;
    
    const labelEl = document.createElement('div');
    labelEl.className = 'button-label';
    labelEl.textContent = button.label;
    
    const hotkeyEl = document.createElement('div');
    hotkeyEl.className = 'button-hotkey';
    
    const hotkey = Object.keys(this.config.hotkeys).find(
      key => this.config!.hotkeys[key] === index
    );
    hotkeyEl.textContent = hotkey || '';
    
    buttonEl.appendChild(labelEl);
    buttonEl.appendChild(hotkeyEl);
    
    return buttonEl;
  }
  
  private setupEventListeners(): void {
    const buttonGrid = document.getElementById('button-grid')!;
    
    buttonGrid.addEventListener('click', (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest('.sound-button') as HTMLDivElement;
      if (button) {
        const index = parseInt(button.dataset.index!);
        const cfg = this.config?.buttons[index];
        window.electronAPI.log('debug', 'Button click', { index, hasPath: !!cfg?.path });
        console.log('[renderer] Button click', { index, hasPath: !!cfg?.path });
        if (!cfg || !cfg.path) {
          this.openAssignDialog(index);
        } else {
          this.triggerSound(index);
        }
      }
    });
    
    buttonGrid.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const button = (e.target as HTMLElement).closest('.sound-button') as HTMLDivElement;
      if (button) {
        const index = parseInt(button.dataset.index!);
        this.showContextMenu(e.clientX, e.clientY, index);
      }
    });
    
    buttonGrid.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const button = (e.target as HTMLElement).closest('.sound-button') as HTMLDivElement;
        if (button) {
          const index = parseInt(button.dataset.index!);
          const cfg = this.config?.buttons[index];
          window.electronAPI.log('debug', 'Button keydown', { key: e.key, index, hasPath: !!cfg?.path });
          console.log('[renderer] Button keydown', { key: e.key, index, hasPath: !!cfg?.path });
          if (!cfg || !cfg.path) {
            this.openAssignDialog(index);
          } else {
            this.triggerSound(index);
          }
        }
      }
    });
    
    buttonGrid.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      const button = (e.target as HTMLElement).closest('.sound-button') as HTMLDivElement;
      if (button) {
        button.classList.add('drag-over');
      }
    });
    
    buttonGrid.addEventListener('dragleave', (e: DragEvent) => {
      const button = (e.target as HTMLElement).closest('.sound-button') as HTMLDivElement;
      if (button) {
        button.classList.remove('drag-over');
      }
    });
    
    buttonGrid.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const button = (e.target as HTMLElement).closest('.sound-button') as HTMLDivElement;
      if (button) {
        button.classList.remove('drag-over');
        const index = parseInt(button.dataset.index!);
        this.handleFileDrop(e, index);
      }
    });
    
    document.addEventListener('click', (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.context-menu')) {
        this.hideContextMenu();
      }
    });
    
    document.getElementById('context-menu')!.addEventListener('click', (e: MouseEvent) => {
      const action = (e.target as HTMLElement).dataset.action;
      if (action && this.currentButtonIndex !== null) {
        this.handleContextAction(action, this.currentButtonIndex);
      }
      this.hideContextMenu();
    });
    
    document.getElementById('output-device')!.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      this.setOutputDevice(target.value);
    });
    
    window.electronAPI.onTriggerButton((buttonIndex: number) => {
      this.triggerSound(buttonIndex);
    });
    
    this.setupHotkeyModal();
  }
  
  private setupHotkeyModal(): void {
    const modal = document.getElementById('hotkey-modal')!;
    const cancelBtn = document.getElementById('hotkey-cancel')!;
    const saveBtn = document.getElementById('hotkey-save')! as HTMLButtonElement;
    const display = document.getElementById('hotkey-display')!;
    
    cancelBtn.addEventListener('click', () => {
      this.hideHotkeyModal();
    });
    
    saveBtn.addEventListener('click', () => {
      if (this.hotkeyCapture && this.currentButtonIndex !== null) {
        this.setHotkey(this.currentButtonIndex, this.hotkeyCapture);
      }
      this.hideHotkeyModal();
    });
    
    modal.addEventListener('keydown', (e: KeyboardEvent) => {
      if (modal.classList.contains('hidden')) return;
      
      e.preventDefault();
      
      if (e.key === 'Escape') {
        this.hideHotkeyModal();
        return;
      }
      
      const modifiers: string[] = [];
      if (e.ctrlKey || e.metaKey) modifiers.push(e.ctrlKey ? 'Ctrl' : 'Cmd');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      
      if (e.key && !['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
        const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        if (modifiers.length > 0) {
          this.hotkeyCapture = `${modifiers.join('+')}+${key}`;
          display.textContent = this.hotkeyCapture;
          saveBtn.disabled = false;
        }
      }
    });
  }
  
  private setupAudioContext(): void {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
    
    // Create the main gain and route to a MediaStream destination
    this.gainNode = this.audioContext.createGain();
    this.outputDestination = this.audioContext.createMediaStreamDestination();
    this.gainNode.connect(this.outputDestination);

    // Create a hidden audio element to control the output sink
    this.outputElement = document.createElement('audio');
    this.outputElement.style.display = 'none';
    this.outputElement.autoplay = true;
    this.outputElement.muted = false;
    // Attach the stream from the destination
    this.outputElement.srcObject = this.outputDestination.stream;
    document.body.appendChild(this.outputElement);
    // Best-effort play; may be resumed on first user interaction
    this.outputElement.play().catch(() => {/* will resume on first gesture */});

    // If a device was previously selected, try applying it now
    if (this.config?.outputDeviceId && (this.outputElement as any).setSinkId) {
      (this.outputElement as any).setSinkId(this.config.outputDeviceId).catch(() => {
        // Fallback to default if applying fails
        this.updateStatus('Could not set output device, using default');
      });
    }
  }
  
  private async triggerSound(index: number): Promise<void> {
    if (!this.config || !this.audioContext || !this.gainNode) return;

    const button = this.config.buttons[index];
    if (!button || !button.path) {
      console.log(`Button ${index + 1} has no audio assigned`);
      return;
    }

    try {
      console.log('[renderer] triggerSound', { index, label: button.label, path: button.path });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      let audioBuffer = this.audioBuffers.get(button.path);
      if (!audioBuffer) {
        audioBuffer = await this.loadAudioFile(button.path);
        this.audioBuffers.set(button.path, audioBuffer);
      }
      
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.value = button.gain || 1.0;
      
      source.connect(gainNode);
      gainNode.connect(this.gainNode);
      
      source.start(0);
      
      this.updateStatus(`Playing: ${button.label}`);
      setTimeout(() => this.updateStatus('Ready'), 1000);
      
    } catch (error) {
      console.error('Error playing sound:', error);
      this.updateStatus('Error playing audio');
    }
  }
  
  private async loadAudioFile(filePath: string): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('Audio context not initialized');
    
    const response = await fetch(`file://${filePath}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }
  
  private async handleFileDrop(event: DragEvent, buttonIndex: number): Promise<void> {
    if (!event.dataTransfer) return;
    
    const files = Array.from(event.dataTransfer.files);
    const audioFile = files.find((file: File) => 
      ['wav', 'mp3', 'ogg', 'flac'].includes(file.name.split('.').pop()?.toLowerCase() || '')
    );
    
    if (audioFile) {
      await this.assignAudioFile(buttonIndex, audioFile.path);
    } else {
      this.updateStatus('Invalid file type. Use .wav, .mp3, .ogg, or .flac');
    }
  }
  
  private async assignAudioFile(buttonIndex: number, filePath: string): Promise<void> {
    if (!this.config) return;
    
    try {
      window.electronAPI.log('info', 'Assigning audio file', { buttonIndex, filePath });
      console.log('[renderer] Assigning audio file', { buttonIndex, filePath });
      const fileName = filePath.split('/').pop()?.split('.')[0] || 'Unknown';
      
      this.config.buttons[buttonIndex] = {
        ...this.config.buttons[buttonIndex],
        label: fileName,
        path: filePath
      };
      
      await window.electronAPI.updateConfig(this.config);
      this.audioBuffers.delete(filePath);
      this.setupUI();
      
      this.updateStatus(`Assigned: ${fileName}`);
      console.log('[renderer] Assigned', { buttonIndex, fileName });
    } catch (error) {
      console.error('Error assigning audio file:', error);
      this.updateStatus('Error assigning file');
    }
  }

  private async openAssignDialog(buttonIndex: number): Promise<void> {
    try {
      window.electronAPI.log('debug', 'Opening assign dialog', { buttonIndex });
      console.log('[renderer] Opening assign dialog', { buttonIndex });
      const filePath = await window.electronAPI.selectAudioFile();
      window.electronAPI.log('debug', 'Assign dialog result', { buttonIndex, chosen: !!filePath });
      console.log('[renderer] Assign dialog result', { buttonIndex, chosen: !!filePath, filePath });
      if (filePath) {
        await this.assignAudioFile(buttonIndex, filePath);
      } else {
        this.updateStatus('Assignment canceled');
      }
    } catch (error) {
      console.error('Error selecting audio file:', error);
      this.updateStatus('Error selecting file');
    }
  }
  
  private showContextMenu(x: number, y: number, buttonIndex: number): void {
    this.currentButtonIndex = buttonIndex;
    const contextMenu = document.getElementById('context-menu')!;
    
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');
    
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      contextMenu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      contextMenu.style.top = `${y - rect.height}px`;
    }
  }
  
  private hideContextMenu(): void {
    document.getElementById('context-menu')!.classList.add('hidden');
    this.currentButtonIndex = null;
  }
  
  private async handleContextAction(action: string, buttonIndex: number): Promise<void> {
    if (!this.config) return;
    
    switch (action) {
      case 'assign':
        const filePath = await window.electronAPI.selectAudioFile();
        if (filePath) {
          await this.assignAudioFile(buttonIndex, filePath);
        }
        break;
        
      case 'clear':
        this.config.buttons[buttonIndex] = {
          label: 'Empty',
          path: null,
          gain: 1.0
        };
        
        const hotkey = Object.keys(this.config.hotkeys).find(
          key => this.config!.hotkeys[key] === buttonIndex
        );
        if (hotkey) {
          delete this.config.hotkeys[hotkey];
        }
        
        await window.electronAPI.updateConfig(this.config);
        this.setupUI();
        this.updateStatus('Button cleared');
        break;
        
      case 'set-hotkey':
        this.showHotkeyModal(buttonIndex);
        break;
    }
  }
  
  private showHotkeyModal(buttonIndex: number): void {
    this.currentButtonIndex = buttonIndex;
    this.hotkeyCapture = null;
    
    document.getElementById('hotkey-display')!.textContent = 'Press keys...';
    (document.getElementById('hotkey-save')! as HTMLButtonElement).disabled = true;
    document.getElementById('hotkey-modal')!.classList.remove('hidden');
    document.getElementById('hotkey-modal')!.focus();
  }
  
  private hideHotkeyModal(): void {
    document.getElementById('hotkey-modal')!.classList.add('hidden');
    this.currentButtonIndex = null;
    this.hotkeyCapture = null;
  }
  
  private async setHotkey(buttonIndex: number, accelerator: string): Promise<void> {
    if (!this.config) return;
    
    const existingIndex = this.config.hotkeys[accelerator];
    if (existingIndex !== undefined && existingIndex !== buttonIndex) {
      this.updateStatus('Hotkey already in use');
      return;
    }
    
    Object.keys(this.config.hotkeys).forEach(key => {
      if (this.config!.hotkeys[key] === buttonIndex) {
        delete this.config!.hotkeys[key];
      }
    });
    
    this.config.hotkeys[accelerator] = buttonIndex;
    await window.electronAPI.updateConfig(this.config);
    this.setupUI();
    this.updateStatus(`Hotkey set: ${accelerator}`);
  }
  
  private async loadAudioDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      
      const deviceSelect = document.getElementById('output-device')! as HTMLSelectElement;
      deviceSelect.innerHTML = '<option value="">Default Output</option>';
      
      audioOutputs.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Audio Device ${device.deviceId.slice(0, 8)}`;
        deviceSelect.appendChild(option);
      });

      // Re-apply saved selection after options are populated
      if (this.config?.outputDeviceId) {
        deviceSelect.value = this.config.outputDeviceId;
      }
      
    } catch (error) {
      console.warn('Could not enumerate audio devices:', error);
    }
  }
  
  private async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.config) return;
    
    this.config.outputDeviceId = deviceId || null;
    await window.electronAPI.updateConfig(this.config);
    // Try to switch the output sink on the fly
    if (this.outputElement && (this.outputElement as any).setSinkId) {
      try {
        await (this.outputElement as any).setSinkId(this.config.outputDeviceId || '');
        this.updateStatus(deviceId ? 'Output device changed' : 'Using default output');
      } catch (err) {
        console.warn('Failed to set sinkId:', err);
        this.updateStatus('Could not change output device');
      }
    } else {
      this.updateStatus('Output selection not supported');
    }
  }
  
  private updateStatus(message: string): void {
    const statusEl = document.querySelector('.status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CueCast();
});
