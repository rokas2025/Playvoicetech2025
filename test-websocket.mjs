import WebSocket from 'ws';
import fs from 'fs';

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});
process.env = { ...process.env, ...envVars };

const API_KEY = process.env.ELEVENLABS_API_KEY;

console.log('=== Testing ElevenLabs WebSocket STT ===\n');

// Step 1: Get single-use token
console.log('Step 1: Getting single-use token from STANDARD endpoint...');
const tokenResponse = await fetch(
  'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
  {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
    },
  }
);

if (!tokenResponse.ok) {
  console.error('❌ Failed to get token:', await tokenResponse.text());
  process.exit(1);
}

const { token } = await tokenResponse.json();
console.log(`✅ Token obtained: ${token.substring(0, 20)}...\n`);

// Step 2: Try STANDARD WebSocket WITHOUT model_id
console.log('Step 2: Trying STANDARD WebSocket WITHOUT model_id...');
const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?language_code=lt&commit_strategy=vad&token=${token}`;
console.log(`URL: ${wsUrl.substring(0, 100)}...\n`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket connected!\n');
  
  // Send a test message - try sending raw base64
  console.log('Sending test audio chunk...');
  const base64Audio = 'AAAA'; // Base64 audio
  ws.send(base64Audio);
  console.log('Test message sent (format: raw base64 string)\n');
  
  // Close after 3 seconds
  setTimeout(() => {
    console.log('Closing connection...');
    ws.close();
  }, 3000);
});

ws.on('message', (data) => {
  console.log('📨 Received message:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket closed: ${code} ${reason || '(no reason)'}`);
  process.exit(code === 1000 ? 0 : 1);
});
