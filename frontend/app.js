const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const BACKEND_STORAGE_KEY = 'velocimetroBackendUrl';
const MAX_SPEED_KMH = 120;

const connectionStatus = document.querySelector('#connectionStatus');
const backendUrlInput = document.querySelector('#backendUrl');
const saveBackendUrlButton = document.querySelector('#saveBackendUrl');
const needle = document.querySelector('#needle');
const speedValue = document.querySelector('#speedValue');
const rpmValue = document.querySelector('#rpmValue');
const pulseValue = document.querySelector('#pulseValue');
const deviceValue = document.querySelector('#deviceValue');
const timeValue = document.querySelector('#timeValue');

let socket;
let reconnectTimer;
let backendUrl = localStorage.getItem(BACKEND_STORAGE_KEY) || DEFAULT_BACKEND_URL;

backendUrlInput.value = backendUrl;

function cleanBackendUrl(value) {
  return value.trim().replace(/\/$/, '');
}

function setConnectionState(isOnline) {
  connectionStatus.classList.toggle('online', isOnline);
  connectionStatus.classList.toggle('offline', !isOnline);
  connectionStatus.lastChild.textContent = isOnline ? ' online' : ' offline';
}

function getWebSocketUrl() {
  return backendUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

function formatTime(isoDate) {
  if (!isoDate) {
    return '--:--:--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(isoDate));
}

function updateDashboard(reading) {
  const rpm = Number(reading.rpm || 0);
  const speed = Number(reading.speed_kmh || 0);
  const pulses = Number(reading.pulses || 0);
  const limitedSpeed = Math.min(Math.max(speed, 0), MAX_SPEED_KMH);
  const angle = -135 + (limitedSpeed / MAX_SPEED_KMH) * 270;

  needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
  speedValue.textContent = speed.toFixed(1);
  rpmValue.textContent = Math.round(rpm).toString();
  pulseValue.textContent = pulses.toString();
  deviceValue.textContent = reading.device_id || '--';
  timeValue.textContent = formatTime(reading.created_at);
}

async function loadLatestReading() {
  try {
    const response = await fetch(`${backendUrl}/api/latest`);
    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    console.warn('Nao foi possivel carregar a ultima leitura.', error);
  }
}

function connectWebSocket() {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(getWebSocketUrl());

  socket.addEventListener('open', () => {
    setConnectionState(true);
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'reading') {
      updateDashboard(message.data);
    }
  });

  socket.addEventListener('close', () => {
    setConnectionState(false);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWebSocket, 2000);
  });

  socket.addEventListener('error', () => {
    setConnectionState(false);
    socket.close();
  });
}

function reconnectToBackend() {
  backendUrl = cleanBackendUrl(backendUrlInput.value || DEFAULT_BACKEND_URL);
  backendUrlInput.value = backendUrl;
  localStorage.setItem(BACKEND_STORAGE_KEY, backendUrl);

  clearTimeout(reconnectTimer);
  loadLatestReading();
  connectWebSocket();
}

saveBackendUrlButton.addEventListener('click', reconnectToBackend);
backendUrlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    reconnectToBackend();
  }
});

loadLatestReading();
connectWebSocket();
