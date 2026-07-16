// src/features/preferences/panels/vst/index.ts

import { createDefaultVstPreferences } from '@domain/models/preferences/VstPreferences';
import type { PreferencePanelEntry } from '@features/preferences/registry';
import { VstPanel } from './VstPanel';

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

/*
 * Este archivo se descubre automáticamente por el bootstrap del
 * registry de Preferences (Vite glob eager sobre panels[dir]/index.ts).
 *
 * NO se importa manualmente desde ningún otro sitio. Basta con
 * exportar `registration` con la forma correcta y el panel aparece
 * en el sidebar + queda enrutado en el content.
 *
 * ─── Convenciones ────────────────────────────────────────────
 *   id           → jerárquico separado por punto ("plugins.vst")
 *   parentId     → id del padre; si no existe, se convierte en raíz
 *   order        → posición dentro del grupo (menor = arriba)
 *   component    → panel React que se renderiza al seleccionar
 *   defaults     → factory de estado inicial (se hidrata en el store)
 *
 * ─── Nota sobre el estado ────────────────────────────────────
 *   Este panel usa el slice `preferencesSlice.vst` que ya existe
 *   (creado antes del refactor de auto-registry). En el Lote 3
 *   migraremos el slice a `preferences.byPanelId[id]` genérico
 *   para completar la extensibilidad. Por ahora `defaults` está
 *   presente para dejar el contrato listo, aunque no se consuma.
 */
export const registration: PreferencePanelEntry = {
  id: 'plugins.vst',
  parentId: 'plugins',
  label: 'VST',
  description: 'Configuración de plugins VST y VST3',
  order: 20,
  component: VstPanel,
  defaults: createDefaultVstPreferences,
};