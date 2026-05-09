import React from 'react';
import { ContextMenu } from './components/ContextMenu';
import { CueDeck } from './components/CueDeck';
import { ControlRail } from './components/ControlRail';
import { HotkeyModal } from './components/HotkeyModal';
import { InspectorPanel } from './components/InspectorPanel';
import { useCuecastController } from './hooks/useCuecastController';

const App: React.FC = () => {
  const controller = useCuecastController();

  if (!controller.config) {
    return null;
  }

  return (
    <div className="app-shell">
      <ControlRail
        audioOutputs={controller.audioOutputs}
        outputDeviceId={controller.config.outputDeviceId}
        status={controller.status}
        onStopAll={controller.stopAllAudio}
        onOutputChange={controller.onOutputChange}
      />

      <main className="workspace-shell">
        <CueDeck
          buttons={controller.config.buttons}
          selectedIndex={controller.selectedIndex}
          playingIndex={controller.playingIndex}
          loadStateFor={controller.cueLoadState}
          assignedHotkey={controller.assignedHotkey}
          onTrigger={(index) => {
            void controller.triggerIndex(index);
          }}
          onSelect={controller.selectIndex}
          onContextMenu={controller.onContextMenu}
          onDropAudio={(index, dataTransfer) => {
            void controller.handleDropAudio(index, dataTransfer);
          }}
        />

        <InspectorPanel
          selectedIndex={controller.selectedIndex}
          selectedButton={controller.selectedButton}
          draft={controller.draft}
          hotkey={controller.selectedIndex !== null ? controller.assignedHotkey(controller.selectedIndex) : ''}
          outputDeviceLabel={controller.outputDeviceLabel}
          status={controller.status}
          events={controller.events}
          recentAudio={controller.recentAudio}
          hasUnsavedChanges={controller.hasUnsavedChanges}
          onClearSelection={() => controller.setSelectedIndex(null)}
          onDraftChange={controller.setDraft}
          onChooseFile={() => {
            void controller.chooseFileForSelectedCue();
          }}
          onSave={() => {
            void controller.saveSelectedCue();
          }}
          onClearButton={() => {
            if (controller.selectedIndex !== null) {
              void controller.clearButton(controller.selectedIndex);
            }
          }}
          onOpenHotkeyModal={() => controller.setHotkeyIndex(controller.selectedIndex)}
          onClearHotkey={() => {
            void controller.clearSelectedHotkey();
          }}
          onTriggerSelected={() => {
            if (controller.selectedIndex !== null) {
              void controller.triggerIndex(controller.selectedIndex);
            }
          }}
          onAssignRecent={(filePath) => {
            controller.assignRecentToSelected(filePath);
          }}
        />
      </main>

      {controller.ctxMenu && (
        <ContextMenu
          x={controller.ctxMenu.x}
          y={controller.ctxMenu.y}
          onAssign={() => {
            controller.setCtxMenu(null);
            void controller.assignAudio(controller.ctxMenu.index);
          }}
          onClear={() => {
            controller.setCtxMenu(null);
            void controller.clearButton(controller.ctxMenu.index);
          }}
          onSetHotkey={() => {
            controller.setCtxMenu(null);
            controller.setHotkeyIndex(controller.ctxMenu.index);
          }}
          onEdit={() => {
            controller.setCtxMenu(null);
            controller.setSelectedIndex(controller.ctxMenu.index);
          }}
        />
      )}

      {controller.hotkeyIndex !== null && (
        <HotkeyModal
          onCancel={() => controller.setHotkeyIndex(null)}
          onSave={async (accelerator) => {
            await controller.setHotkey(controller.hotkeyIndex, accelerator);
            controller.setHotkeyIndex(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
