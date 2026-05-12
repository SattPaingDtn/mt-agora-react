import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3001/api/playlist?key=agora/recording/MT_Test/03f7acf17547cbd851d92ca515b6d069_MT_Test__uid_s_3108485562__uid_e_av.m3u8');
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers['content-type']);
    console.log("First 10 lines of body:");
    console.log(res.data.split('\n').slice(0, 10).join('\n'));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
