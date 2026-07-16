// src/features/transport/components/InputDeviceSelector.tsx
//
// Botón icono 🎙️ + menú flotante con la lista de dispositivos.
// El menú se renderiza vía Portal para escapar del overflow del TopBar.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@shared/components/Icon';
import { useAppDispatch, useAppSelector } from '@state/store';
import { setMonitoringEnabled } from '@state/slices/recording/recordingSlice';
import { createPortal } from 'react-dom';
import { useMicDevices } from '../hooks/useMicDevices';

import './InputDeviceSelector.css';

const DEFAULT_DEVICE_LABEL = 'Micrófono por defecto del sistema';
const MONITORING_TOOLTIP = 'Usa auriculares para evitar feedback';

interface MenuPosition {
  top: number;
  left: number;
}

export function InputDeviceSelector() {
  const dispatch = useAppDispatch();
  const monitoringEnabled = useAppSelector((s) => s.recording.monitoringEnabled);
  const { devices, selectedDeviceId, selectDevice } = useMicDevices();

  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (deviceId: string | null) => {
      selectDevice(deviceId);
      setIsOpen(false);
    },
    [selectDevice]
  );

  const handleToggleMonitoring = useCallback(() => {
    dispatch(setMonitoringEnabled(!monitoringEnabled));
    setIsOpen(false);
  }, [dispatch, monitoringEnabled]);

  // Calcular posición del menú justo debajo del trigger (viewport coords)
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, [isOpen]);

  // Reposicionar en scroll/resize mientras esté abierto
  useEffect(() => {
    if (!isOpen) return;

    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        left: rect.left,
      });
    };

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen]);

  // Cerrar al hacer click fuera + Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const triggerHit = triggerRef.current?.contains(target);
      const menuHit = menuRef.current?.contains(target);
      if (!triggerHit && !menuHit) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Label del dispositivo activo (tooltip)
  const activeLabel = selectedDeviceId
    ? devices.find((d) => d.deviceId === selectedDeviceId)?.label ?? 'Desconocido'
    : DEFAULT_DEVICE_LABEL;

  const menu =
    isOpen && menuPos ? (
      <div
        ref={menuRef}
        className="ids-menu"
        role="menu"
        style={{
          top: menuPos.top,
          left: menuPos.left,
        }}
      >
        <div className="ids-menu-header">Entrada de audio</div>

        <button
          className={`ids-item${monitoringEnabled ? ' is-selected' : ''}`}
          onClick={handleToggleMonitoring}
          role="menuitemcheckbox"
          aria-checked={monitoringEnabled}
          title={MONITORING_TOOLTIP}
        >
          <span className="ids-check" aria-hidden="true">
            {monitoringEnabled ? '✓' : ''}
          </span>
          <span className="ids-label">🎧 Monitor input</span>
        </button>

        <div className="ids-divider" aria-hidden="true" />

        <button
          className={`ids-item${selectedDeviceId === null ? ' is-selected' : ''}`}
          onClick={() => handleSelect(null)}
          role="menuitemradio"
          aria-checked={selectedDeviceId === null}
        >
          <span className="ids-check" aria-hidden="true">
            {selectedDeviceId === null ? '✓' : ''}
          </span>
          <span className="ids-label">{DEFAULT_DEVICE_LABEL}</span>
        </button>

        {devices.length > 0 && (
          <div className="ids-divider" aria-hidden="true" />
        )}

        {devices.map((device) => (
          <button
            key={device.deviceId}
            className={`ids-item${
              selectedDeviceId === device.deviceId ? ' is-selected' : ''
            }`}
            onClick={() => handleSelect(device.deviceId)}
            role="menuitemradio"
            aria-checked={selectedDeviceId === device.deviceId}
            title={device.label}
          >
            <span className="ids-check" aria-hidden="true">
              {selectedDeviceId === device.deviceId ? '✓' : ''}
            </span>
            <span className="ids-label">{device.label}</span>
          </button>
        ))}

        {devices.length === 0 && (
          <div className="ids-empty">
            No se detectaron micrófonos.
            <br />
            <small>Concede permiso al grabar por primera vez.</small>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="ids-root">
      <button
        ref={triggerRef}
        className={`tb-icon-btn ids-trigger${isOpen ? ' is-open' : ''}`}
        onClick={toggleOpen}
        title={`Entrada de audio: ${activeLabel}`}
        aria-label="Seleccionar dispositivo de entrada"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Icon name="mic" size={16} />
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}