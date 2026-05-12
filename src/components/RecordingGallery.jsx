import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import styles from './RecordingGallery.module.css';

const Icon = {
  Play: () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>,
  Calendar: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Video: () => <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
};

function VideoPlayer({ url, filename }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHls = filename.endsWith('.m3u8') || filename.endsWith('.ts');

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          xhrSetup: (xhr) => {
             // Ensure proxy requests are clean
             xhr.withCredentials = false;
          }
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error("HLS Error:", data.type, data.details);
            setError(`Playback issue (${data.details}). Try refreshing.`);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      } else {
        setError("Your browser lacks HLS support.");
      }
    } else {
      video.src = url;
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [url, filename]);

  if (error) {
    return (
      <div className={styles.video} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#666', fontSize: '12px', padding: '20px', textAlign: 'center'}}>
        {error}
      </div>
    );
  }

  return (
    <video 
      ref={videoRef}
      controls 
      className={styles.video}
      playsInline
      autoPlay
    />
  );
}

export default function RecordingGallery({ onBack }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const [confirmingSid, setConfirmingSid] = useState(null);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recordings');
      if (!res.ok) throw new Error('Could not connect to cloud library');
      const data = await res.json();
      setRecordings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, sid) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/recordings/${sid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setRecordings(prev => prev.filter(r => r.sid !== sid));
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirmingSid(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.loader}></div>
      <span style={{color: '#D4AF37', letterSpacing: '4px', textTransform: 'uppercase', fontSize: '10px', fontWeight: 800}}>Luxe Vault</span>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.bgGlow}></div>
      
      <header className={styles.header}>
        <div className={styles.titleGrp}>
          <h1>Cloud Library</h1>
          <p className={styles.subtitle}>{recordings.length} Premium Recordings</p>
        </div>
        <button className={styles.backBtn} onClick={onBack}>Return Home</button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        {recordings.map((rec) => (
          <div key={rec.sid} className={styles.card} onClick={() => setSelectedSession(rec)}>
            <div className={styles.cardThumb}>
              <Icon.Video />
              <div className={styles.playOverlay}><Icon.Play /></div>
              <span className={`${styles.modeBadge} ${styles['mode' + rec.mode.charAt(0).toUpperCase() + rec.mode.slice(1)]}`}>
                {rec.mode}
              </span>
            </div>
            
            <div className={styles.cardContent}>
              <h3 className={styles.channelName}>{rec.channelName}</h3>
              <div className={styles.cardMeta}>
                <div className={styles.metaItem}>
                  <Icon.Calendar />
                  <span>{formatDate(rec.timestamp)}</span>
                </div>
                <div style={{ position: 'relative', zIndex: 100 }}>
                  {confirmingSid === rec.sid ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={styles.deleteBtn} 
                        style={{ background: '#e74c3c', color: '#fff', width: 'auto', padding: '0 12px', fontSize: '10px' }}
                        onClick={(e) => handleDelete(e, rec.sid)}
                      >
                        Confirm?
                      </button>
                      <button 
                        className={styles.deleteBtn} 
                        style={{ width: 'auto', padding: '0 12px', fontSize: '10px' }}
                        onClick={(e) => { e.stopPropagation(); setConfirmingSid(null); }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); setConfirmingSid(rec.sid); }}>
                      <Icon.Trash />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {recordings.length === 0 && (
          <div className={styles.empty}>
            <Icon.Video />
            <h3>No recordings yet.</h3>
          </div>
        )}
      </div>

      {selectedSession && (
        <div className={styles.overlay} onClick={() => setSelectedSession(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div>
                <h2>{selectedSession.channelName} session</h2>
                <span className={styles.modalDate}>{formatDate(selectedSession.timestamp)}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedSession(null)}>&times;</button>
            </header>

            <div className={styles.playerBody}>
              <div className={styles.playerGrid}>
                {(() => {
                  const files = selectedSession.files;
                  let displayFiles = [];
                  
                  if (selectedSession.mode === 'individual') {
                    // Show ONLY the "Master" video/av playlists for each participant
                    // We ignore playlists that have numeric suffixes like _0.m3u8 or _1.m3u8
                    // which are internal segment playlists.
                    displayFiles = files.filter(f => {
                      const name = f.filename;
                      if (!name.endsWith('.m3u8')) return false;
                      if (name.includes('audio')) return false;
                      
                      // Regex to detect the internal segment playlists (e.g. _123456789_0.m3u8)
                      const isInternal = /_\d+_\d\.m3u8$/.test(name);
                      return !isInternal;
                    });

                    if (displayFiles.length === 0) {
                      displayFiles = files.filter(f => f.filename.endsWith('.mp4'));
                    }
                  } else if (selectedSession.mode === 'web') {
                    // For Web, we want the "av.m3u8" or the "mp4"
                    const hasMp4 = files.some(f => f.filename.endsWith('.mp4'));
                    if (hasMp4) {
                      displayFiles = files.filter(f => f.filename.endsWith('.mp4'));
                    } else {
                      displayFiles = files.filter(f => {
                        const name = f.filename;
                        if (!name.endsWith('.m3u8')) return false;
                        const isInternal = /_\d+_\d\.m3u8$/.test(name);
                        return !isInternal && (name.includes('av') || name.includes('video'));
                      });
                    }
                  } else {
                    // For Mix, priority is MP4 > M3U8
                    const hasMp4 = files.some(f => f.filename.endsWith('.mp4'));
                    if (hasMp4) {
                      displayFiles = files.filter(f => f.filename.endsWith('.mp4'));
                    } else {
                      displayFiles = files.filter(f => {
                        const name = f.filename;
                        if (!name.endsWith('.m3u8')) return false;
                        const isInternal = /_\d+_\d\.m3u8$/.test(name);
                        return !isInternal;
                      });
                    }
                  }

                  return displayFiles.map((file, idx) => {
                    const isM3u8 = file.filename.endsWith('.m3u8');
                    // Ensure the proxy URL uses the current domain to avoid CORS
                    const playerUrl = isM3u8 ? `/api/playlist?key=${encodeURIComponent(file.key)}` : file.url;
                    
                    return (
                      <div key={idx} className={styles.videoContainer}>
                        <VideoPlayer url={playerUrl} filename={file.filename} />
                        <div className={styles.videoLabel}>
                          <span>{selectedSession.mode === 'individual' ? `Participant ${idx + 1}` : 'Playback'}</span>
                          <span style={{opacity: 0.5}}>{isM3u8 ? 'HLS' : 'MP4'}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
