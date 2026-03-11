# Deploy: Render com Angular + SQLite

## 1) Deploy principal no Render
- Suba este projeto para um repositório GitHub.
- No Render, crie um novo `Web Service` usando o repositório ou importe `render.yaml`.
- O build instala o frontend Angular e publica tudo no mesmo serviço.
- Faça deploy e abra a URL final do serviço.

## 2) Validar
- Abra o site no Render.
- Crie uma tarefa.
- Atualize a página e confira se os dados persistem.

## Execução local
```powershell
npm run client:install
npm run build
node server.js
```

Acesso: `http://127.0.0.1:3000`
