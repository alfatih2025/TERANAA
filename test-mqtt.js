import mqtt from 'mqtt';

const configuredBroker = process.env.MQTT_SERVER?.trim();
const username = process.env.MQTT_USERNAME?.trim();
const password = process.env.MQTT_PASSWORD;
if (!configuredBroker || !username || !password) {
  throw new Error('Set MQTT_SERVER, MQTT_USERNAME, and MQTT_PASSWORD before running this test');
}

const defaultPort = Number(process.env.MQTT_PORT || 8883);
const brokerUrl = /^wss?:\/\//i.test(configuredBroker)
  ? configuredBroker.replace(/^wss?:\/\//i, 'mqtts://').replace(/:8884\/mqtt\/?$/i, ':8883')
  : /^[a-z][a-z\d+.-]*:\/\//i.test(configuredBroker)
    ? configuredBroker
    : /:\d+$/.test(configuredBroker)
      ? `mqtts://${configuredBroker}`
      : `mqtts://${configuredBroker}:${defaultPort}`;

const client = mqtt.connect(brokerUrl, {
  username,
  password
});

client.on('error', (err) => {
  console.error('MQTT connection failed:', err.message);
  client.end(true);
  process.exitCode = 1;
});

client.on('connect', () => {
  console.log('Connected, sending test data...');
  const payload = {
    node_id: 1,
    temperature: 25.5,
    humidity: 60.2,
    soil_moisture: 45.1,
    created_at: new Date().toISOString()
  };
  client.publish('sproutai/sensor/node/1', JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) console.error(err);
    else console.log('Test data sent successfully!');
    client.end();
  });
});
