const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "tasks.db");
const ANGULAR_DIST_DIR = path.join(ROOT, "angular-client", "dist", "angular-client", "browser");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    projeto TEXT NOT NULL,
    tipo TEXT NOT NULL,
    prioridade TEXT NOT NULL,
    descricao TEXT NOT NULL,
    imagem TEXT,
    criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS board_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    elements TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

function ensureTaskStatusColumns() {
  const columns = db.prepare("PRAGMA table_info(tasks)").all();
  const names = new Set(columns.map((c) => c.name));

  if (!names.has("em_execucao")) {
    db.exec("ALTER TABLE tasks ADD COLUMN em_execucao INTEGER NOT NULL DEFAULT 0");
  }

  if (!names.has("concluida")) {
    db.exec("ALTER TABLE tasks ADD COLUMN concluida INTEGER NOT NULL DEFAULT 0");
  }
}

ensureTaskStatusColumns();

const hasBoard = db.prepare("SELECT COUNT(*) AS total FROM board_state WHERE id = 1").get();
if (hasBoard.total === 0) {
  db.prepare("INSERT INTO board_state (id, elements) VALUES (1, '[]')").run();
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;

  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

function sendJSON(req, res, status, payload) {
  applyCors(req, res);
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(req, res, status, text) {
  applyCors(req, res);
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) reject(new Error("Payload muito grande"));
    });

    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });

    req.on("error", reject);
  });
}

function toBoolInt(value) {
  return value ? 1 : 0;
}

function mapTask(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    projeto: row.projeto,
    tipo: row.tipo,
    prioridade: row.prioridade,
    descricao: row.descricao,
    imagem: row.imagem,
    criadaEm: row.criada_em,
    emExecucao: !!row.em_execucao,
    concluida: !!row.concluida,
  };
}

function parseTaskStatusFromBody(body) {
  const emExecucao = Boolean(body.emExecucao);
  const concluida = Boolean(body.concluida);
  if (emExecucao && concluida) {
    throw new Error("Uma tarefa não pode estar em execução e concluída ao mesmo tempo.");
  }
  return { emExecucao, concluida };
}

function getTaskById(id) {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? mapTask(row) : null;
}

async function handleAPI(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const rows = db.prepare("SELECT * FROM tasks ORDER BY datetime(criada_em) DESC").all().map(mapTask);
    sendJSON(req, res, 200, rows);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    try {
      const body = await parseBody(req);
      const titulo = String(body.titulo || "").trim();
      const projeto = String(body.projeto || "").trim();
      const tipo = String(body.tipo || "").trim();
      const prioridade = String(body.prioridade || "").trim();
      const descricao = String(body.descricao || "").trim();
      const imagem = body.imagem ? String(body.imagem) : null;

      if (!titulo || !projeto || !tipo || !prioridade || !descricao) {
        sendJSON(req, res, 400, { error: "Campos obrigatórios ausentes." });
        return true;
      }

      const id = randomUUID();
      const criadaEm = new Date().toISOString();

      db.prepare(
        `INSERT INTO tasks (id, titulo, projeto, tipo, prioridade, descricao, imagem, criada_em, em_execucao, concluida)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
      ).run(id, titulo, projeto, tipo, prioridade, descricao, imagem, criadaEm);

      sendJSON(req, res, 201, {
        id,
        titulo,
        projeto,
        tipo,
        prioridade,
        descricao,
        imagem,
        criadaEm,
        emExecucao: false,
        concluida: false,
      });
      return true;
    } catch (error) {
      sendJSON(req, res, 400, { error: error.message });
      return true;
    }
  }

  if (req.method === "PATCH" && /^\/api\/tasks\/[^/]+\/status$/.test(url.pathname)) {
    try {
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const body = await parseBody(req);
      const { emExecucao, concluida } = parseTaskStatusFromBody(body);

      const exists = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
      if (!exists) {
        sendJSON(req, res, 404, { error: "Tarefa não encontrada." });
        return true;
      }

      db.prepare("UPDATE tasks SET em_execucao = ?, concluida = ? WHERE id = ?").run(
        toBoolInt(emExecucao),
        toBoolInt(concluida),
        id
      );

      sendJSON(req, res, 200, getTaskById(id));
      return true;
    } catch (error) {
      sendJSON(req, res, 400, { error: error.message });
      return true;
    }
  }

  if (req.method === "DELETE" && /^\/api\/tasks\/[^/]+$/.test(url.pathname)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (result.changes === 0) {
      sendJSON(req, res, 404, { error: "Tarefa não encontrada." });
      return true;
    }
    sendJSON(req, res, 200, { ok: true });
    return true;
  }

  if (req.method === "DELETE" && url.pathname === "/api/tasks") {
    db.prepare("DELETE FROM tasks").run();
    sendJSON(req, res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/board") {
    const row = db.prepare("SELECT elements FROM board_state WHERE id = 1").get();
    let elements = [];
    try {
      elements = JSON.parse(row.elements || "[]");
    } catch {
      elements = [];
    }
    sendJSON(req, res, 200, { elements });
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/board") {
    try {
      const body = await parseBody(req);
      const elements = Array.isArray(body.elements) ? body.elements : [];

      db.prepare(
        `UPDATE board_state
         SET elements = ?, updated_at = ?
         WHERE id = 1`
      ).run(JSON.stringify(elements), new Date().toISOString());

      sendJSON(req, res, 200, { ok: true });
      return true;
    } catch (error) {
      sendJSON(req, res, 400, { error: error.message });
      return true;
    }
  }

  return false;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".mjs") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function safeResolve(rootDir, urlPath) {
  const relative = urlPath.replace(/^[/\\]+/, "");
  const target = path.resolve(rootDir, relative);
  if (!target.startsWith(rootDir)) return null;
  return target;
}

function serveStatic(req, res, url) {
  if (!fs.existsSync(ANGULAR_DIST_DIR)) {
    return sendText(req, res, 503, "Frontend Angular não encontrado. Execute o build do cliente antes de iniciar o servidor.");
  }

  const staticRoot = ANGULAR_DIST_DIR;
  const reqPath = url.pathname === "/" ? "/index.html" : url.pathname;

  let filePath = safeResolve(staticRoot, reqPath);
  if (!filePath) return sendText(req, res, 403, "Acesso negado.");

  const missing = !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory();
  if (missing) {
    filePath = path.join(ANGULAR_DIST_DIR, "index.html");
  }

  const data = fs.readFileSync(filePath);
  applyCors(req, res);
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": data.length,
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      const handled = await handleAPI(req, res, url);
      if (!handled) sendJSON(req, res, 404, { error: "Endpoint não encontrado." });
    } catch (error) {
      sendJSON(req, res, 500, { error: "Erro interno", detail: String(error.message || error) });
    }
    return;
  }

  if (req.method !== "GET") return sendText(req, res, 405, "Método não permitido.");
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor ativo em http://${HOST}:${PORT}`);
  console.log(`Banco SQLite: ${DB_PATH}`);
  console.log(`Frontend Angular esperado em: ${ANGULAR_DIST_DIR}`);
  if (ALLOWED_ORIGINS.length) {
    console.log(`CORS permitido para: ${ALLOWED_ORIGINS.join(", ")}`);
  }
});
