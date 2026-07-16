import { audioEngine } from '../../../../audio/engine/AudioEngine';
import { setMonitoringEnabled } from '../../../slices/recording/recordingSlice';
import type { AppStartListening } from '../types';

export function registerMonitoringHandlers(startListening: AppStartListening): void {
  startListening({
    actionCreator: setMonitoringEnabled,
    effect: async (action, api) => {
      const enabled = action.payload;

      if (!enabled) {
        const micRecorder = audioEngine.getMicRecorderSync();
        if (micRecorder) {
          micRecorder.setMonitoring(false);
        }
        return;
      }

      try {
        const micRecorder = await audioEngine.getMicRecorder();
        micRecorder.setMonitoring(true);
      } catch (error) {
        console.error('[monitoringHandlers] Failed to enable input monitoring.', error);
        api.dispatch(setMonitoringEnabled(false));
      }
    },
  });
}


// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

import type { AudioSyncHandlerRegistration } from '../registry';

export const registration: AudioSyncHandlerRegistration = {
  id: 'monitoring',
  register: registerMonitoringHandlers,
};