/**
 * App.jsx — Root application shell
 * Switches between LuxeLanding and PremiumMeetingRoom
 */

import { useState } from 'react';
import AgoraRTC, { AgoraRTCProvider } from 'agora-rtc-react';
import LuxeLanding from './LuxeLanding';
import PremiumMeetingRoom from './PremiumMeetingRoom';
import RecordingGallery from './components/RecordingGallery';

// Create client ONCE outside the component to prevent re-creation on re-renders
const agoraClient = AgoraRTC.createClient({ codec: 'h264', mode: 'rtc' });

function App() {
  const [inCall, setInCall] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [displayName, setDisplayName] = useState('');

  /** Called from the landing page when user clicks "Enter Room" */
  const handleJoin = (channel, name) => {
    setChannelName(channel);
    setDisplayName(name);
    setInCall(true);
  };

  /** Called from the meeting room when user clicks "End Call" */
  const handleLeave = () => {
    setInCall(false);
  };

  if (showGallery) {
    return <RecordingGallery onBack={() => setShowGallery(false)} />;
  }

  if (!inCall) {
    return <LuxeLanding onJoin={handleJoin} onShowGallery={() => setShowGallery(true)} />;
  }

  return (
    <AgoraRTCProvider client={agoraClient}>
      <PremiumMeetingRoom channelName={channelName} displayName={displayName} onLeave={handleLeave} />
    </AgoraRTCProvider>
  );
}

export default App;