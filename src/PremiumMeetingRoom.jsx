/**
 * ============================================================
 *  PremiumMeetingRoom.jsx — LUXE MEET
 * ============================================================
 *  A premium, black-and-gold themed meeting room component
 *  built on top of the Agora Video SDK (agora-rtc-react).
 *
 *  This component handles:
 *    • Automatic channel join on mount
 *    • Local + remote video rendering
 *    • Mic / Camera toggle with live state
 *    • Live call timer
 *    • UI-only placeholders for Screen Share, Virtual Background,
 *      Floating Emoji, and Auto-Captions (to be wired next)
 *
 *  Props:
 *    - channelName : string   — the channel to join
 *    - onLeave     : () => void — callback when the user ends the call
 * ============================================================
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useJoin,
  useCurrentUID,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  useRemoteUsers,
  usePublish,
  useRTCClient,
  LocalUser,
  RemoteUser,
} from 'agora-rtc-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import VirtualBackgroundExtension from 'agora-extension-virtual-background';
import styles from './PremiumMeetingRoom.module.css';


// ─── Agora Extensions ───────────────────────────────────────
const extension = new VirtualBackgroundExtension();
AgoraRTC.registerExtensions([extension]);

const BG_IMAGES = {
  office: '/assets/bg_office.png',
  cafe: '/assets/bg_cafe.png',
  beach: '/assets/bg_beach.png',
};

// ─── Agora Credentials ──────────────────────────────────────
// App ID will be fetched dynamically from the backend to ensure sync
// ─── SVG Icon Components (crisp at any size) ────────────────
const Icon = {
  Mic: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  MicOff: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  Camera: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  CameraOff: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
    </svg>
  ),
  Screen: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  ),
  Smile: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Captions: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 12h2m4 0h4M7 16h10" />
    </svg>
  ),
  PhoneOff: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  ),
  User: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Record: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  ),
  Broadcast: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M19 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M5 20a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M19 20a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M12 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M12 7c2.761 0 5 2.239 5 5s-2.239 5-5 5-5-2.239-5-5 2.239-5 5-5Z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M22 12h-2" />
      <path d="M4 12H2" />
    </svg>
  ),
};

/**
 * Format seconds into MM:SS display
 */
