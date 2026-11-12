import mqtt from 'mqtt';
import supabase from '../lib/apiHelpers/_supabase.js';

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

    } catch (e) {
      console.error('[MQTT Worker] Error processing message:', e.message);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT Worker] MQTT Error:', err.message);
  });
}
