/**
 * ShortcutManager.ts
 * ------------------
 * Singleton central que gestiona TODOS los atajos de teclado de la DAW.
 *
 * Características:
 *  - Contextos (global, timeline, mixer, piano-roll, browser)
 *  - Prevención automática en inputs (a menos que allowInInputs=true)
 *  - Parser tolerante ("Ctrl+S" == "ctrl+s" == "CTRL + S")
 *  - Un solo listener global (performance)
 *  - DevTools: window.__shortcuts en modo dev
 */

import type {
  ShortcutContext,
  ShortcutDefinition,
  ShortcutInfo,
  UnregisterFn,
} from './shortcutTypes';

class ShortcutManagerImpl {
  private shortcuts = new Map<string, ShortcutDefinition[]>();
  private activeContexts = new Set<ShortcutContext>(['global']);
  private listening = false;
  private idCounter = 0;
  private registry = new Map<number, { key: string; def: ShortcutDefinition }>();

  // ─────────────────────────────────────────────
  // Ciclo de vida
  // ─────────────────────────────────────────────

  start() {
    if (this.listening) return;
    window.addEventListener('keydown', this.onKeyDown, { capture: false });
    this.listening = true;

    // DevTools
    if (typeof window !== 'undefined') {
      (window as any).__shortcuts = {
        list: () => this.list(),
        help: () => this.printHelp(),
        contexts: () => Array.from(this.activeContexts),
      };
    }
  }

  stop() {
    if (!this.listening) return;
    window.removeEventListener('keydown', this.onKeyDown);
    this.listening = false;
  }

  // ─────────────────────────────────────────────
  // Registro
  // ─────────────────────────────────────────────

  register(def: ShortcutDefinition): UnregisterFn {
    const key = this.normalize(def.keys);
    const list = this.shortcuts.get(key) ?? [];
    list.push(def);
    this.shortcuts.set(key, list);

    const id = ++this.idCounter;
    this.registry.set(id, { key, def });

    return () => this.unregister(id);
  }

  private unregister(id: number) {
    const entry = this.registry.get(id);
    if (!entry) return;
    const { key, def } = entry;
    const list = this.shortcuts.get(key);
    if (!list) return;
    const idx = list.indexOf(def);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) this.shortcuts.delete(key);
    this.registry.delete(id);
  }

  // ─────────────────────────────────────────────
  // Contextos activos
  // ─────────────────────────────────────────────

  activateContext(ctx: ShortcutContext) {
    this.activeContexts.add(ctx);
  }

  deactivateContext(ctx: ShortcutContext) {
    if (ctx === 'global') return; // global no se puede desactivar
    this.activeContexts.delete(ctx);
  }

  setContexts(contexts: ShortcutContext[]) {
    this.activeContexts = new Set(['global', ...contexts]);
  }

  isContextActive(ctx: ShortcutContext): boolean {
    return this.activeContexts.has(ctx);
  }

  // ─────────────────────────────────────────────
  // Listener principal
  // ─────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    const key = this.eventToKey(e);
    if (!key) return;

    const candidates = this.shortcuts.get(key);
    if (!candidates || candidates.length === 0) return;

    const inInput = this.isInInput(e);

    // Buscar el mejor candidato (contexto activo)
    for (const def of candidates) {
      if (!this.activeContexts.has(def.context)) continue;
      if (inInput && !def.allowInInputs) continue;

      if (def.preventDefault !== false) {
        e.preventDefault();
      }

      try {
        def.handler(e);
      } catch (err) {
        console.error(`[Shortcut ${def.keys}] error:`, err);
      }
      return; // solo dispara el primero que coincida
    }
  };

  // ─────────────────────────────────────────────
  // Utilidades
  // ─────────────────────────────────────────────

  /** Convierte "Ctrl+S", "ctrl + s", "CTRL+S" -> "ctrl+s" */
  private normalize(combo: string): string {
    const parts = combo
      .toLowerCase()
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean);

    const mods: string[] = [];
    let mainKey = '';

    for (const p of parts) {
      if (p === 'ctrl' || p === 'control') mods.push('ctrl');
      else if (p === 'shift') mods.push('shift');
      else if (p === 'alt' || p === 'option') mods.push('alt');
      else if (p === 'meta' || p === 'cmd' || p === 'command') mods.push('meta');
      else mainKey = p;
    }

    // Orden fijo: ctrl+shift+alt+meta+key
    const order = ['ctrl', 'shift', 'alt', 'meta'];
    const sortedMods = order.filter((m) => mods.includes(m));

    return [...sortedMods, mainKey].join('+');
  }

  /** Convierte un KeyboardEvent al mismo formato normalizado */
  private eventToKey(e: KeyboardEvent): string {
    const mods: string[] = [];
    if (e.ctrlKey) mods.push('ctrl');
    if (e.shiftKey) mods.push('shift');
    if (e.altKey) mods.push('alt');
    if (e.metaKey) mods.push('meta');

    let key = e.key.toLowerCase();

    // Aliases
    if (key === ' ') key = 'space';
    if (key === 'escape') key = 'esc';
    if (key === 'arrowup') key = 'up';
    if (key === 'arrowdown') key = 'down';
    if (key === 'arrowleft') key = 'left';
    if (key === 'arrowright') key = 'right';

    // Ignorar cuando solo se pulsa una tecla modificadora
    if (['control', 'shift', 'alt', 'meta'].includes(key)) return '';

    return [...mods, key].join('+');
  }

  private isInInput(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  // ─────────────────────────────────────────────
  // Introspección (para overlay y devtools)
  // ─────────────────────────────────────────────

  list(): ShortcutInfo[] {
    const out: ShortcutInfo[] = [];
    for (const list of this.shortcuts.values()) {
      for (const def of list) {
        out.push({
          keys: def.keys,
          description: def.description,
          category: def.category,
          context: def.context,
        });
      }
    }
    return out;
  }

  listByCategory(): Record<string, ShortcutInfo[]> {
    const grouped: Record<string, ShortcutInfo[]> = {};
    for (const info of this.list()) {
      grouped[info.category] ??= [];
      grouped[info.category].push(info);
    }
    return grouped;
  }

  private printHelp() {
    const grouped = this.listByCategory();
    console.groupCollapsed('%c⌨ Atajos de teclado', 'color:#4ade80;font-weight:bold');
    for (const [cat, items] of Object.entries(grouped)) {
      console.groupCollapsed(`%c${cat}`, 'color:#60a5fa;font-weight:bold');
      console.table(items.map((i) => ({ Combinación: i.keys, Descripción: i.description })));
      console.groupEnd();
    }
    console.groupEnd();
  }
}

export const shortcutManager = new ShortcutManagerImpl();