function formatTimer(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * PremiumMeetingRoom
 * Main meeting component with a luxury UI and Agora integration.
 */
export default function PremiumMeetingRoom({ channelName = 'MT_Test', displayName = 'Guest', onLeave }) {
  // ── Toggle states ───────────────────────────────────────────
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenShareOn, setScreenShareOn] = useState(false); // UI only

  // ── Virtual Background States ────────────────────────────────
  const [bgType, setBgType] = useState('none'); // 'none', 'blur', 'color', 'image'
  const [selectedColor, setSelectedColor] = useState('#1E1E24');
  const [selectedImage, setSelectedImage] = useState('office');
  const [showBgPanel, setShowBgPanel] = useState(false);

  const preloadedImagesRef = useRef({});
  const bgPanelRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    // Preload background images
    Object.entries(BG_IMAGES).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      preloadedImagesRef.current[key] = img;
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (bgPanelRef.current && !bgPanelRef.current.contains(event.target)) {
        setShowBgPanel(false);
      }
    }
    if (showBgPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBgPanel]);

  // ── Meeting States ──────────────────────────────────────────
  const [localUid] = useState(() => Math.floor(100000 + Math.random() * 900000));
  const client = useRTCClient();

  // ── Virtual Background Init ─────────────────────────────────
  const [isProcessorReady, setIsProcessorReady] = useState(false);

  useEffect(() => {
    const initProcessor = async () => {
      if (!processorRef.current && extension.checkCompatibility()) {
        const proc = extension.createProcessor();
        try {
          await proc.init();
          processorRef.current = proc;
          setIsProcessorReady(true);
          console.log('[LUXE MEET] Virtual Background Processor initialized');
        } catch (error) {
          console.error('[LUXE MEET] Failed to initialize Virtual Background Processor', error);
        }
      } else if (processorRef.current) {
        setIsProcessorReady(true);
      }
    };
    initProcessor();

    return () => {
      if (processorRef.current) {
        processorRef.current = null;
      }
    };
  }, []);

  // ── Call Timer ──────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Agora Hooks & Dynamic Token Setup ───────────────────────
  const [dynamicToken, setDynamicToken] = useState(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [dynamicAppId, setDynamicAppId] = useState('');

  useEffect(() => {
    let active = true;
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/token?channelName=${channelName}&uid=${localUid}`);
        const data = await res.json();
        if (data.token && active) {
          setDynamicToken(data.token);
          setDynamicAppId(data.appId);
          setIsTokenReady(true);
        }
      } catch (err) {
        console.error('Failed to fetch dynamic token', err);
      }
    };
    if (channelName && localUid) fetchToken();
    return () => { active = false; };
  }, [channelName, localUid]);




  // ── Agora Join (with debug logging) ─────────────────────────
  console.log('[AGORA DEBUG] useJoin config:', {
    appid: dynamicAppId ? dynamicAppId.substring(0, 8) + '...' : '(empty)',
    channel: channelName,
    tokenLen: dynamicToken ? dynamicToken.length : 0,
    uid: localUid,
    isTokenReady,
  });

  const { data: joinUid, isLoading: isJoining, isConnected, error: joinError } = useJoin({
    appid: dynamicAppId || '',
    channel: channelName,
    token: dynamicToken,
    uid: localUid,
  }, isTokenReady);

  // Log join state changes
  useEffect(() => {
    console.log('[AGORA DEBUG] Join state changed:', { joinUid, isJoining, isConnected, joinError: joinError?.message });
  }, [joinUid, isJoining, isConnected, joinError]);

  const { localMicrophoneTrack } = useLocalMicrophoneTrack(micOn);
  const { localCameraTrack } = useLocalCameraTrack(cameraOn);
  usePublish([localMicrophoneTrack, localCameraTrack].filter(Boolean));
  const rtcClient = useRTCClient();

  const remoteUsers = useRemoteUsers();

  // Log remote user changes
  useEffect(() => {
    console.log('[AGORA DEBUG] Remote users changed:', remoteUsers.map(u => ({ uid: u.uid, hasVideo: u.hasVideo, hasAudio: u.hasAudio })));
  }, [remoteUsers]);

  // ── Derived Values ──────────────────────────────────────────
  const totalParticipants = 1 + remoteUsers.length;

  const getTileSizeClass = () => {
    if (totalParticipants === 1) return styles.videoTileSolo;
    if (totalParticipants === 2) return styles.videoTileDuo;
    return styles.videoTileMulti;
  };

  // ── Handlers ────────────────────────────────────────────────

  const handleToggleMic = useCallback(() => {
    setMicOn((prev) => !prev);
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCameraOn((prev) => !prev);
  }, []);

  /**
   * Toggle Screen Share
   * TODO: Implement with AgoraRTC.createScreenVideoTrack()
   */
  const handleToggleScreenShare = useCallback(() => {
    setScreenShareOn((prev) => !prev);
    console.log('[LUXE MEET] Screen Share toggled');
  }, []);

  // Apply Virtual Background
  useEffect(() => {
    const processor = processorRef.current;
    if (!localCameraTrack || !processor || !isProcessorReady) return;

    const applyVirtualBg = async () => {
      try {
        if (bgType === 'none') {
          await processor.disable();
          console.log('[LUXE MEET] Virtual Background disabled');
        } else if (bgType === 'blur') {
          localCameraTrack.pipe(processor).pipe(localCameraTrack.processorDestination);
          processor.setOptions({ type: 'blur', blurDegree: 2 });
          await processor.enable();
          console.log('[LUXE MEET] Virtual Background: Blur enabled');
        } else if (bgType === 'color') {
          localCameraTrack.pipe(processor).pipe(localCameraTrack.processorDestination);
          processor.setOptions({ type: 'color', color: selectedColor });
          await processor.enable();
          console.log('[LUXE MEET] Virtual Background: Color enabled', selectedColor);
        } else if (bgType === 'image') {
          localCameraTrack.pipe(processor).pipe(localCameraTrack.processorDestination);
          const cachedImg = preloadedImagesRef.current[selectedImage];
          
          const applyImg = () => {
            processor.setOptions({ type: 'img', source: cachedImg });
            processor.enable();
            console.log('[LUXE MEET] Virtual Background: Image enabled', selectedImage);
          };

          if (cachedImg && cachedImg.complete) {
            applyImg();
          } else if (cachedImg) {
            cachedImg.onload = applyImg;
          }
        }
      } catch (e) {
        console.error('[LUXE MEET] Virtual Background Error:', e);
      }
    };

    applyVirtualBg();
  }, [bgType, selectedColor, selectedImage, localCameraTrack, isProcessorReady]);

  /** End the call and notify parent */
  const handleEndCall = useCallback(async () => {
    console.log('[LUXE MEET] Ending call and cleaning up...');

    // 1. Leave Agora explicitly before releasing local tracks
    if (rtcClient) {
      try {
        await rtcClient.leave();
        console.log('[LUXE MEET] Left Agora channel');
      } catch (leaveError) {
        console.warn('[LUXE MEET] Agora leave failed', leaveError);
      }
    }

    // 2. Stop local media tracks and clear local device usage
    if (localCameraTrack) {
      try {
        localCameraTrack.stop();
        localCameraTrack.close();
      } catch (trackError) {
        console.warn('[LUXE MEET] Camera track stop/close failed', trackError);
      }
    }
    if (localMicrophoneTrack) {
      try {
        localMicrophoneTrack.stop();
        localMicrophoneTrack.close();
      } catch (trackError) {
        console.warn('[LUXE MEET] Microphone track stop/close failed', trackError);
      }
    }

    setCameraOn(false);
    setMicOn(false);

    // 3. Clear timers
    clearInterval(timerRef.current);

    // 4. Notify parent to exit meeting UI
    if (onLeave) onLeave();
  }, [onLeave, localCameraTrack, localMicrophoneTrack, rtcClient]);

  // Comprehensive Cleanup (Tab close / Unmount)
  useEffect(() => {
    const cleanup = async () => {
      if (rtcClient) {
        try {
          await rtcClient.leave();
          console.log('[LUXE MEET] Cleanup left Agora channel');
        } catch (leaveError) {
          console.warn('[LUXE MEET] Cleanup Agora leave failed', leaveError);
        }
      }

      if (localCameraTrack) {
        try {
          localCameraTrack.stop();
          localCameraTrack.close();
        } catch (trackError) {
          console.warn('[LUXE MEET] Cleanup camera track error', trackError);
        }
      }
      if (localMicrophoneTrack) {
        try {
          localMicrophoneTrack.stop();
          localMicrophoneTrack.close();
        } catch (trackError) {
          console.warn('[LUXE MEET] Cleanup microphone track error', trackError);
        }
      }
    };

    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [rtcClient, localCameraTrack, localMicrophoneTrack]);


  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      {/* ─── Header ───────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.channelInfo}>
          <span className={styles.brandName}>LUXE MEET</span>
          <span className={styles.channelDot} />
          <span className={styles.channelName}>{channelName}</span>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.timerBadge}>
            <span className={styles.timerIcon}>⏱</span>
            <span>{formatTimer(elapsed)}</span>
          </div>
          <span className={styles.participantCount}>
            <Icon.User />
            {totalParticipants}
          </span>
        </div>
      </header>

      {/* ─── Main Workspace — Video Grid ──────────────────── */}
      <main className={styles.workspace}>
        <div className={styles.videoGrid}>

          {/* ── Local User Video Tile ── */}
          <div className={`${styles.videoTile} ${getTileSizeClass()}`}>
            <LocalUser
              audioTrack={localMicrophoneTrack}
              videoTrack={localCameraTrack}
              cameraOn={cameraOn}
              micOn={micOn}
              playAudio={false}
              playVideo={cameraOn}
              style={{ width: '100%', height: '100%' }}
            />

            {/* Camera-off fallback */}
            {!cameraOn && (
              <div className={styles.cameraOff}>
                <div className={styles.cameraOffAvatar}>Y</div>
                <span className={styles.cameraOffLabel}>Camera is off</span>
              </div>
            )}

            {/* Glassmorphism Name Tag */}
            <div className={styles.nameTag}>
              <span className={styles.nameTagText}>{displayName}</span>
              <span className={styles.nameTagYou}>(You)</span>
              <span className={styles.nameTagMic}>
                {micOn ? '🎙️' : '🔇'}
              </span>
            </div>
          </div>

          {/* ── Remote User Video Tiles ── */}
          {remoteUsers.map((user) => (
            <div
              key={user.uid}
              className={`${styles.videoTile} ${getTileSizeClass()}`}
            >
              <RemoteUser
                user={user}
                style={{ width: '100%', height: '100%' }}
              />
              <div className={styles.nameTag}>
                <span className={styles.nameTagText}>
                  User {user.uid}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ─── Control Footer ───────────────────────────────── */}
      <footer className={styles.footer}>

        {/* Microphone Toggle */}
        <button
          className={`${styles.controlBtn} ${micOn ? styles.controlBtnActive : styles.controlBtnMuted}`}
          onClick={handleToggleMic}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <Icon.Mic /> : <Icon.MicOff />}
          <span className={styles.controlBtnTooltip}>
            {micOn ? 'Mute' : 'Unmute'}
          </span>
        </button>

        {/* Camera Toggle */}
        <button
          className={`${styles.controlBtn} ${cameraOn ? styles.controlBtnActive : styles.controlBtnMuted}`}
          onClick={handleToggleCamera}
          aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {cameraOn ? <Icon.Camera /> : <Icon.CameraOff />}
          <span className={styles.controlBtnTooltip}>
            {cameraOn ? 'Camera Off' : 'Camera On'}
          </span>
        </button>

        <div className={styles.controlDivider} />

        {/* Screen Share */}
        <button
          className={`${styles.controlBtn} ${screenShareOn ? styles.controlBtnActive : ''}`}
          onClick={handleToggleScreenShare}
          aria-label="Toggle screen share"
        >
          <Icon.Screen />
          <span className={styles.controlBtnTooltip}>Screen Share</span>
        </button>

        {/* Virtual Background (Sparkles) with Popover */}
        <div className={styles.controlBtnWrapper} ref={bgPanelRef}>
          <button
            className={`${styles.controlBtn} ${bgType !== 'none' ? styles.controlBtnActive : ''}`}
            onClick={() => setShowBgPanel((prev) => !prev)}
            aria-label="Toggle virtual background options"
          >
            <Icon.Sparkles />
            <span className={styles.controlBtnTooltip}>バーチャル背景</span>
          </button>

          {showBgPanel && (
            <div className={styles.bgPanel}>
              <div className={styles.bgPanelHeader}>
                <span className={styles.bgPanelTitle}>バーチャル背景</span>
                <button
                  className={styles.bgPanelClose}
                  onClick={() => setShowBgPanel(false)}
                  aria-label="Close background panel"
                >
                  &times;
                </button>
              </div>

              <div className={styles.bgPanelContent}>
                {/* 1. Basic Settings */}
                <div className={styles.bgSection}>
                  <div className={styles.bgSectionHeader}>基本設定</div>
                  <div className={styles.bgBasicGrid}>
                    <button
                      className={`${styles.bgOptionCard} ${bgType === 'none' ? styles.bgOptionCardActive : ''}`}
                      onClick={() => setBgType('none')}
                    >
                      <div className={styles.bgIconNone}>🚫</div>
                      <span className={styles.bgOptionLabel}>なし</span>
                    </button>
                    <button
                      className={`${styles.bgOptionCard} ${bgType === 'blur' ? styles.bgOptionCardActive : ''}`}
                      onClick={() => setBgType('blur')}
                    >
                      <div className={styles.bgIconBlur}>✨</div>
                      <span className={styles.bgOptionLabel}>ぼかし</span>
                    </button>
                  </div>
                </div>

                {/* 2. Curated Colors */}
                <div className={styles.bgSection}>
                  <div className={styles.bgSectionHeader}>単色背景</div>
                  <div className={styles.colorsGrid}>
                    {[
                      { name: 'ダークグレー', val: '#1E1E24' },
                      { name: 'ネイビー', val: '#0D1B2A' },
                      { name: 'エメラルド', val: '#0B2521' },
                      { name: 'チャコール', val: '#1C1917' },
                      { name: 'ブロンズ', val: '#2A1F1B' }
                    ].map((c) => (
                      <button
                        key={c.val}
                        className={`${styles.colorCircle} ${bgType === 'color' && selectedColor === c.val ? styles.colorCircleActive : ''}`}
                        style={{ backgroundColor: c.val }}
                        onClick={() => {
                          setBgType('color');
                          setSelectedColor(c.val);
                        }}
                        title={c.name}
                        aria-label={`Apply ${c.name} background`}
                      />
                    ))}
                  </div>
                </div>

                {/* 3. Virtual Background Images */}
                <div className={styles.bgSection}>
                  <div className={styles.bgSectionHeader}>画像背景</div>
                  <div className={styles.imagesGrid}>
                    {[
                      { key: 'office', name: 'オフィス', src: '/assets/bg_office.png' },
                      { key: 'cafe', name: 'カフェ', src: '/assets/bg_cafe.png' },
                      { key: 'beach', name: 'ビーチ', src: '/assets/bg_beach.png' }
                    ].map((img) => (
                      <button
                        key={img.key}
                        className={`${styles.imageCard} ${bgType === 'image' && selectedImage === img.key ? styles.imageCardActive : ''}`}
                        onClick={() => {
                          setBgType('image');
                          setSelectedImage(img.key);
                        }}
                        aria-label={`Apply ${img.name} background`}
                      >
                        <img src={img.src} alt={img.name} className={styles.imageThumb} />
                        <span className={img.key === 'beach' ? styles.imageCardLabelDark : styles.imageCardLabel}>{img.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.controlDivider} />

        {/* End Call */}
        <button
          className={styles.endCallBtn}
          onClick={handleEndCall}
          aria-label="End call"
        >
          <Icon.PhoneOff />
          <span className={styles.controlBtnTooltip}>End Call</span>
        </button>
      </footer>
    </div>
  );
}
