import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { AGORA_APP_ID, AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET } = process.env;

const getAuthHeader = () => {
  return 'Basic ' + Buffer.from(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`).toString('base64');
};

async function testAgoraCreds() {
  try {
    console.log('Testing Agora Credentials...');
    const res = await axios.get(`https://api.agora.io/v1/projects/${AGORA_APP_ID}/recording/usage`, {
      headers: { 'Authorization': getAuthHeader() }
    });
    console.log('Credentials are VALID. Usage data:', res.data);
  } catch (err) {
    console.error('Credentials FAILED:', err.response?.data || err.message);
  }
}

testAgoraCreds();
