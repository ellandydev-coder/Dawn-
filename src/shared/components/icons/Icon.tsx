// src/shared/components/icons/Icon.tsx

import type { IconProps } from './types';
import { resolveIcon } from './registry';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Props del componente <Icon> genérico.
 *
 * `name` es cualquier string:
 *   • Id canónico jerárquico: "transport.play", "mixer.volume-mute"
 *   • Alias: "play", "volume-mute" (si el icono lo declara)
 *
 * Para autocompletado usa el helper IconIds:
 *   <Icon name={IconIds.transport.play} />
 */
export interface DynamicIconProps extends IconProps {
  /** Nombre del icono (id canónico o alias) */
  name: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * Icon
 * ----
 * Componente genérico que renderiza un icono SVG por nombre.
 *
 * Resuelve el nombre usando el registry auto-poblado en bootstrap:
 *   1. Busca match exacto por id canónico (ej: "transport.play")
 *   2. Si no lo encuentra, busca en aliases (ej: "play")
 *   3. Si no lo encuentra, loguea warning en dev y renderiza null
 *
 * @example
 *   <Icon name="transport.play" size={16} />
 *   <Icon name="play" size={16} />                    ← alias
 *   <Icon name={IconIds.mixer.volumeMute} size={16} />  ← autocompletado
 */
export function Icon({ name, ...props }: DynamicIconProps) {
  const entry = resolveIcon(name);

  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Icon] Icono desconocido: "${name}". ` +
        `¿Falta el export "registration" en el archivo del icono?`
      );
    }
    return null;
  }

  const IconComponent = entry.component;
  return <IconComponent {...props} />;
}