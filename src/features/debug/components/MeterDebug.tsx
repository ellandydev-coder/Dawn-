import { useMeter } from '@audio/hooks/useMeter';

interface MeterDebugProps {
  id: string;
  label?: string;
}

/**
 * MeterDebug
 * ----------
 * Componente temporal para verificar que el metering funciona.
 * Muestra una barra horizontal con RMS y peak numérico.
 * Bórralo cuando el VU meter real esté listo.
 */
export function MeterDebug({ id, label }: MeterDebugProps) {
  const meter = useMeter(id);

  const rmsPct = Math.min(100, meter.rms * 100);
  const peakHoldPct = Math.min(100, meter.peakHold * 100);
  const peakDb = 20 * Math.log10(meter.peak || 0.00001);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: '#1a1a1a',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#aaa',
      }}
    >
      <span
        style={{
          minWidth: 60,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label ?? id}
      </span>

      <div
        style={{
          flex: 1,
          height: 12,
          background: '#000',
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* RMS (barra principal con gradiente verde→amarillo→rojo) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${rmsPct}%`,
            background: 'linear-gradient(90deg, #4ade80 0%, #4ade80 60%, #facc15 80%, #ef4444 100%)',
            transition: 'width 30ms linear',
          }}
        />

        {/* Peak hold (línea vertical que se queda arriba) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${peakHoldPct}%`,
            width: 2,
            background: meter.clipping ? '#ef4444' : '#fff',
            transition: 'left 60ms linear',
          }}
        />
      </div>

      <span
        style={{
          minWidth: 60,
          textAlign: 'right',
          color: meter.clipping ? '#ef4444' : '#aaa',
        }}
      >
        {peakDb > -60 ? `${peakDb.toFixed(1)} dB` : '-∞ dB'}
      </span>
    </div>
  );
}