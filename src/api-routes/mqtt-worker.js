import mqtt from 'mqtt';
import supabase from '../lib/apiHelpers/_supabase.js';

const LARAVEL_API_URL = process.env.LARAVEL_API_URL?.trim();
const LARAVEL_API_KEY = process.env.LARAVEL_API_KEY?.trim();

export function startMqttWorker() {
  const configuredBroker = process.env.MQTT_SERVER?.trim();
  const username = process.env.MQTT_USERNAME?.trim();
  const password = process.env.MQTT_PASSWORD;
  if (!configuredBroker || !username || !password) {
    console.error('[MQTT Worker] MQTT_SERVER, MQTT_USERNAME, and MQTT_PASSWORD are required');
    return;
  }

  const defaultPort = Number(process.env.MQTT_PORT || 8883);
  const mqttUrl = /^wss?:\/\//i.test(configuredBroker)
    ? configuredBroker.replace(/^wss?:\/\//i, 'mqtts://').replace(/:8884\/mqtt\/?$/i, ':8883')
    : /^[a-z][a-z\d+.-]*:\/\//i.test(configuredBroker)
      ? configuredBroker
      : /:\d+$/.test(configuredBroker)
        ? `mqtts://${configuredBroker}`
        : `mqtts://${configuredBroker}:${defaultPort}`;
  
  console.log('[MQTT Worker] Connecting to MQTT broker...');
  const client = mqtt.connect(mqttUrl, {
    username,
    password,
    connectTimeout: 5000,
    reconnectPeriod: 5000,
  });

  if (!LARAVEL_API_URL || !LARAVEL_API_KEY) {
    console.warn('[MQTT Worker] Laravel forwarding is disabled; server-only URL/key are not configured');
  }

  client.on('connect', () => {
    console.log('[MQTT Worker] Connected to MQTT broker. Subscribing to sensor topics...');
    client.subscribe('sproutai/sensor/node/+', { qos: 1 });
  });

  client.on('message', async (topic, message) => {
    try {
      const payloadStr = message.toString();
      const payload = JSON.parse(payloadStr);

      // Verify topic format
      const match = topic.match(/^sproutai\/sensor\/node\/(\d+)$/);
      if (!match) return;

      const nodeId = Number(payload.node_id);
      if (!nodeId) return;

      const sensorPayload = {
        node_id: nodeId,
        temperature: payload.temperature,
        humidity: payload.humidity,
        soil_moisture: payload.soil_moisture ?? payload.soil,
      };
      
      if (payload.created_at) {
         sensorPayload.created_at = payload.created_at;
      }

      // 1. Simpan ke Database Web (Supabase)
      const { error } = await supabase.from('sensor_data').insert(sensorPayload);
      if (error) {
        console.error('[MQTT Worker] Supabase Insert Error:', error.message);
      } else {
        console.log(`[MQTT Worker] Saved data for node ${nodeId} to Supabase`);
      }

      // 2. TERUSKAN KE LARAVEL RAILWAY (Server-to-Server)
      // Tambahkan ke antrean untuk dikirim secara batch
      if (LARAVEL_API_URL && LARAVEL_API_KEY) {
        laravelBuffer.push(sensorPayload);
      }

    } catch (e) {
      console.error('[MQTT Worker] Error processing message:', e.message);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT Worker] MQTT Error:', err.message);
  });
}

// ============================================================================
// LOGIKA BATCHING & BACKOFF KE LARAVEL
// ============================================================================
let laravelBuffer = [];
let backoffDelayMs = 0;
let lastRateLimitAt = 0;
let isSending = false;

setInterval(async () => {
  if (laravelBuffer.length === 0 || isSending) return;

  // Jika sedang dalam masa hukuman (backoff) karena 429
  if (backoffDelayMs > 0 && (Date.now() - lastRateLimitAt) < backoffDelayMs) {
    return; // Tunggu
  }

  isSending = true;
  
  // Ambil maksimal 10 data sekaligus dari antrean
  const batchSize = Math.min(laravelBuffer.length, 10);
  const batchPayload = laravelBuffer.slice(0, batchSize);

  // Send items one by one to avoid 500 Error in Laravel if it doesn't support arrays
  let sentCount = 0;
  for (const item of batchPayload) {
    try {
      const laravelRes = await fetch(LARAVEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LARAVEL_API_KEY
        },
        body: JSON.stringify(item)
      });
      
      if (laravelRes.status === 429) {
        backoffDelayMs = backoffDelayMs === 0 ? 15000 : Math.min(backoffDelayMs * 2, 300000);
        lastRateLimitAt = Date.now();
        console.warn(`[MQTT Worker] Laravel 429 Too Many Requests. Backoff for ${backoffDelayMs/1000}s`);
        break; // Stop sending this batch, will retry remaining next time
      } else if (!laravelRes.ok) {
        console.warn(`[MQTT Worker] Forward to Laravel failed with status ${laravelRes.status}`);
        sentCount++; // count as processed so we don't get stuck
      } else {
        sentCount++;
        backoffDelayMs = 0; // reset backoff on success
      }
    } catch (fetchErr) {
      console.error('[MQTT Worker] Failed to reach Laravel:', fetchErr.message);
      break; // stop on network error
    }
  }

  // Remove processed items from buffer
  if (sentCount > 0) {
    console.log(`[MQTT Worker] Processed ${sentCount} records to Laravel`);
    laravelBuffer = laravelBuffer.slice(sentCount);
  }
  
  isSending = false;
  
  // Keamanan jika buffer terlalu penuh (misal server Laravel mati berhari-hari)
  if (laravelBuffer.length > 500) {
    console.warn('[MQTT Worker] Laravel buffer full! Dropping oldest 100 records');
    laravelBuffer = laravelBuffer.slice(100);
  }
}, 5000); // Cek dan kirim setiap 5 detik
