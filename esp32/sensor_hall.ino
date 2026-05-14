#include <WiFi.h>
#include <HTTPClient.h>

const char* nomeDaRede = "Alexandre";
const char* senhaDaRede = "xawc8090";

const char* enderecoServidor = "http://10.68.52.11:3000/api/readings";
const char* nomeDoDispositivo = "esp32-hall-01";

const int pinoSensorHall = 4;
const int pulsosPorVolta = 1;

const float diametroDaRodaEmMetros = 0.065;
const unsigned long intervaloDeLeitura = 1000;

volatile unsigned long totalDePulsos = 0;
unsigned long tempoDaUltimaLeitura = 0;

void IRAM_ATTR contarPulso() {
  totalDePulsos++;
}

void conectarNoWifi() {
  WiFi.begin(nomeDaRede, senhaDaRede);
  Serial.print("Conectando no Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("ESP32 conectado. IP: ");
  Serial.println(WiFi.localIP());
}

float calcularRpm(unsigned long pulsos, float segundos) {
  if (segundos <= 0) {
    return 0;
  }

  float voltas = pulsos / (float)pulsosPorVolta;
  return (voltas / segundos) * 60.0;
}

float calcularVelocidadeEmKmh(float rpm) {
  float circunferenciaDaRoda = PI * diametroDaRodaEmMetros;
  float metrosPorMinuto = rpm * circunferenciaDaRoda;

  return metrosPorMinuto * 60.0 / 1000.0;
}

void enviarDados(float rpm, float velocidadeEmKmh, unsigned long pulsos) {
  if (WiFi.status() != WL_CONNECTED) {
    conectarNoWifi();
  }

  HTTPClient requisicao;
  requisicao.begin(enderecoServidor);
  requisicao.addHeader("Content-Type", "application/json");

  String dados = "{";
  dados += "\"id_dispositivo\":\"" + String(nomeDoDispositivo) + "\",";
  dados += "\"rpm\":" + String(rpm, 2) + ",";
  dados += "\"velocidade_kmh\":" + String(velocidadeEmKmh, 2) + ",";
  dados += "\"pulsos\":" + String(pulsos);
  dados += "}";

  int respostaDoServidor = requisicao.POST(dados);

  Serial.print("Dados enviados: ");
  Serial.print(dados);
  Serial.print(" | resposta: ");
  Serial.println(respostaDoServidor);

  requisicao.end();
}

void setup() {
  Serial.begin(115200);

  pinMode(pinoSensorHall, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pinoSensorHall), contarPulso, FALLING);

  conectarNoWifi();
  tempoDaUltimaLeitura = millis();
}

void loop() {
  unsigned long tempoAtual = millis();

  if (tempoAtual - tempoDaUltimaLeitura >= intervaloDeLeitura) {
    noInterrupts();
    unsigned long pulsosMedidos = totalDePulsos;
    totalDePulsos = 0;
    interrupts();

    float segundosPassados = (tempoAtual - tempoDaUltimaLeitura) / 1000.0;
    float rpm = calcularRpm(pulsosMedidos, segundosPassados);
    float velocidadeEmKmh = calcularVelocidadeEmKmh(rpm);

    enviarDados(rpm, velocidadeEmKmh, pulsosMedidos);
    tempoDaUltimaLeitura = tempoAtual;
  }
}
