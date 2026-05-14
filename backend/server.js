import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_DEVICE_ID = process.env.DEFAULT_DEVICE_ID || 'esp32-hall-01';

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

let latestReading = {
  device_id: DEFAULT_DEVICE_ID,
  rpm: 0,
  speed_kmh: 0,
  pulses: 0,
  created_at: new Date().toISOString()
};

app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));
app.use(express.json({ limit: '32kb' }));

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeReading(body) {
  return {
    device_id: String(body.device_id || DEFAULT_DEVICE_ID),
    rpm: toNumber(body.rpm),
    speed_kmh: toNumber(body.speed_kmh),
    pulses: Math.max(0, Math.trunc(toNumber(body.pulses))),
    created_at: new Date().toISOString()
  };
}

function broadcastReading(reading) {
  const message = JSON.stringify({ type: 'reading', data: reading });

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

async function saveReading(reading) {
  if (!supabase) {
    console.warn('Supabase nao configurado. Leitura mantida apenas em memoria.');
    return;
  }

  const { error } = await supabase.from('leituras').insert({
    device_id: reading.device_id,
    rpm: reading.rpm,
    speed_kmh: reading.speed_kmh,
    pulses: reading.pulses,
    created_at: reading.created_at
  });

  if (error) {
    console.error('Erro ao salvar no Supabase:', error.message);
  }
}

app.get('/', (_req, res) => {
  res.json({
    name: 'velocimetro-hall-backend-local',
    status: 'online',
    endpoints: ['/api/status', '/api/latest', '/api/readings']
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    online: true,
    supabase_configurado: Boolean(supabase),
    websocket_clientes: wss.clients.size
  });
});

app.get('/api/latest', (_req, res) => {
  res.json(latestReading);
});

app.post('/api/readings', async (req, res) => {
  const reading = normalizeReading(req.body);

  latestReading = reading;
  broadcastReading(reading);
  await saveReading(reading);

  res.status(201).json({ ok: true, data: reading });
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'reading', data: latestReading }));
});

httpServer.listen(PORT, () => {
  console.log(`Backend local rodando em http://localhost:${PORT}`);
  console.log(`WebSocket disponivel em ws://localhost:${PORT}`);
});
