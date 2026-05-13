import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On Vercel, env vars are provided by the platform. 
// Locally, we look for .env in the root directory.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'text/*' }));

const {
  AGORA_APP_ID,
  AGORA_APP_CERTIFICATE,
  AGORA_CUSTOMER_ID,
  AGORA_CUSTOMER_SECRET,
  AGORA_AWS_ACCESS_KEY,
  AGORA_AWS_SECRET_KEY,
  AGORA_AWS_REGION,
  AGORA_AWS_BUCKET
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
  const { channelName, uid, mode } = req.body;
  if (!channelName || !uid) return res.status(400).json({ error: 'channelName and uid are required' });

  const scene = mode === 'web' ? 1 : 0;

  try {
    const acquireUrl = `https://api.sd-rtn.com/v1/apps/${AGORA_APP_ID}/cloud_recording/acquire`;
    const acquirePayload = {
      cname: channelName,
      uid: uid.toString(),
      clientRequest: { resourceExpiredHour: 24, scene }
    };
    
    console.log(`[RECORDING] Acquiring at: ${acquireUrl}`);
    const response = await axios.post(acquireUrl, acquirePayload, { 
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } 
    });
    
    console.log(`[RECORDING] Acquire Success:`, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('[RECORDING ACQUIRE ERROR]:', error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: 'Failed to acquire resource ID' });
  }
});

app.post('/api/recording/start', async (req, res) => {
  const { resourceId, mode, channelName, uid } = req.body;
  if (!resourceId || !mode || !channelName || !uid) return res.status(400).json({ error: 'Missing parameters' });

  const expirationTimeInSeconds = 3600 * 24;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const recordingToken = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID, 
    AGORA_APP_CERTIFICATE, 
    channelName, 
    parseInt(uid, 10), 
    RtcRole.PUBLISHER, 
    privilegeExpiredTs
  );

  const getAgoraRegionId = (region) => {
    if (!isNaN(parseInt(region, 10))) return parseInt(region, 10);
    const map = {
      "us-east-1": 0, "us-east-2": 1, "us-west-1": 2, "us-west-2": 3,
      "eu-west-1": 4, "eu-central-1": 5, "ap-southeast-1": 6, "ap-southeast-2": 7,
      "ap-northeast-1": 8, "sa-east-1": 9, "ca-central-1": 10, "eu-west-2": 11,
      "ap-northeast-2": 12, "ap-south-1": 13
    };
    return map[region] || 8;
  };

  const getFileNamePrefix = (...parts) => {
    return parts
      .filter(Boolean)
      .flatMap((part) => `${part}`.split('/'))
      .map((value) => value.trim())
      .filter(Boolean);
  };

  const storageConfig = {
    vendor: 1,
    region: getAgoraRegionId(AGORA_AWS_REGION),
    bucket: AGORA_AWS_BUCKET,
    accessKey: AGORA_AWS_ACCESS_KEY,
    secretKey: AGORA_AWS_SECRET_KEY,
    fileNamePrefix: getFileNamePrefix('agora', 'recording', channelName)
  };

  try {
    const agoraMode = mode === 'web' ? 'web' : mode;
    const startUrl = `https://api.sd-rtn.com/v1/apps/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/${agoraMode}/start`;

    const startPayload = {
      cname: channelName,
      uid: uid.toString(),
      clientRequest: {
        token: recordingToken,
        recordingConfig: {
          maxIdleTime: 30,
          streamTypes: 2,
          channelType: 0,
          subscribeUidGroup: 0
        },
        recordingFileConfig: {
          avFileType: mode === 'individual' ? ["hls"] : ["hls", "mp4"]
        },
        storageConfig
      }
    };

    if (agoraMode === 'mix') {
      startPayload.clientRequest.recordingConfig.subscribeAudioUids = ["#allstream#"];
      startPayload.clientRequest.recordingConfig.subscribeVideoUids = ["#allstream#"];
      startPayload.clientRequest.recordingConfig.transcodingConfig = { height: 720, width: 1280, bitrate: 1500, fps: 30, mixedVideoLayout: 1, backgroundColor: "#000000" };
    } else if (agoraMode === 'individual') {
      startPayload.clientRequest.recordingConfig.subscribeAudioUids = ["#allstream#"];
      startPayload.clientRequest.recordingConfig.subscribeVideoUids = ["#allstream#"];
    } else if (agoraMode === 'web') {
      const fallbackUrl = req.body.url || req.get('origin') || `https://${req.get('host')}`;

      startPayload.clientRequest.recordingConfig = {
        maxIdleTime: 30,
        streamTypes: 2,
        channelType: 0,
        subscribeUidGroup: 0
      };
      startPayload.clientRequest.recordingFileConfig = {
        avFileType: ["hls", "mp4"]
      };
      startPayload.clientRequest.extensionServiceConfig = {
        errorHandlePolicy: "error_abort",
        extensionServices: [{
          serviceName: "web_recorder_service",
          errorHandlePolicy: "error_abort",
          serviceParam: {
            url: fallbackUrl,
            audioProfile: 0,
            videoWidth: 1280,
            videoHeight: 720,
            maxRecordingHour: 1,
            videoBitrate: 1500,
            videoFps: 15,
            mobile: false,
            maxVideoDuration: 120,
            onhold: false,
            readyTimeout: 0
          }
        }]
      };
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const attemptStart = async (attempt = 1) => {
      const response = await axios.post(startUrl, startPayload, { 
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } 
      });

      if (response.data?.code === 65 && attempt < 3) {
        const backoff = attempt === 1 ? 3000 : 6000;
        console.log(`[RECORDING] Start returned code 65, retrying after ${backoff}ms (attempt ${attempt + 1})`);
        await delay(backoff);
        return attemptStart(attempt + 1);
      }

      return response;
    };

    console.log(`[RECORDING] Starting ${agoraMode} at: ${startUrl}`);
    const response = await attemptStart();

    console.log(`[RECORDING] Start Result:`, response.data);
    if ((response.data?.code !== undefined && response.data?.code !== 0) || !response.data?.sid) {
      return res.status(500).json(response.data || { error: 'Failed to start recording' });
    }

    res.json(response.data);
  } catch (error) {
    console.error('[RECORDING START ERROR]:', error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: 'Failed to start recording' });
  }
});

