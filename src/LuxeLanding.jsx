/**
 * ============================================================
 *  LuxeLanding.jsx — LUXE MEET Premium Entry Page
 * ============================================================
 *  Immersive, high-end landing experience with animated background,
 *  gold gradient CTA, floating particles, and channel input.
 *
 *  Props:
 *    - onJoin(channelName: string) : callback to enter the meeting
 * ============================================================
 */

import { useState, useCallback } from 'react';
import styles from './LuxeLanding.module.css';

export default function LuxeLanding({ onJoin }) {
  const [channel, setChannel] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleJoin = useCallback(() => {
    if (channel.trim() && displayName.trim()) {
      onJoin(channel.trim(), displayName.trim());
    } else if (!displayName.trim()) {
      alert("Please enter a display name");
    } else {
      alert("Please enter a room name");
    }
  }, [channel, displayName, onJoin]);

  // Allow Enter key to join
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleJoin();
  }, [handleJoin]);

  return (
    <div className={styles.landing}>

      {/* ── Animated Background Layers ── */}
      <div className={styles.bgGlow} />
      <div className={styles.particleOrb} />
      <div className={styles.particleOrb} />
      <div className={styles.particleOrb} />
      <div className={styles.particleOrb} />
      <div className={styles.particleOrb} />
      <div className={styles.particleOrb} />
      <div className={styles.gridOverlay} />
      <div className={styles.topAccent} />
      <div className={styles.cornerTL} />
      <div className={styles.cornerBR} />

      {/* ── Navigation Bar ── */}
      <nav className={styles.nav}>
        <span className={styles.navBrand}>LUXE MEET</span>
        <div className={styles.navStatus}>
          <span className={styles.statusDot} />
          <span>System Online</span>
        </div>
      </nav>

      {/* ── Hero Content ── */}
      <div className={styles.heroContent}>

        {/* Diamond Icon */}
        <div className={styles.heroIcon}>
          <div className={styles.heroIconDiamond}>
            <span className={styles.heroIconInner}>◆</span>
          </div>
        </div>

        {/* Tagline */}
        <span className={styles.heroTagline}>Exclusive Connections</span>

        {/* Main Title */}
        <h1 className={styles.heroTitle}>
          Premium Video<br />
          <span className={styles.heroTitleAccent}>Experience</span>
        </h1>

        {/* Description */}
        <p className={styles.heroDesc}>
          Step into a world of crystal-clear video meetings with
          studio-grade quality, real-time reactions, and AI-powered
          captions — designed for those who demand the&nbsp;finest.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column', width: '100%', maxWidth: '320px', marginBottom: '2rem' }}>
          {/* Name Input Pill */}
          <div className={styles.channelPill} style={{ marginBottom: 0 }}>
            <span className={styles.channelPillLabel}>Name</span>
            <div className={styles.channelPillDivider} />
            <input
              className={styles.channelPillInput}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
              spellCheck={false}
            />
          </div>

          {/* Channel Input Pill */}
          <div className={styles.channelPill} style={{ marginBottom: 0 }}>
            <span className={styles.channelPillLabel}>Channel</span>
            <div className={styles.channelPillDivider} />
            <input
              className={styles.channelPillInput}
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter room name"
              spellCheck={false}
            />
          </div>
        </div>

        {/* CTA Button */}
        <div className={styles.ctaWrapper}>
          <button
            id="join-channel-btn"
            className={styles.ctaBtn}
            onClick={handleJoin}
          >
            <span className={styles.ctaBtnIcon}>▶</span>
            Enter Room
          </button>
          <span className={styles.ctaHint}>No download required · Instant join</span>
        </div>
      </div>

      {/* ── Bottom Feature Badges ── */}
      <div className={styles.features}>
        <div className={styles.featureBadge}>
          <span className={styles.featureBadgeIcon}>🎙️</span>
          <span>HD Audio</span>
        </div>
        <span className={styles.featureSep} />
        <div className={styles.featureBadge}>
          <span className={styles.featureBadgeIcon}>📷</span>
          <span>4K Video</span>
        </div>
        <span className={styles.featureSep} />
        <div className={styles.featureBadge}>
          <span className={styles.featureBadgeIcon}>✨</span>
          <span>Virtual BG</span>
        </div>
        <span className={styles.featureSep} />
        <div className={styles.featureBadge}>
          <span className={styles.featureBadgeIcon}>💬</span>
          <span>Live Captions</span>
        </div>
        <span className={styles.featureSep} />
        <div className={styles.featureBadge}>
          <span className={styles.featureBadgeIcon}>🔒</span>
          <span>E2E Encrypted</span>
        </div>
      </div>

      <div className={styles.bottomAccent} />
    </div>
  );
}
