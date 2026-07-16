// src/domain/models/PreferenceCategory.ts

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Categoría de preferencias visible en el sidebar izquierdo
 * de la ventana Preferences.
 *
 * Estructura jerárquica:
 *   • Categorías raíz → no tienen `parentId`
 *   • Sub-categorías → tienen `parentId` apuntando a la raíz
 *
 * Ejemplo:
 *   { id: 'audio',        label: 'Audio' }
 *   { id: 'audio.device', label: 'Device',  parentId: 'audio' }
 *   { id: 'audio.midi',   label: 'MIDI',    parentId: 'audio' }
 *
 * La UI se encarga de renderizar el árbol basado en `parentId`.
 * El orden de aparición viene dado por el orden del array del catálogo.
 */
export interface PreferenceCategory {
  /** ID único (kebab.dot.notation recomendada, ej: "audio.device") */
  readonly id: string;

  /** Etiqueta visible en el sidebar */
  readonly label: string;

  /**
   * ID de la categoría padre. Si es undefined, es raíz.
   * Solo se admite 1 nivel de anidación (raíz → hijos), sin nietos.
   */
  readonly parentId?: string;

  /**
   * Descripción corta mostrada en el panel derecho como subtítulo.
   * Opcional; si no se pasa, no se muestra subtítulo.
   */
  readonly description?: string;

  /**
   * Si es `true`, esta categoría todavía no tiene panel real
   * implementado. El PreferencesContent mostrará un placeholder.
   * Default: false (asumimos que hay panel).
   *
   * Útil durante el desarrollo para marcar qué panels están "coming soon".
   */
  readonly placeholder?: boolean;
}

/**
 * Estructura jerárquica derivada del catálogo plano.
 * La construye `buildCategoryTree()` en el catálogo.
 */
export interface PreferenceCategoryNode {
  readonly category: PreferenceCategory;
  readonly children: readonly PreferenceCategoryNode[];
}