app.post('/api/recording/stop', async (req, res) => {
  const { resourceId, sid, mode, channelName, uid } = req.body;
  const agoraMode = mode === 'web' ? 'web' : mode;
  
  try {
    const stopUrl = `https://api.sd-rtn.com/v1/apps/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${agoraMode}/stop`;
    console.log(`[RECORDING] Stopping at: ${stopUrl}`);
    
    const response = await axios.post(stopUrl, { cname: channelName, uid: uid.toString(), clientRequest: {} }, { 
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' } 
    });
    
    console.log(`[RECORDING] Stop Success:`, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('[RECORDING STOP ERROR]:', error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: 'Failed to stop recording' });
  }
});

// --- S3 Recording Management ---
const agoraRegionMap = {
  "0": "us-east-1",
  "1": "us-east-2",
  "2": "us-west-1",
  "3": "us-west-2",
  "4": "eu-west-1",
  "5": "eu-central-1",
  "6": "ap-southeast-1",
  "7": "ap-southeast-2",
  "8": "ap-northeast-1",
  "9": "sa-east-1",
  "10": "ca-central-1",
  "11": "eu-west-2",
  "12": "ap-northeast-2",
  "13": "ap-south-1",
  "14": "sa-east-1",
  "15": "us-east-1",
  "16": "us-west-1",
  "17": "eu-central-1",
  "18": "ap-southeast-1"
};

const s3Client = new S3Client({
  region: agoraRegionMap[AGORA_AWS_REGION] || "us-east-1",
  credentials: {
    accessKeyId: AGORA_AWS_ACCESS_KEY,
    secretAccessKey: AGORA_AWS_SECRET_KEY,
  },
});

