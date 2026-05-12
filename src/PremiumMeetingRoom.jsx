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
import AgoraRTM from 'agora-rtm-sdk';
import VirtualBackgroundExtension from 'agora-extension-virtual-background';
import RTMPStreamingModal from './components/RTMPStreamingModal';
import styles from './PremiumMeetingRoom.module.css';

// ─── Agora Extensions ───────────────────────────────────────
const extension = new VirtualBackgroundExtension();
AgoraRTC.registerExtensions([extension]);
let processor = null;

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
  const [screenShareOn, setScreenShareOn] = useState(false);  // UI only
  const [virtualBgOn, setVirtualBgOn] = useState(false);  // UI only
  const [captionsOn, setCaptionsOn] = useState(false);  // UI only

  // ── Recording States ────────────────────────────────────────
  const localUid = useCurrentUID();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState('mix');
  const [recordingData, setRecordingData] = useState(null);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const client = useRTCClient();

  // ── RTMP Streaming States ───────────────────────────────────
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStreamingLoading, setIsStreamingLoading] = useState(false);
  const [showRTMPModal, setShowRTMPModal] = useState(false);
  const [converterId, setConverterId] = useState(null);
  const [streamingUrl, setStreamingUrl] = useState('');

  // ── Virtual Background Init ─────────────────────────────────
  const [isProcessorReady, setIsProcessorReady] = useState(false);

  useEffect(() => {
    const initProcessor = async () => {
      if (!processor && extension.checkCompatibility()) {
        processor = extension.createProcessor();
        try {
          await processor.init();
          setIsProcessorReady(true);
          console.log('[LUXE MEET] Virtual Background Processor initialized');
        } catch (error) {
          console.error('[LUXE MEET] Failed to initialize Virtual Background Processor', error);
        }
      } else if (processor) {
        setIsProcessorReady(true);
      }
    };
    initProcessor();
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

  // ── Agora Hooks ─────────────────────────────────────────────
  const [dynamicToken, setDynamicToken] = useState(null);
  const [rtmToken, setRtmToken] = useState(null);
  const [rtmUserId, setRtmUserId] = useState(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [remoteNames, setRemoteNames] = useState({});
  const [dynamicAppId, setDynamicAppId] = useState('');

  useEffect(() => {
    let active = true;
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/token?channelName=${channelName}&uid=0`);
        const data = await res.json();
        if (data.token && active) {
          setDynamicToken(data.token);
          setRtmToken(data.rtmToken);
          setRtmUserId(data.rtmUserId);
          setDynamicAppId(data.appId);
          setIsTokenReady(true);
        }
      } catch (err) {
        console.error('Failed to fetch dynamic token', err);
      }
    };
    if (channelName) fetchToken();
    return () => { active = false; };
  }, [channelName]);

  // ── Agora RTM Logic ─────────────────────────────────────────
  const rtmRef = useRef(null);

  useEffect(() => {
    console.log("[RTM DEBUG] Effect triggered:", { isTokenReady, hasRtmToken: !!rtmToken, rtmUserId });
    if (!isTokenReady || !rtmToken || !rtmUserId) return;

    let active = true;
    const initRTM = async () => {
      try {
        console.log("[RTM DEBUG] Attempting to create RTM instance...");
        const rtm = new AgoraRTM.RTM(dynamicAppId, rtmUserId);
        rtmRef.current = rtm;
        console.log("[RTM] Initializing with UID:", rtmUserId);

        // 1. Listen for messages
        rtm.addEventListener("message", (event) => {
          console.log("[RTM] Message received:", event);
          try {
            const data = JSON.parse(event.message);
            if (data.type === "NAME_UPDATE") {
              console.log("[RTM] Name update for:", data.rtcUid, "->", data.displayName);
              setRemoteNames(prev => ({ ...prev, [data.rtcUid]: data.displayName }));
            }
          } catch (e) { console.error("[RTM] Parse error:", e); }
        });

        // 2. Login
        await rtm.login({ token: rtmToken });
        console.log("[RTM] Logged in successfully");

        // 3. Subscribe to channel
        await rtm.subscribe(channelName);
        console.log("[RTM] Subscribed to channel:", channelName);

        // 4. Broadcast own name
        const broadcast = () => {
          if (active) {
            console.log("[RTM] Broadcasting name:", displayName);
            rtm.publish(channelName, JSON.stringify({
              type: "NAME_UPDATE",
              rtcUid: localUid,
              displayName: displayName
            }));
          }
        };

        broadcast();
        const interval = setInterval(broadcast, 5000); // Re-broadcast every 5s for late joiners

        return () => {
          clearInterval(interval);
          rtm.logout();
        };
      } catch (err) {
        console.error("RTM Error:", err);
      }
    };

    const cleanupPromise = initRTM();
    return () => {
      active = false;
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [isTokenReady, rtmToken, rtmUserId, channelName, localUid, displayName]);

  useJoin({
    appid: dynamicAppId || '',
    channel: channelName,
    token: dynamicToken,
  }, isTokenReady);

  const { localMicrophoneTrack } = useLocalMicrophoneTrack(micOn);
  const { localCameraTrack } = useLocalCameraTrack(cameraOn);
  usePublish([localMicrophoneTrack, localCameraTrack]);

  const remoteUsers = useRemoteUsers();

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

  /**
   * Toggle Virtual Background (Blur)
   */
  const handleToggleVirtualBg = useCallback(() => {
    setVirtualBgOn((prev) => !prev);
  }, []);

  // Apply Virtual Background
  useEffect(() => {
    if (!localCameraTrack || !processor || !isProcessorReady) return;

    const applyVirtualBg = async () => {
      try {
        if (virtualBgOn) {
          localCameraTrack.pipe(processor).pipe(localCameraTrack.processorDestination);
          processor.setOptions({ type: 'blur', blurDegree: 2 });
          await processor.enable();
          console.log('[LUXE MEET] Virtual Background enabled');
        } else {
          await processor.disable();
          console.log('[LUXE MEET] Virtual Background disabled');
        }
      } catch (e) {
        console.error('[LUXE MEET] Virtual Background Error:', e);
      }
    };

    applyVirtualBg();
  }, [virtualBgOn, localCameraTrack, isProcessorReady]);

  /**
   * Send Floating Emoji (Reaction)
   * TODO: Send reaction via Agora RTM channel message
   */
  const handleSendEmoji = useCallback(() => {
    console.log('[LUXE MEET] Emoji reaction sent');
  }, []);

  /**
   * Toggle Auto-Captions (STT)
   * TODO: Implement with Agora Real-Time STT
   */
  const handleToggleCaptions = useCallback(() => {
    setCaptionsOn((prev) => !prev);
    console.log('[LUXE MEET] Captions toggled');
  }, []);

  /**
   * Toggle Cloud Recording
   */
  const handleToggleRecording = useCallback(async () => {
    if (isRecordingLoading) return;
    setIsRecordingLoading(true);

    try {
      if (!isRecording) {
        // The Cloud Recording Bot MUST have its own unique UID to join the channel.
        // It cannot use localUid, otherwise it kicks the host out!
        const uidToUse = Math.floor(Math.random() * 1000000);

        const acquireRes = await fetch('/api/recording/acquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, uid: uidToUse })
        });
        const acquireData = await acquireRes.json();

        if (!acquireRes.ok) throw new Error(acquireData.error || 'Failed to acquire');
        const resourceId = acquireData.resourceId;

        const startRes = await fetch('/api/recording/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId,
            mode: recordingMode,
            channelName,
            uid: uidToUse,
            token: dynamicToken
          })
        });
        const startData = await startRes.json();

        if (!startRes.ok) {
          const errorMsg = startData.reason || startData.error || 'Failed to start';
          throw new Error(errorMsg);
        }

        setRecordingData({ resourceId, sid: startData.sid, uidUsed: uidToUse });
        setIsRecording(true);
        console.log(`[LUXE MEET] Started ${recordingMode} recording`);
      } else {
        // Stop Recording Flow
        if (!recordingData) throw new Error("No recording data to stop");

        const stopRes = await fetch('/api/recording/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: recordingData.resourceId,
            sid: recordingData.sid,
            mode: recordingMode,
            channelName,
            uid: recordingData.uidUsed
          })
        });

        const stopData = await stopRes.json();
        if (!stopRes.ok) throw new Error(stopData.error || 'Failed to stop');

        setRecordingData(null);
        setIsRecording(false);
        console.log(`[LUXE MEET] Stopped ${recordingMode} recording`);
      }
    } catch (err) {
      console.error("[LUXE MEET] Recording error:", err);
      alert("Recording Error: " + (err.message || JSON.stringify(err)));
    } finally {
      setIsRecordingLoading(false);
    }
  }, [isRecording, isRecordingLoading, recordingMode, channelName, localUid, recordingData]);

  /**
   * RTMP Streaming Handlers (Backend-Driven)
   */
  const handleStartRTMP = useCallback(async ({ rtmpUrl, width, height, bitrate }) => {
    if (isStreamingLoading) return;
    setIsStreamingLoading(true);

    try {
      // Use a random UID for the converter bot
      const converterUid = Math.floor(Math.random() * 1000000);

      const res = await fetch('/api/rtmp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName,
          rtmpUrl,
          width,
          height,
          bitrate,
          uid: converterUid,
          localUid: localUid,
          remoteUids: remoteUsers.map(u => u.uid)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error || 'Failed to start RTMP stream');

      setConverterId(data.converterId);
      setStreamingUrl(rtmpUrl);
      setIsStreaming(true);
      setShowRTMPModal(false);
      console.log('[LUXE MEET] RTMP Streaming started:', data.converterId);
    } catch (err) {
      console.error("[LUXE MEET] RTMP Error:", err);
      alert("RTMP Error: " + err.message);
    } finally {
      setIsStreamingLoading(false);
    }
  }, [channelName, localUid, remoteUsers, isStreamingLoading]);

  const handleStopRTMP = useCallback(async () => {
    if (isStreamingLoading || !converterId) return;
    setIsStreamingLoading(true);

    try {
      const res = await fetch('/api/rtmp/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ converterId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.reason || data.error || 'Failed to stop RTMP stream');
      }

      setConverterId(null);
      setStreamingUrl('');
      setIsStreaming(false);
      console.log('[LUXE MEET] RTMP Streaming stopped');
    } catch (err) {
      console.error("[LUXE MEET] RTMP Stop Error:", err);
      alert("RTMP Stop Error: " + err.message);
    } finally {
      setIsStreamingLoading(false);
    }
  }, [converterId, isStreamingLoading]);

  /** End the call and notify parent */
  const handleEndCall = useCallback(async () => {
    console.log('[LUXE MEET] Ending call and cleaning up...');
    
    // 1. Stop RTMP Stream if active
    if (isStreaming) {
      await handleStopRTMP();
    }
    
    // 2. Stop tracks
    if (localCameraTrack) {
      localCameraTrack.stop();
      localCameraTrack.close();
    }
    if (localMicrophoneTrack) {
      localMicrophoneTrack.stop();
      localMicrophoneTrack.close();
    }

    // 3. Clear timers
    clearInterval(timerRef.current);

    // 4. Leave Agora (handled by agora-rtc-react, but we can be explicit)
    if (onLeave) onLeave();
  }, [onLeave, localCameraTrack, localMicrophoneTrack, handleStopRTMP, isStreaming]);

  // Comprehensive Cleanup (Tab close / Unmount)
  useEffect(() => {
    const cleanup = async () => {
      if (isStreaming) {
        // Use navigator.sendBeacon for more reliable cleanup on tab close
        const data = JSON.stringify({ converterId });
        navigator.sendBeacon('/api/rtmp/stop', data);
      }
    };

    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [isStreaming, converterId]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      {/* ─── Header ───────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.channelInfo}>
          <span className={styles.brandName}>LUXE MEET</span>
          <span className={styles.channelDot} />
          <span className={styles.channelName}>{channelName}</span>

          {isStreaming && (
            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              LIVE
            </div>
          )}
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
                  {remoteNames[user.uid] || `User ${user.uid}`}
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

        {/* Virtual Background (Blur) */}
        <button
          className={`${styles.controlBtn} ${virtualBgOn ? styles.controlBtnActive : ''}`}
          onClick={handleToggleVirtualBg}
          aria-label="Toggle virtual background"
        >
          <Icon.Sparkles />
          <span className={styles.controlBtnTooltip}>Blur BG</span>
        </button>

        {/* Send Emoji Reaction */}
        <button
          className={styles.controlBtn}
          onClick={handleSendEmoji}
          aria-label="Send emoji reaction"
        >
          <Icon.Smile />
          <span className={styles.controlBtnTooltip}>React</span>
        </button>

        {/* Auto-Captions (STT) */}
        <button
          className={`${styles.controlBtn} ${captionsOn ? styles.controlBtnActive : ''}`}
          onClick={handleToggleCaptions}
          aria-label="Toggle captions"
        >
          <Icon.Captions />
          <span className={styles.controlBtnTooltip}>Captions</span>
        </button>

        <div className={styles.controlDivider} />

        {/* Cloud Recording */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
          <select
            value={recordingMode}
            onChange={(e) => setRecordingMode(e.target.value)}
            disabled={isRecording || isRecordingLoading}
            style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px', outline: 'none' }}
          >
            <option value="mix" style={{ color: '#000' }}>Mix</option>
            <option value="individual" style={{ color: '#000' }}>Individual</option>
            <option value="web" style={{ color: '#000' }}>Web</option>
          </select>

          <button
            className={`${styles.controlBtn} ${isRecording ? styles.controlBtnActive : ''} ${isRecordingLoading ? styles.controlBtnMuted : ''}`}
            onClick={handleToggleRecording}
            aria-label="Toggle recording"
            disabled={isRecordingLoading}
            style={isRecording ? { color: '#ff4444' } : {}}
          >
            <Icon.Record />
            <span className={styles.controlBtnTooltip}>
              {isRecordingLoading ? 'Processing...' : (isRecording ? 'Stop Rec' : 'Start Rec')}
            </span>
          </button>
        </div>

        <div className={styles.controlDivider} />

        {/* RTMP Media Push */}
        <button
          className={`${styles.controlBtn} ${isStreaming ? styles.controlBtnActive : ''} ${isStreamingLoading ? styles.controlBtnMuted : ''}`}
          onClick={isStreaming ? handleStopRTMP : () => setShowRTMPModal(true)}
          aria-label="Toggle RTMP streaming"
          disabled={isStreamingLoading}
          style={isStreaming ? { color: '#D4AF37', borderColor: '#D4AF37' } : {}}
        >
          <Icon.Broadcast />
          <span className={styles.controlBtnTooltip}>
            {isStreamingLoading ? 'Processing...' : (isStreaming ? 'Stop Live' : 'Go Live')}
          </span>
        </button>

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

      {/* ─── Modals ─── */}
      <RTMPStreamingModal
        isOpen={showRTMPModal}
        onClose={() => setShowRTMPModal(false)}
        onStart={handleStartRTMP}
        isLoading={isStreamingLoading}
        isReady={!!localUid && localUid !== 0}
      />
    </div>
  );
}
