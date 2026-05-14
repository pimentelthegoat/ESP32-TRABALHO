# Backend local

API local em Node.js para receber dados do ESP32, salvar no Supabase e transmitir leituras em tempo real para o frontend hospedado na Vercel.

## Rodar

```powershell
cd backend
npm.cmd install
copy .env.example .env
npm.cmd run dev
```

Edite o `.env` com suas credenciais do Supabase.

## Rotas

- `GET /`: informacoes basicas da API.
- `GET /api/status`: status do backend.
- `GET /api/latest`: ultima leitura recebida.
- `POST /api/readings`: rota usada pelo ESP32.
- `ws://localhost:3000`: canal em tempo real usado pelo frontend.
