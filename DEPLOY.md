# Deploy: Netlify + Render (SQLite)

## 1) Backend no Render
- Suba este projeto para um repositório GitHub.
- No Render, crie um novo `Web Service` usando o repositório.
- Ou importe `render.yaml`.
- Configure a variável `ALLOWED_ORIGINS` com sua URL do Netlify.
  Exemplo: `https://seu-site.netlify.app`
- Faça deploy e copie a URL final do backend.

## 2) Frontend no Netlify
- No arquivo `config.js`, preencha:

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://seu-backend.onrender.com"
};
```

- Suba para GitHub.
- No Netlify, conecte o repositório e faça deploy (publish root `.`).

## 3) Validar
- Abra o site no Netlify.
- Crie uma tarefa.
- Atualize a página e confira se os dados persistem.

## Execução local
```powershell
node server.js
```
Acesso: `http://127.0.0.1:3000`
