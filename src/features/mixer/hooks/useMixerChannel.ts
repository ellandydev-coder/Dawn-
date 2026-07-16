// src/features/mixer/hooks/useMixerChannel.ts
// ═══════════════════════════════════════════════════════════════
// 🔄 BRIDGE DE COMPATIBILIDAD
// --------------------------------------------------------------
// Este hook fue movido a src/state/hooks/ porque es lógica de
// Redux, no específica del mixer. Cualquier feature puede usarlo.
//
// ⚠️ Para código NUEVO, prefiere el import directo:
//   import { useMixerChannel } from '@state/hooks/useMixerChannel';
//   import { useMixerChannels } from '@state/hooks/useMixerChannels';
// ═══════════════════════════════════════════════════════════════

export {
  useMixerChannel,
  type MixerChannelHandlers,
  type MixerChannelData,
  type UseMixerChannelOptions,
} from '@state/hooks/useMixerChannel';

export {
  useMixerChannels,
  type MixerChannelsData,
} from '@state/hooks/useMixerChannels';