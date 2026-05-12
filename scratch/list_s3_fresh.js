import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const {
  AGORA_AWS_ACCESS_KEY,
  AGORA_AWS_SECRET_KEY,
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
  try {
    const command = new ListObjectsV2Command({ Bucket: AGORA_AWS_BUCKET, Prefix: 'agora/recording/' });
    const data = await s3Client.send(command);
    console.log(`Found ${data.Contents?.length || 0} objects.`);
    if (data.Contents) {
      data.Contents.slice(0, 50).forEach(obj => console.log(`- ${obj.Key}`));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
