import { useCallback, useState, useEffect, useRef } from 'react';
import { subscribeMqttStatus, getNodeSensorSnapshot, type MqttSensorSnapshot } from '../services/mqtt';

export interface NodeSensorData {
  node_id: number;
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  soil_temp?: number | null;
  ph?: number | null;
  flow_rate?: number | null;
  total_water?: number | null;
  session_water?: number | null;
  valve_status?: string | null;
  fwi?: number | null;
  fwi_level?: number | null;
  fwi_status?: string | null;
  ffmc?: number | null;
  dmc?: number | null;
  dc?: number | null;
  isi?: number | null;
  bui?: number | null;
  created_at: string;
}

const REFRESH_INTERVAL_MS = 10000;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNodeData(row: Record<string, unknown>): NodeSensorData | null {
  const rawId = row.node_id ?? String(row.device_id ?? '').replace('node_', '');
  const nodeId = rawId === 0 || rawId === '0' || row.device_id === 'ESP32_Gateway' ? 0 : toNumber(rawId);
  if (nodeId !== 0 && nodeId !== 1 && nodeId !== 2 && nodeId !== 3) return null;

  const temp = toNumber(row.temperature);
  const hum = toNumber(row.humidity);
  const soil = toNumber(row.soil_moisture ?? row.soil);
  const soilTemp = toNumber(row.soil_temp ?? row.battery);
  const fwi = toNumber(row.fwi ?? row.fwi_score);
  const ph = toNumber(row.ph);
  const flowRate = toNumber(row.flow_rate);
  const totalWater = toNumber(row.total_water ?? row.total_liters);
  const sessionWater = toNumber(row.session_water ?? row.session_liters);
  const valveStatus = typeof row.valve_status === 'string' ? row.valve_status : (typeof row.active_valve === 'string' ? row.active_valve : null);

  // Jika semua nilai kosong/null, abaikan agar tidak menimpa data yang aktif
  if (temp === null && hum === null && soil === null && soilTemp === null && fwi === null && ph === null && flowRate === null && totalWater === null) {
    return null;
  }

  return {
    node_id: nodeId,
    temperature: temp,
    humidity: hum,
    soil_moisture: soil,
    soil_temp: soilTemp,
    ph,
    flow_rate: flowRate,
    total_water: totalWater,
    session_water: sessionWater,
    valve_status: valveStatus,
    fwi: fwi,
    fwi_level: toNumber(row.fwi_level),
    fwi_status: typeof row.fwi_status === 'string' ? row.fwi_status : null,
    ffmc: toNumber(row.ffmc),
    dmc: toNumber(row.dmc),
    dc: toNumber(row.dc),
    isi: toNumber(row.isi),
    bui: toNumber(row.bui),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function snapshotToNodeData(snap: MqttSensorSnapshot): NodeSensorData | null {
  if (snap.node_id !== 0 && snap.node_id !== 1 && snap.node_id !== 2 && snap.node_id !== 3) return null;

  return {
    node_id: snap.node_id,
    temperature: snap.temperature,
    humidity: snap.humidity,
    soil_moisture: snap.soil_moisture,
    soil_temp: snap.soil_temp ?? null,
    ph: snap.ph ?? null,
    flow_rate: snap.flow_rate ?? null,
    total_water: snap.total_water ?? null,
    session_water: snap.session_water ?? null,
    valve_status: snap.valve_status ?? null,
    fwi: snap.fwi ?? null,
    fwi_level: snap.fwi_level ?? null,
    fwi_status: snap.fwi_status ?? null,
    ffmc: snap.ffmc ?? null,
    dmc: snap.dmc ?? null,
    dc: snap.dc ?? null,
    isi: snap.isi ?? null,
    bui: snap.bui ?? null,
    created_at: snap.updatedAt || new Date().toISOString(),
  };
}

/** Bandingkan nilai sensor numerik agar tidak re-render berlebihan jika nilai identik */
function isSameValues(a: NodeSensorData | null, b: NodeSensorData | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.node_id === b.node_id &&
    a.temperature === b.temperature &&
    a.humidity === b.humidity &&
    a.soil_moisture === b.soil_moisture &&
    a.soil_temp === b.soil_temp &&
    a.ph === b.ph &&
    a.flow_rate === b.flow_rate &&
    a.total_water === b.total_water &&
    a.session_water === b.session_water &&
    a.valve_status === b.valve_status &&
    a.fwi === b.fwi &&
    a.fwi_level === b.fwi_level
  );
}

function loadInitialNode(nodeId: number): NodeSensorData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`teranova_node_${nodeId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeNodeData(parsed);
    }
  } catch {}
  return null;
}

export function useMultiNodeSensorData() {
  const initial0 = loadInitialNode(0);
  const initial1 = loadInitialNode(1);
  const initial2 = loadInitialNode(2);
  const initial3 = loadInitialNode(3);

  const [gateway, setGateway] = useState<NodeSensorData | null>(initial0);
  const [node1, setNode1] = useState<NodeSensorData | null>(initial1);
  const [node2, setNode2] = useState<NodeSensorData | null>(initial2);
  const [node3, setNode3] = useState<NodeSensorData | null>(initial3);
  const [loading, setLoading] = useState(true);

  // Ref untuk perbandingan cepat tanpa re-render
  const gatewayRef = useRef<NodeSensorData | null>(initial0);
  const node1Ref = useRef<NodeSensorData | null>(initial1);
  const node2Ref = useRef<NodeSensorData | null>(initial2);
  const node3Ref = useRef<NodeSensorData | null>(initial3);

  const applyNodeData = useCallback((next: NodeSensorData) => {
    if (!next) return;

    if (next.node_id === 0) {
      const prev = gatewayRef.current;
      const merged: NodeSensorData = {
        ...next,
        ph: next.ph ?? prev?.ph ?? null,
        flow_rate: next.flow_rate ?? prev?.flow_rate ?? null,
        total_water: next.total_water ?? prev?.total_water ?? null,
        session_water: next.session_water ?? prev?.session_water ?? null,
        valve_status: next.valve_status ?? prev?.valve_status ?? null,
      };
      if (isSameValues(prev, merged)) return;
      gatewayRef.current = merged;
      setGateway(merged);
      try { localStorage.setItem('teranova_node_0', JSON.stringify(merged)); } catch {}
    } else if (next.node_id === 1) {
      const prev = node1Ref.current;
      const merged: NodeSensorData = {
        ...next,
        temperature: next.temperature ?? prev?.temperature ?? null,
        humidity: next.humidity ?? prev?.humidity ?? null,
        soil_moisture: next.soil_moisture ?? prev?.soil_moisture ?? null,
      };
      if (isSameValues(prev, merged)) return;
      node1Ref.current = merged;
      setNode1(merged);
      try { localStorage.setItem('teranova_node_1', JSON.stringify(merged)); } catch {}
    } else if (next.node_id === 2) {
      const prev = node2Ref.current;
      const merged: NodeSensorData = {
        ...next,
        temperature: next.temperature ?? prev?.temperature ?? null,
        humidity: next.humidity ?? prev?.humidity ?? null,
        soil_moisture: next.soil_moisture ?? prev?.soil_moisture ?? null,
      };
      if (isSameValues(prev, merged)) return;
      node2Ref.current = merged;
      setNode2(merged);
      try { localStorage.setItem('teranova_node_2', JSON.stringify(merged)); } catch {}
    } else if (next.node_id === 3) {
      const prev = node3Ref.current;
      const merged: NodeSensorData = {
        ...next,
        temperature: next.temperature ?? prev?.temperature ?? null,
        humidity: next.humidity ?? prev?.humidity ?? null,
        soil_temp: next.soil_temp ?? prev?.soil_temp ?? null,
        fwi: next.fwi ?? prev?.fwi ?? null,
        fwi_level: next.fwi_level ?? prev?.fwi_level ?? null,
      };
      if (isSameValues(prev, merged)) return;
      node3Ref.current = merged;
      setNode3(merged);
      try { localStorage.setItem('teranova_node_3', JSON.stringify(merged)); } catch {}
    }
  }, []);

  // 1. Initial fetch + polling fallback dari Vercel/Supabase
  useEffect(() => {
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/sensor?latest=nodes', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const row of data) {
              if (cancelled || !row || typeof row !== 'object') continue;
              const normalized = normalizeNodeData(row as Record<string, unknown>);
              if (normalized) applyNodeData(normalized);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch node data:', e instanceof Error ? e.message : e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLatest();
    const intervalId = window.setInterval(fetchLatest, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyNodeData]);

  // 2. Real-time MQTT — baca per-node snapshot (termasuk Gateway Node 0 dan Node 3)
  useEffect(() => {
    const unsubscribe = subscribeMqttStatus(() => {
      const snap0 = getNodeSensorSnapshot(0);
      const snap1 = getNodeSensorSnapshot(1);
      const snap2 = getNodeSensorSnapshot(2);
      const snap3 = getNodeSensorSnapshot(3);

      if (snap0) {
        const data = snapshotToNodeData(snap0);
        if (data) applyNodeData(data);
      }
      if (snap1) {
        const data = snapshotToNodeData(snap1);
        if (data) applyNodeData(data);
      }
      if (snap2) {
        const data = snapshotToNodeData(snap2);
        if (data) applyNodeData(data);
      }
      if (snap3) {
        const data = snapshotToNodeData(snap3);
        if (data) applyNodeData(data);
      }
    });

    return () => { unsubscribe(); };
  }, [applyNodeData]);

  // Status apakah Node 3 aktif dan sedang mengirimkan data (dalam 30 menit terakhir)
  const isNode3Active = Boolean(
    node3 &&
    (node3.temperature !== null || node3.humidity !== null || node3.soil_moisture !== null || node3.soil_temp !== null || node3.fwi !== null) &&
    (!node3.created_at || (new Date().getTime() - new Date(node3.created_at).getTime() < 30 * 60 * 1000))
  );

  // Node3: derived values dari rata-rata Node1 & Node2 (soil_moisture, temperature, humidity)
  const node3WithDerivedValues = node3 ? (() => {
    const avgSoil = (node1?.soil_moisture != null && node2?.soil_moisture != null)
      ? (node1.soil_moisture + node2.soil_moisture) / 2
      : (node1?.soil_moisture ?? node2?.soil_moisture ?? node3.soil_moisture);

    const avgTemp = (node1?.temperature != null && node2?.temperature != null)
      ? (node1.temperature + node2.temperature) / 2
      : (node1?.temperature ?? node2?.temperature ?? node3.temperature);

    const avgHum = (node1?.humidity != null && node2?.humidity != null)
      ? (node1.humidity + node2.humidity) / 2
      : (node1?.humidity ?? node2?.humidity ?? node3.humidity);

    return {
      ...node3,
      soil_moisture: avgSoil,
      temperature: node3.temperature ?? avgTemp,  // prioritas data real node3 jika ada
      humidity: node3.humidity ?? avgHum,
    };
  })() : null;

  return { node1, node2, node3: node3WithDerivedValues, gateway, loading, isNode3Active };
}
