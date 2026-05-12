import { useLocalMicrophoneTrack, useLocalCameraTrack, useRemoteUsers, usePublish, useJoin, RemoteUser, LocalUser } from 'agora-rtc-react';

export default function VideoCall({ setInCall }) {
    const appId = "YOUR_APP_ID_HERE";
    const channelName = "MT_Test";
    const token = "YOUR_TEMP_TOKEN_HERE";

    // Automatically join the channel
    useJoin({ appid: appId, channel: channelName, token: token ? token : null });

    const { localMicrophoneTrack } = useLocalMicrophoneTrack();
    const { localCameraTrack } = useLocalCameraTrack();
    usePublish([localMicrophoneTrack, localCameraTrack]);

    const remoteUsers = useRemoteUsers();

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>

                {/* Local Video */}
                <div style={{ width: '320px', height: '240px', backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
                    <LocalUser
                        audioTrack={localMicrophoneTrack}
                        videoTrack={localCameraTrack}
                        cameraOn={true}
                        micOn={true}
                        playAudio={false}
                        playVideo={true}
                    />
                </div>

                {/* Remote Videos */}
                {remoteUsers.map(user => (
                    <div key={user.uid} style={{ width: '320px', height: '240px', backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
                        <RemoteUser user={user} />
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '30px' }}>
                <button
                    style={{ padding: '10px 20px', marginRight: '10px', cursor: 'pointer', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '5px' }}
                    onClick={() => setInCall(false)}
                >
                    Leave Call
                </button>
                <button
                    style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '5px' }}
                    onClick={() => alert("Emoji RTM Logic goes here!")}
                >
                    Send ❤️ Emoji
                </button>
            </div>
        </div>
    );
}