app.get('/api/recordings', async (req, res) => {
  try {
    console.log(`[BACKEND] Listing recordings from bucket: ${AGORA_AWS_BUCKET}, region: ${agoraRegionMap[AGORA_AWS_REGION] || "us-east-1"}`);
    const command = new ListObjectsV2Command({
      Bucket: AGORA_AWS_BUCKET,
      Prefix: 'agora/recording/',
    });

    const data = await s3Client.send(command);
    if (!data.Contents) return res.json([]);

    // Group files by SID (prefix before the first underscore in the filename, 
    // but Agora structure might be agora/recording/channelName/sid_... )
    // Let's refine the parsing based on common Agora S3 structure

    const recordingsMap = {};

    for (const obj of data.Contents) {
      const key = obj.Key;
      const parts = key.split('/');

      // We expect agora/recording/{channelName}/{mode}/{filename}
      if (parts.length < 5) {
        // Fallback for old structure or unexpected files
        if (parts.length < 4) continue;
        const channelName = parts[2];
        const filename = parts[3];
        const sid = filename.split('_')[0];
        const mode = filename.includes('mix') ? 'mix' : (filename.includes('web') ? 'web' : 'individual');
        addToMap(sid, channelName, mode, obj);
        continue;
      }

      const channelName = parts[2];
      const mode = parts[3];
      const filename = parts[4];
      const sid = filename.split('_')[0];

      addToMap(sid, channelName, mode, obj);
    }

    function addToMap(sid, channelName, mode, obj) {
      if (!recordingsMap[sid]) {
        recordingsMap[sid] = {
          sid,
          channelName,
          mode,
          files: [],
          timestamp: obj.LastModified,
          size: 0
        };
      }
      recordingsMap[sid].files.push({ key: obj.Key, filename: obj.Key.split('/').pop(), size: obj.Size, lastModified: obj.LastModified });
      recordingsMap[sid].size += obj.Size;
      if (obj.LastModified > recordingsMap[sid].timestamp) recordingsMap[sid].timestamp = obj.LastModified;
    }

    // Generate signed URLs for all video files in the grouped recordings (Parallelized for Vercel performance)
    const signingPromises = [];
    for (const sid in recordingsMap) {
      const rec = recordingsMap[sid];
      for (const file of rec.files) {
        if (file.filename.endsWith('.mp4') || file.filename.endsWith('.webm') || file.filename.endsWith('.ts') || file.filename.endsWith('.m3u8')) {
          const getObjCmd = new GetObjectCommand({ Bucket: AGORA_AWS_BUCKET, Key: file.key });
          signingPromises.push(
            getSignedUrl(s3Client, getObjCmd, { expiresIn: 3600 })
              .then(url => { file.url = url; })
              .catch(err => console.error(`Failed to sign URL for ${file.key}:`, err))
          );
        }
      }
    }
    await Promise.all(signingPromises);

    const result = Object.values(recordingsMap).sort((a, b) => b.timestamp - a.timestamp);
    res.json(result);
  } catch (error) {
    console.error('Error listing recordings:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

app.get('/api/playlist', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).send('Missing key');

  try {
    const getObjCmd = new GetObjectCommand({ Bucket: AGORA_AWS_BUCKET, Key: key });
    const response = await s3Client.send(getObjCmd);

    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString('utf-8');

    // Parse the playlist and rewrite segment URLs to point back to our segment proxy
    const lines = content.split('\n');
    const folder = key.split('/').slice(0, -1).join('/');

    const rewrittenLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Create a URL for our segment proxy
        const segmentKey = folder ? `${folder}/${trimmed}` : trimmed;
        return `/api/playlist/segment?key=${encodeURIComponent(segmentKey)}`;
      }
      return line;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewrittenLines.join('\n'));
  } catch (error) {
    console.error(`[PROXY] Error:`, error.message);
    res.status(500).send('Playlist error');
  }
});

app.get('/api/playlist/segment', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).send('Missing key');

  try {
    const getObjCmd = new GetObjectCommand({ Bucket: AGORA_AWS_BUCKET, Key: key });
    const response = await s3Client.send(getObjCmd);

    res.setHeader('Content-Type', response.ContentType || 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Pipe the S3 stream directly to the response
    response.Body.pipe(res);
  } catch (error) {
    console.error(`[SEGMENT] Error:`, error.message);
    res.status(500).send('Segment error');
  }
});

app.delete('/api/recordings/:sid', async (req, res) => {
  const { sid } = req.params;
  console.log(`[BACKEND] Deleting recording with SID: ${sid}`);

  try {
    let allObjectsToDelete = [];
    let continuationToken = null;

    // Paginate through S3 to find all objects with this SID
    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: AGORA_AWS_BUCKET,
        Prefix: 'agora/recording/',
        ContinuationToken: continuationToken
      });

      const listData = await s3Client.send(listCmd);
      if (listData.Contents) {
        const matches = listData.Contents
          .filter(obj => obj.Key.includes(sid))
          .map(obj => ({ Key: obj.Key }));
        allObjectsToDelete = allObjectsToDelete.concat(matches);
      }
      continuationToken = listData.NextContinuationToken;
    } while (continuationToken);

    if (allObjectsToDelete.length === 0) {
      console.log(`[BACKEND] No files found for SID: ${sid}`);
      return res.status(404).json({ error: 'No files found for this SID' });
    }

    console.log(`[BACKEND] Found ${allObjectsToDelete.length} objects to delete for SID ${sid}`);

    // S3 DeleteObjects supports max 1000 keys per request
    for (let i = 0; i < allObjectsToDelete.length; i += 1000) {
      const chunk = allObjectsToDelete.slice(i, i + 1000);
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: AGORA_AWS_BUCKET,
        Delete: { Objects: chunk }
      });
      await s3Client.send(deleteCmd);
    }

    console.log(`[BACKEND] Successfully deleted SID: ${sid}`);
    res.json({ message: 'Deleted successfully', deletedCount: allObjectsToDelete.length });
  } catch (error) {
    console.error(`[BACKEND] Error deleting recording ${sid}:`, error);
    res.status(500).json({ error: 'Failed to delete recording' });
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
        cname: channelName,
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
  const body = typeof req.body === 'string' ? (() => {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  })() : req.body || {};

  const { converterId, id } = body;
  const stopId = converterId || id;
  if (!stopId) return res.status(400).json({ error: 'converterId is required' });

  try {
    const region = 'ap';
    const response = await axios.delete(`https://api.agora.io/${region}/v1/projects/${AGORA_APP_ID}/rtmp-converters/${stopId}`, {
      headers: { 'Authorization': getAuthHeader() }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: 'Failed to stop RTMP stream' });
  }
});

// Start server for local development
app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});

export default app;
