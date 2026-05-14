#include <WiFi.h>
#include <HTTPClient.h>

// ===== Configuracao do Wi-Fi e servidor local =====
const char* WIFI_SSID = "Pimentel";
const char* WIFI_PASSWORD = "pimentell";

// Use o IP do computador que esta rodando o Node.js.
// Exemplo no Windows: ipconfig -> Adaptador Wi-Fi -> Endereco IPv4.
const char* SERVER_URL = "http://192.168.0.100:3000/api/readings";
const char* DEVICE_ID = "esp32-hall-01";

// ===== Configuracao do sensor Hall KY-003 =====
const int HALL_PIN = 27;
const int PULSES_PER_REVOLUTION = 1;

// Informe o diametro da roda/eixo caso queira estimar velocidade linear.
const float WHEEL_DIAMETER_METERS = 0.065;
const unsigned long SAMPLE_INTERVAL_MS = 1000;

volatile unsigned long pulseCount = 0;
unsigned long lastSampleTime = 0;

void IRAM_ATTR countPulse() {
  pulseCount++;
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Wi-Fi conectado. IP do ESP32: ");
  Serial.println(WiFi.localIP());
}

float calculateRpm(unsigned long pulses, float elapsedSeconds) {
  if (elapsedSeconds <= 0) {
    return 0;
  }

  float revolutions = pulses / (float)PULSES_PER_REVOLUTION;
  return (revolutions / elapsedSeconds) * 60.0;
}

float calculateSpeedKmh(float rpm) {
  float circumferenceMeters = PI * WHEEL_DIAMETER_METERS;
  float metersPerMinute = rpm * circumferenceMeters;
  return metersPerMinute * 60.0 / 1000.0;
}

void sendReading(float rpm, float speedKmh, unsigned long pulses) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"rpm\":" + String(rpm, 2) + ",";
  payload += "\"speed_kmh\":" + String(speedKmh, 2) + ",";
  payload += "\"pulses\":" + String(pulses);
  payload += "}";

  int statusCode = http.POST(payload);

  Serial.print("Enviado: ");
  Serial.print(payload);
  Serial.print(" | HTTP ");
  Serial.println(statusCode);

  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(HALL_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(HALL_PIN), countPulse, FALLING);

  connectWiFi();
  lastSampleTime = millis();
}

void loop() {
  unsigned long now = millis();

  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    noInterrupts();
    unsigned long pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    float elapsedSeconds = (now - lastSampleTime) / 1000.0;
    float rpm = calculateRpm(pulses, elapsedSeconds);
    float speedKmh = calculateSpeedKmh(rpm);

    sendReading(rpm, speedKmh, pulses);
    lastSampleTime = now;
  }
}
