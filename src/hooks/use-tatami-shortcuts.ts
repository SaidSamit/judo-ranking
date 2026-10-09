// ==============================================================================
// HOOK DE CAPTURA DE TECLADO (HEMISFERIOS ERGONÓMICOS Y UNDO SELECTIVO)
// ==============================================================================
//
// ¿POR QUÉ ESTA ARQUITECTURA?
// En una mesa de judo, un combate dura 4 minutos con acciones explosivas.
// Un juez de mesa no tiene tiempo de apuntar con el cursor del mouse a un botón
// en pantalla. La división por hemisferios permite que la mano izquierda controle
// al atleta Blanco y la mano derecha al atleta Azul de forma refleja.
//
// ¿CÓMO SE EVITAN INTERFERENCIAS DEL NAVEGADOR?
// 1. e.preventDefault(): Cancela el comportamiento nativo (ej. la barra espaciadora
//    scrollearía la página hacia abajo; ciertas combinaciones activarían búsquedas).
// 2. Filtro de Input Activo: Si el operador está escribiendo en un <input> o
//    <textarea> (por ejemplo, tipificando una sanción), los hotkeys se desactivan
//    automáticamente para no disparar eventos accidentales.
// 3. Normalización de Key: e.key.toLowerCase() garantiza compatibilidad sin
//    importar si Bloq Mayús (Caps Lock) está encendido.
//
// ==============================================================================

'use client';

import { useEffect, useCallback } from 'react';
import { CombatantColor, MatchAction } from '@/types/events';

interface ShortcutMapping {
  action: MatchAction;
  target: CombatantColor | null;
}

// Mapa hemisférico de teclas a acciones
const KEY_MAP: Record<string, ShortcutMapping> = {
  // Hemisferio Izquierdo: Atleta Blanco
  q: { action: 'ADD_IPPON', target: 'WHITE' },
  w: { action: 'ADD_WAZA_ARI', target: 'WHITE' },
  e: { action: 'ADD_YUKO', target: 'WHITE' },
  r: { action: 'ADD_SHIDO', target: 'WHITE' },
  t: { action: 'ADD_HANSOKU_MAKE', target: 'WHITE' }, // Descalificación Directa Blanco
  a: { action: 'START_OSAEKOMI', target: 'WHITE' },

  // Hemisferio Derecho: Atleta Azul
  y: { action: 'ADD_HANSOKU_MAKE', target: 'BLUE' },  // Descalificación Directa Azul
  u: { action: 'ADD_IPPON', target: 'BLUE' },
  i: { action: 'ADD_WAZA_ARI', target: 'BLUE' },
  o: { action: 'ADD_YUKO', target: 'BLUE' },
  p: { action: 'ADD_SHIDO', target: 'BLUE' },
  l: { action: 'START_OSAEKOMI', target: 'BLUE' },
};

export interface UseTatamiShortcutsOptions {
  onAddAction: (action: MatchAction, target: CombatantColor) => void;
  /**
   * Disparado al presionar SHIFT + TECLA.
   * La UI debe buscar el último evento específico de este tipo y marcarlo is_undone.
   */
  onUndoSpecificAction: (action: MatchAction, target: CombatantColor) => void;
  onToggleClock: () => void;
  onStopOsaekomi: () => void;
  onSwapOsaekomi: () => void;
  onDeclareFinish: () => void;
  isEnabled?: boolean;
}

export function useTatamiShortcuts({
  onAddAction,
  onUndoSpecificAction,
  onToggleClock,
  onStopOsaekomi,
  onSwapOsaekomi,
  onDeclareFinish,
  isEnabled = true,
}: UseTatamiShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isEnabled) return;

      // 1. Evitar interferir si el usuario está tipeando en un input o modal
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      const key = e.key.toLowerCase();
      const isShift = e.shiftKey;

      // 2. Control de Reloj Principal: Barra Espaciadora (Hajime! / Mate!)
      if (e.code === 'Space' || key === ' ') {
        e.preventDefault();
        onToggleClock();
        return;
      }

      // 3. Toketa: Cancelar/Detener Osaekomi (Tecla S)
      if (key === 's') {
        e.preventDefault();
        onStopOsaekomi();
        return;
      }

      // 4. Osaekomi Swap: Traspaso de retención al rival manteniendo segundos (Tecla X)
      if (key === 'x') {
        e.preventDefault();
        onSwapOsaekomi();
        return;
      }

      // 5. Cierre consciente del combate (Enter)
      if (e.key === 'Enter') {
        e.preventDefault();
        onDeclareFinish();
        return;
      }

      // 6. Mapeo Hemisférico (Puntos, Faltas y Retenciones)
      const mapping = KEY_MAP[key];
      if (mapping && mapping.target) {
        e.preventDefault();

        if (isShift) {
          // ====================================================================
          // REGLA CRÍTICA: UNDO SELECTIVO POR TECLA (SHIFT + KEY)
          // NO extrae el último evento de la pila general. Dispara la solicitud
          // para anular el último evento activo de ESA acción y ESE atleta.
          // ====================================================================
          onUndoSpecificAction(mapping.action, mapping.target);
        } else {
          // Inserción normal de la acción
          onAddAction(mapping.action, mapping.target);
        }
      }
    },
    [
      isEnabled,
      onAddAction,
      onUndoSpecificAction,
      onToggleClock,
      onStopOsaekomi,
      onSwapOsaekomi,
      onDeclareFinish,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
