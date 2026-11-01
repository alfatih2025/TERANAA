import mqtt from 'mqtt';
import supabase from '../lib/apiHelpers/_supabase.js';

export function startMqttWorker() {
  const brokerUrl = process.env.VITE_BROKER_URL || 'wss://a4e9379a555f47669c90f4c69b75eeda.s1.eu.hivemq.cloud:8884/mqtt';
  // Use mqtts port 8883 for NodeJS client instead of wss
  const mqttUrl = brokerUrl.replace('wss://', 'mqtts://').replace(':8884/mqtt', ':8883');
  
  console.log('[MQTT Worker] Connecting to MQTT broker...');
  const client = mqtt.connect(mqttUrl, {
    username: process.env.VITE_MQTT_USERNAME || 'NexaGrowv2',
    password: process.env.VITE_MQTT_PASSWORD || 'NexaGrow12345',
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
