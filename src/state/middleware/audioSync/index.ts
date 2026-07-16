// src/state/middleware/audioSync/index.ts

import { createListenerMiddleware } from '@reduxjs/toolkit';

import type { AppStartListening } from './types';
import { registerTracksHandlers } from './handlers/tracksHandlers';
import { registerMixerHandlers } from './handlers/mixerHandlers';
import { registerTransportHandlers } from './handlers/transportHandlers';
import { registerProjectHandlers } from './handlers/projectHandlers';
import { registerMetronomeHandlers } from './handlers/metronomeHandlers';
import { registerRecordingHandlers } from './handlers/recordingHandlers';
import { registerMonitoringHandlers } from './handlers/monitoringHandlers';

export const audioSyncMiddleware = createListenerMiddleware();

const startAppListening =
  audioSyncMiddleware.startListening as AppStartListening;

registerTracksHandlers(startAppListening);
registerMixerHandlers(startAppListening);
registerTransportHandlers(startAppListening);
registerProjectHandlers(startAppListening);
registerMetronomeHandlers(startAppListening);
registerRecordingHandlers(startAppListening);
registerMonitoringHandlers(startAppListening);

export {
  getMetronome,
  disposeMetronome,
  metronome,
} from '@audio/metronome/MetronomeSingleton';