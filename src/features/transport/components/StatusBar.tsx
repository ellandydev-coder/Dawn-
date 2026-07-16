// src/features/transport/components/StatusBar.tsx
import { useAppSelector } from '@state/store';
import { Icon } from '@shared/components/Icon';

export function StatusBar() {
  const tracks = useAppSelector((s) => s.tracks.allIds.length);
  const assets = useAppSelector((s) => s.assets.allIds.length);
  const transport = useAppSelector((s) => s.transport);
  const sampleRate = useAppSelector((s) => s.project.current.sampleRate);

  return (
    <div className="statusbar">
      <div className="status-item">
        <span className="status-dot online" />
        <span>Audio Engine</span>
      </div>
      <div className="status-item mono">{sampleRate / 1000} kHz</div>
      <div className="status-item mono">Buffer: 512</div>
      <div className="status-sep" />
      <div className="status-item">
        <Icon name="music" size={12} /> {tracks} pistas
      </div>
      <div className="status-item">
        <Icon name="folder" size={12} /> {assets} assets
      </div>
      <div className="status-flex" />
      <div className="status-item mono">
        {transport.isPlaying
          ? '▶ PLAYING'
          : transport.isRecording
            ? '● REC'
            : '■ STOPPED'}
      </div>
      <div className="status-item mono">CPU 3%</div>
    </div>
  );
}