import React, { useState } from 'react';
import styles from '../PremiumMeetingRoom.module.css';

/**
 * RTMPStreamingModal
 * A premium glassmorphism modal for configuring Media Push.
 */
export default function RTMPStreamingModal({ isOpen, onClose, onStart, isLoading, isReady }) {
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [resolution, setResolution] = useState('720p');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!rtmpUrl || !isReady) return;

    let width = 1280;
    let height = 720;
    let bitrate = 1500;

    if (resolution === '1080p') {
      width = 1920;
      height = 1080;
      bitrate = 3000;
    }

    onStart({ rtmpUrl, width, height, bitrate });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Go Live</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {!isReady && (
            <div className={styles.warningMessage} style={{ color: '#ffcc00', marginBottom: '15px', fontSize: '0.85rem' }}>
              ⚠️ Connecting to meeting room... please wait a moment.
            </div>
          )}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>RTMP URL</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              required
            />
            <small className={styles.formHelp}>
              Paste your streaming server URL and Stream Key here.
            </small>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Stream Quality</label>
            <div className={styles.qualityGrid}>
              <button
                type="button"
                className={`${styles.qualityBtn} ${resolution === '720p' ? styles.qualityBtnActive : ''}`}
                onClick={() => setResolution('720p')}
              >
                <span className={styles.qualityLabel}>HD 720p</span>
                <span className={styles.qualityDetail}>1280x720 • 1.5Mbps</span>
              </button>
              <button
                type="button"
                className={`${styles.qualityBtn} ${resolution === '1080p' ? styles.qualityBtnActive : ''}`}
                onClick={() => setResolution('1080p')}
              >
                <span className={styles.qualityLabel}>Full HD 1080p</span>
                <span className={styles.qualityDetail}>1920x1080 • 3Mbps</span>
              </button>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.startStreamBtn}
              disabled={isLoading || !rtmpUrl || !isReady}
            >
              {isLoading ? 'Starting...' : isReady ? 'Start Streaming' : 'Waiting for connection...'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
