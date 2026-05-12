import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On Vercel, env vars are provided by the platform. 
// Locally, we look for .env in the root directory.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const {
  AGORA_APP_ID,
  AGORA_APP_CERTIFICATE,
  AGORA_CUSTOMER_ID,
  AGORA_CUSTOMER_SECRET,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
  AWS_BUCKET
} = process.env;

import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

app.get('/api/token', (req, res) => {
  const { channelName, uid } = req.query;

  if (!channelName) {
    return res.status(400).json({ error: 'channelName is required' });
  }

  const expirationTimeInSeconds = 3600 * 24;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
  const uidNumber = uid ? parseInt(uid, 10) : 0;

  try {
    // Generate RTC Token
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uidNumber,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds,
      privilegeExpiredTs
    );

    // Generate RTM Token (RTM user IDs are strings)
    const rtmUserId = uidNumber === 0 ? `user_${Math.floor(Math.random() * 10000)}` : uidNumber.toString();
    const rtmToken = pkg.RtmTokenBuilder.buildToken(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      rtmUserId,
      expirationTimeInSeconds
    );

    console.log(`[BACKEND] Token requested for channel: ${channelName}, RTC UID: ${uidNumber}, RTM UserID: ${rtmUserId}`);
    
    res.json({ 
      token: rtcToken, 
      rtmToken: rtmToken,
      rtmUserId: rtmUserId,
      appId: AGORA_APP_ID
    });
  } catch (err) {
    console.error('Token Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Helper to generate the Authorization header for Agora REST API
const getAuthHeader = () => {
  const credentials = `${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

// --- Recording Endpoints ---
app.post('/api/recording/acquire', async (req, res) => {
  const { channelName, uid } = req.body;
  if (!channelName || !uid) return res.status(400).json({ error: 'channelName and uid are required' });

  try {
    const response = await axios.post(
      `https://api.sd-rtn.com/v1/apps/${AGORA_APP_ID}/cloud_recording/acquire`,
      {
        cname: channelName,
        uid: uid.toString(),
        clientRequest: { resourceExpiredHour: 24, scene: 0 }
      },
      { headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: 'Failed to acquire resource ID' });
  }
});

app.post('/api/recording/start', async (req, res) => {
  const { resourceId, mode, channelName, uid, token } = req.body;
  if (!resourceId || !mode || !channelName || !uid) return res.status(400).json({ error: 'Missing parameters' });

  const storageConfig = {
    vendor: 1,
    region: parseInt(AWS_REGION),
    bucket: AWS_BUCKET,
    accessKey: AWS_ACCESS_KEY,
    secretKey: AWS_SECRET_KEY,
    fileNamePrefix: ["agora", "recording", channelName]
  };

  let recordingConfig = { maxIdleTime: 30, streamTypes: 2, channelType: 0 };
  if (mode === 'individual') {
    recordingConfig.subscribeVideoUids = ["#allstream#"];
    recordingConfig.subscribeAudioUids = ["#allstream#"];
  } else if (mode === 'mix') {
    recordingConfig.transcodingConfig = { height: 720, width: 1280, bitrate: 1500, fps: 30, mixedVideoLayout: 1, backgroundColor: "#000000" };
  }

  try {
    const response = await axios.post(
      `https://api.sd-rtn.com/v1/apps/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/${mode}/start`,
      {
        cname: channelName,
        uid: uid.toString(),
        clientRequest: { token: token || "", recordingConfig, recordingFileConfig: { avFileType: mode === 'individual' ? ["hls"] : ["hls", "mp4"] }, storageConfig }
      },
      { headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: 'Failed to start recording' });
  }
});

app.post('/api/recording/stop', async (req, res) => {
  const { resourceId, sid, mode, channelName, uid } = req.body;
  try {
    const response = await axios.post(
      `https://api.sd-rtn.com/v1/apps/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/stop`,
      { cname: channelName, uid: uid.toString(), clientRequest: {} },
      { headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: 'Failed to stop recording' });
  }
});

// --- RTMP Media Push Endpoints ---
app.post('/api/rtmp/start', async (req, res) => {
  const { channelName, rtmpUrl, width, height, bitrate, fps, uid, localUid, remoteUids = [] } = req.body;
  if (!channelName || !rtmpUrl || !uid) return res.status(400).json({ error: 'Missing parameters' });

  const lid = localUid ? parseInt(localUid, 10) : 0;
  const rids = remoteUids.map(id => parseInt(id, 10));
  
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
  
  const converterToken = RtcTokenBuilder.buildTokenWithUid(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channelName, parseInt(uid, 10), RtcRole.PUBLISHER, expirationTimeInSeconds, privilegeExpiredTs);

  const mainUid = (lid && lid !== 0) ? lid : (rids[0] || 0);
  const layout = [];
  if (mainUid !== 0) {
    layout.push({ rtcStreamUid: mainUid, region: { xPos: 0, yPos: 0, width: width || 1280, height: height || 720, zIndex: 1 }, fillMode: "fit" });
  }
  rids.forEach((rid, index) => {
    if (rid === mainUid) return;
    layout.push({ rtcStreamUid: rid, region: { xPos: 20, yPos: 20 + (index * 160), width: 320, height: 240, zIndex: 2 }, fillMode: "fit" });
  });

  const allStreamUids = (mainUid !== 0 ? [mainUid] : []).concat(rids.filter(id => id !== mainUid));

  try {
    const region = 'ap';
    const response = await axios.post(`https://api.agora.io/${region}/v1/projects/${AGORA_APP_ID}/rtmp-converters`, {
      converter: {
        name: `luxe_stream_${channelName}`,
        rtmpUrl: rtmpUrl,
        transcodeOptions: {
          rtcChannel: channelName,
          audioOptions: { codecProfile: "LC-AAC", sampleRate: 48000, bitrate: 128, audioChannels: 2, rtcStreamUids: allStreamUids },
          videoOptions: { canvas: { width: parseInt(width || 1280, 10), height: parseInt(height || 720, 10), color: 0 }, layout: layout, bitrate: parseInt(bitrate || 2500, 10), frameRate: parseInt(fps || 30, 10) }
        },
        token: converterToken 
      }
    }, { headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } });
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: 'Failed to start RTMP stream' });
  }
});

app.post('/api/rtmp/stop', async (req, res) => {
  let { converterId } = req.body;
  if (typeof req.body === 'string') {
    try { converterId = JSON.parse(req.body).converterId; } catch (e) {}
  }
  if (!converterId) return res.status(400).json({ error: 'converterId is required' });

  try {
    const region = 'ap';
    const response = await axios.delete(`https://api.agora.io/${region}/v1/projects/${AGORA_APP_ID}/rtmp-converters/${converterId}`, {
      headers: { 'Authorization': getAuthHeader() }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: 'Failed to stop RTMP stream' });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
  });
}

export default app;
