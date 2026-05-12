import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const {
  AGORA_AWS_ACCESS_KEY,
  AGORA_AWS_SECRET_KEY,
  AGORA_AWS_REGION,
  AGORA_AWS_BUCKET
} = process.env;

const s3Client = new S3Client({
  region: "ap-northeast-1",
  credentials: {
    accessKeyId: AGORA_AWS_ACCESS_KEY,
    secretAccessKey: AGORA_AWS_SECRET_KEY,
  },
});

async function test() {
  const key = 'agora/recording/MT_Test/03f7acf17547cbd851d92ca515b6d069_MT_Test__uid_s_3108485562__uid_e_av.m3u8';
  try {
    const getObjCmd = new GetObjectCommand({ Bucket: AGORA_AWS_BUCKET, Key: key });
    const response = await s3Client.send(getObjCmd);
    console.log("Response received");
    // const content = await response.Body.transformToString(); // Test if this exists
    // console.log("Content length:", content.length);
  } catch (err) {
    console.error("Error:", err.message);
    console.error(err);
  }
}

test();
