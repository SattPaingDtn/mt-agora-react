/**
 * App.jsx — Root application shell
 * Switches between LuxeLanding and PremiumMeetingRoom
 */

import { useState } from 'react';
import AgoraRTC, { AgoraRTCProvider, useRTCClient } from 'agora-rtc-react';
import LuxeLanding from './LuxeLanding';
import PremiumMeetingRoom from './PremiumMeetingRoom';

function App() {
  const client = useRTCClient(
    AgoraRTC.createClient({ codec: 'h264', mode: 'rtc' })
  );
  const [inCall, setInCall] = useState(false);
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

  if (!inCall) {
    return <LuxeLanding onJoin={handleJoin} />;
  }

  return (
    <AgoraRTCProvider client={client}>
      <PremiumMeetingRoom channelName={channelName} displayName={displayName} onLeave={handleLeave} />
    </AgoraRTCProvider>
  );
}

export default App;