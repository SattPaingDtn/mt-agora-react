import { useState, useEffect } from 'react';
import styles from './RecordingGallery.module.css';

const Icon = {
  Play: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  Trash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>,
  Calendar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Box: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Video: () => <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
};

export default function RecordingGallery({ onBack }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recordings');
      if (!res.ok) throw new Error('Failed to fetch recordings');
      const data = await res.json();
      setRecordings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sid) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    
    try {
      const res = await fetch(`/api/recordings/${sid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setRecordings(prev => prev.filter(r => r.sid !== sid));
    } catch (err) {
      alert(err.message);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.loading}>Initializing Premium Gallery...</div>
    </div>
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cloud Recordings</h1>
        <button className={styles.backBtn} onClick={onBack}>← Back to Home</button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {recordings.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><Icon.Video /></span>
          <p>No recordings found in S3 bucket.</p>
          <button className={styles.backBtn} style={{marginTop: '20px'}} onClick={onBack}>Start a Meeting</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {recordings.map((rec) => (
            <div key={rec.sid} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.channelName}>{rec.channelName}</h3>
                  <div className={styles.detailRow}>
                    <Icon.Calendar />
                    <span>{formatDate(rec.timestamp)}</span>
                  </div>
                </div>
                <span className={`${styles.modeBadge} ${styles['mode' + rec.mode.charAt(0).toUpperCase() + rec.mode.slice(1)]}`}>
                  {rec.mode}
                </span>
              </div>

              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <Icon.Box />
                  <span>{formatSize(rec.size)} • {rec.files.length} files</span>
                </div>
                <div style={{fontSize: '0.7rem', opacity: 0.5, marginTop: '4px'}}>SID: {rec.sid.substring(0, 8)}...</div>
              </div>

              <div className={styles.actions}>
                <button className={styles.viewBtn} onClick={() => setSelectedSession(rec)}>
                  View Recording
                </button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(rec.sid)} title="Delete Recording">
                  <Icon.Trash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Overlay */}
      {selectedSession && (
        <div className={styles.overlay}>
          <header className={styles.overlayHeader}>
            <div>
              <h2 className={styles.channelName}>{selectedSession.channelName} - {selectedSession.mode} Recording</h2>
              <p style={{opacity: 0.7}}>{formatDate(selectedSession.timestamp)}</p>
            </div>
            <button className={styles.closeBtn} onClick={() => setSelectedSession(null)}>&times;</button>
          </header>

          <div className={styles.playerContainer}>
            {selectedSession.files.filter(f => f.filename.endsWith('.mp4') || f.filename.endsWith('.webm')).map((file, idx) => (
              <div key={idx} className={`${styles.videoWrapper} ${selectedSession.mode === 'individual' ? styles.videoWrapperIndividual : ''}`}>
                <video 
                  controls 
                  className={styles.video}
                  poster="/placeholder-video.png"
                >
                  <source src={file.url} type={file.filename.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
                  Your browser does not support the video tag.
                </video>
                <div className={styles.videoLabel}>
                  {selectedSession.mode === 'individual' ? `Participant Stream ${idx + 1}` : 'Main Recording'}
                </div>
              </div>
            ))}
            
            {selectedSession.files.filter(f => f.filename.endsWith('.mp4') || f.filename.endsWith('.webm')).length === 0 && (
               <div className={styles.emptyState}>
                 <p>No playable video files found (MP4/WebM).</p>
                 <p style={{fontSize: '0.8rem'}}>Files: {selectedSession.files.map(f => f.filename).join(', ')}</p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
