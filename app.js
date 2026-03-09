const THEME_KEY = "theme.v1";
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl ? window.APP_CONFIG.apiBaseUrl : "").replace(/\/+$/, "");

const byId = (id) => document.getElementById(id);

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".panel"));
const body = document.body;

const taskForm = byId("task-form");
const projectList = byId("project-list");
const projectOptions = byId("project-options");
const clearTasksBtn = byId("clear-tasks");
const expandAllBtn = byId("expand-all");
const collapseAllBtn = byId("collapse-all");
const saveTaskBtn = byId("save-task");

const modal = byId("task-modal");
const openModalBtn = byId("open-modal");
const closeModalBtn = byId("close-modal");
const cancelModalBtn = byId("cancel-modal");

const viewModal = byId("view-modal");
const closeViewModalBtn = byId("close-view-modal");
const viewDuplicateBtn = byId("view-duplicate-btn");
const viewDeleteBtn = byId("view-delete-btn");

const themeToggleBtn = byId("theme-toggle");
const themeMoon = byId("theme-moon");
const themeSun = byId("theme-sun");

const boardCanvas = byId("board");
const ctx = boardCanvas.getContext("2d");
const toolButtons = Array.from(document.querySelectorAll(".tool-btn"));
const strokeColor = byId("stroke-color");
const strokeWidth = byId("stroke-width");
const undoBtn = byId("undo-btn");
const redoBtn = byId("redo-btn");
const exportBoardBtn = byId("export-board");
const clearBoardBtn = byId("clear-board");

let tasks = [];
let boardElements = [];
let redoStack = [];
let currentTool = "select";
let drawing = false;
let currentElement = null;
let selectedIndex = -1;
let dragStart = null;
let viewedTask = null;
let draftImageData = null;

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function applyTheme(theme) {
  body.setAttribute("data-theme", theme);
  const dark = theme === "dark";
  themeMoon.classList.toggle("hidden-icon", dark);
  themeSun.classList.toggle("hidden-icon", !dark);
  themeToggleBtn.title = dark ? "Ativar modo claro" : "Ativar modo noturno";
}

themeToggleBtn.addEventListener("click", () => {
  const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`,  {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let error = "Falha na requisição";
    try {
      const data = await response.json();
      error = data.error || error;
    } catch {
      // ignore
    }
    throw new Error(error);
  }

  if (response.status === 204) return null;
  return response.json();
}

function switchTab(target) {
  tabs.forEach((tab) => {
    const active = tab.dataset.target === target;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === target);
  });

  if (target === "lousa") {
    resizeCanvas();
    renderBoard();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.target));
});

function openCreateModal() {
  viewedTask = null;
  taskForm.reset();
  draftImageData = null;
  saveTaskBtn.textContent = "Adicionar tarefa";
  byId("task-modal-title").textContent = "Criar nova tarefa";
  modal.classList.remove("hidden");
  byId("titulo").focus();
}

function openDuplicateCreateModal(task) {
  closeViewModal();
  taskForm.reset();
  draftImageData = task.imagem || null;
  saveTaskBtn.textContent = "Adicionar tarefa";
  byId("task-modal-title").textContent = "Criar nova tarefa";
  byId("titulo").value = task.titulo;
  byId("projeto").value = task.projeto;
  byId("tipo").value = task.tipo;
  byId("prioridade").value = task.prioridade;
  byId("descricao").value = task.descricao;
  modal.classList.remove("hidden");
  byId("titulo").focus();
}

function closeModal() {
  modal.classList.add("hidden");
  taskForm.reset();
  draftImageData = null;
}

function openViewModal(task) {
  viewedTask = task;
  byId("view-titulo").textContent = task.titulo;
  byId("view-projeto").textContent = task.projeto;
  byId("view-tipo").textContent = task.tipo;
  byId("view-prioridade").textContent = task.prioridade;
  byId("view-status").textContent = getTaskStatus(task).text;
  byId("view-criada").textContent = formatDate(task.criadaEm);
  byId("view-descricao").textContent = task.descricao;

  const wrap = byId("view-image-wrap");
  const img = byId("view-imagem");
  if (task.imagem) {
    img.src = task.imagem;
    wrap.style.display = "block";
  } else {
    img.removeAttribute("src");
    wrap.style.display = "none";
  }

  viewModal.classList.remove("hidden");
}

function closeViewModal() {
  viewModal.classList.add("hidden");
  viewedTask = null;
}

openModalBtn.addEventListener("click", openCreateModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
closeViewModalBtn.addEventListener("click", closeViewModal);
viewDuplicateBtn.addEventListener("click", () => {
  if (!viewedTask) return;
  openDuplicateCreateModal(viewedTask);
});
viewDeleteBtn.addEventListener("click", async () => {
  if (!viewedTask) return;
  if (!confirm("Deseja excluir esta tarefa?")) return;
  await api(`/api/tasks/${encodeURIComponent(viewedTask.id)}`, { method: "DELETE" });
  closeViewModal();
  await loadTasks();
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

viewModal.addEventListener("click", (event) => {
  if (event.target === viewModal) closeViewModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!modal.classList.contains("hidden")) closeModal();
  if (!viewModal.classList.contains("hidden")) closeViewModal();
});

function formatDate(isoString) {
  return new Date(isoString).toLocaleString("pt-BR");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTaskStatus(task) {
  if (task.concluida) return { text: "Concluída", css: "status-concluida" };
  if (task.emExecucao) return { text: "Em execução", css: "status-execucao" };
  return { text: "Pendente", css: "status-pendente" };
}

function buildProjectOptions() {
  const projects = Array.from(new Set(tasks.map((task) => task.projeto.trim()))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  projectOptions.innerHTML = "";
  for (const project of projects) {
    const option = document.createElement("option");
    option.value = project;
    projectOptions.appendChild(option);
  }
}

async function updateTaskStatus(taskId, statusPayload) {
  await api(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    body: JSON.stringify(statusPayload),
  });
  await loadTasks();
}

function createTaskItem(task) {
  const item = document.createElement("article");
  item.className = "task-item";

  const status = getTaskStatus(task);

  const header = document.createElement("div");
  header.className = "task-header";

  const title = document.createElement("h3");
  title.textContent = task.titulo;
  title.style.margin = "0 0 0.2rem";

  const statusBadge = document.createElement("span");
  statusBadge.className = `badge ${status.css}`;
  statusBadge.textContent = status.text;

  header.appendChild(title);
  header.appendChild(statusBadge);

  const meta = document.createElement("div");
  meta.className = "badges";
  meta.innerHTML = `
    <span class="badge">Tipo: ${escapeHtml(task.tipo)}</span>
    <span class="badge">Prioridade: ${escapeHtml(task.prioridade)}</span>
    <span class="badge">Criada em: ${escapeHtml(formatDate(task.criadaEm))}</span>
  `;

  const desc = document.createElement("p");
  desc.style.margin = "0.35rem 0";
  desc.textContent = task.descricao;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const execBtn = document.createElement("button");
  execBtn.type = "button";
  execBtn.className = "btn toggle-btn" + (task.emExecucao ? " active-execucao" : "");
  execBtn.textContent = task.emExecucao ? "Em execução" : "Marcar em execução";
  execBtn.addEventListener("click", async () => {
    const emExecucao = !task.emExecucao;
    await updateTaskStatus(task.id, {
      emExecucao,
      concluida: emExecucao ? false : task.concluida,
    });
  });

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "btn toggle-btn" + (task.concluida ? " active-concluida" : "");
  doneBtn.textContent = task.concluida ? "Concluída" : "Marcar concluída";
  doneBtn.addEventListener("click", async () => {
    const concluida = !task.concluida;
    await updateTaskStatus(task.id, {
      concluida,
      emExecucao: concluida ? false : task.emExecucao,
    });
  });

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.className = "btn";
  viewBtn.textContent = "Visualizar";
  viewBtn.addEventListener("click", () => openViewModal(task));

  actions.appendChild(execBtn);
  actions.appendChild(doneBtn);
  actions.appendChild(viewBtn);

  item.appendChild(header);
  item.appendChild(meta);
  item.appendChild(desc);
  item.appendChild(actions);

  return item;
}

function renderTasks() {
  projectList.innerHTML = "";

  if (!tasks.length) {
    projectList.innerHTML = '<div class="empty">Nenhuma tarefa criada.</div>';
    buildProjectOptions();
    return;
  }

  const grouped = tasks.reduce((acc, task) => {
    const key = task.projeto.trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .forEach(([project, projectTasks]) => {
      const group = document.createElement("section");
      group.className = "project-group";

      const header = document.createElement("button");
      header.type = "button";
      header.className = "project-header";
      header.innerHTML = `<span>${escapeHtml(project)}</span><span>${projectTasks.length} tarefa(s)</span>`;

      const content = document.createElement("div");
      content.className = "project-content";
      content.hidden = false;

      projectTasks
        .sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm))
        .forEach((task) => content.appendChild(createTaskItem(task)));

      header.addEventListener("click", () => {
        content.hidden = !content.hidden;
      });

      group.appendChild(header);
      group.appendChild(content);
      projectList.appendChild(group);
    });

  buildProjectOptions();
}

function setAllProjectSections(hidden) {
  document.querySelectorAll(".project-content").forEach((content) => {
    content.hidden = hidden;
  });
}

expandAllBtn.addEventListener("click", () => setAllProjectSections(false));
collapseAllBtn.addEventListener("click", () => setAllProjectSections(true));

async function loadTasks() {
  tasks = await api("/api/tasks");
  renderTasks();
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const imageInput = byId("imagem");
  const file = imageInput.files?.[0];
  let imageData = draftImageData;
  if (file) imageData = await readFileAsDataURL(file);

  const payload = {
    titulo: byId("titulo").value.trim(),
    projeto: byId("projeto").value.trim(),
    tipo: byId("tipo").value,
    prioridade: byId("prioridade").value,
    descricao: byId("descricao").value.trim(),
  };

  if (imageData) payload.imagem = imageData;

  await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  closeModal();
  await loadTasks();
});

clearTasksBtn.addEventListener("click", async () => {
  if (!confirm("Deseja remover todas as tarefas?")) return;
  await api("/api/tasks", { method: "DELETE" });
  await loadTasks();
});

function setTool(tool) {
  currentTool = tool;
  toolButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  selectedIndex = -1;
  renderBoard();
}

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => setTool(btn.dataset.tool));
});

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const container = boardCanvas.parentElement;
  const width = container.clientWidth;
  const height = Math.min(window.innerHeight * 0.7, 720);

  boardCanvas.width = Math.floor(width * ratio);
  boardCanvas.height = Math.floor(height * ratio);
  boardCanvas.style.height = `${height}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
}

function getPoint(e) {
  const rect = boardCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function hitRect(el, p, pad = 8) {
  const minX = Math.min(el.x1, el.x2) - pad;
  const maxX = Math.max(el.x1, el.x2) + pad;
  const minY = Math.min(el.y1, el.y2) - pad;
  const maxY = Math.max(el.y1, el.y2) + pad;
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

function hitElement(el, p) {
  if (el.type === "pen") {
    if (!el.points?.length) return false;
    const xs = el.points.map((pt) => pt.x);
    const ys = el.points.map((pt) => pt.y);
    return hitRect({ x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }, p, 10);
  }

  if (el.type === "text") {
    const width = (el.text?.length || 1) * 9;
    return p.x >= el.x - 5 && p.x <= el.x + width && p.y >= el.y - 20 && p.y <= el.y + 6;
  }

  return hitRect(el, p, 8);
}

function moveElement(el, dx, dy) {
  if (el.type === "pen") {
    el.points = el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    return;
  }

  if (el.type === "text") {
    el.x += dx;
    el.y += dy;
    return;
  }

  el.x1 += dx;
  el.y1 += dy;
  el.x2 += dx;
  el.y2 += dy;
}

function drawArrow(element) {
  const { x1, y1, x2, y2, color, size } = element;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(12, size * 6);
  const shaftEndX = x2 - Math.cos(angle) * head * 0.75;
  const shaftEndY = y2 - Math.sin(angle) * head * 0.75;

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSelectionBox(el) {
  let x1;
  let y1;
  let x2;
  let y2;

  if (el.type === "pen") {
    const xs = el.points.map((pt) => pt.x);
    const ys = el.points.map((pt) => pt.y);
    x1 = Math.min(...xs);
    y1 = Math.min(...ys);
    x2 = Math.max(...xs);
    y2 = Math.max(...ys);
  } else if (el.type === "text") {
    x1 = el.x - 4;
    y1 = el.y - 20;
    x2 = el.x + Math.max(20, (el.text?.length || 1) * 9);
    y2 = el.y + 5;
  } else {
    x1 = Math.min(el.x1, el.x2);
    y1 = Math.min(el.y1, el.y2);
    x2 = Math.max(el.x1, el.x2);
    y2 = Math.max(el.y1, el.y2);
  }

  ctx.save();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x1 - 4, y1 - 4, x2 - x1 + 8, y2 - y1 + 8);
  ctx.restore();
}

function drawElement(el) {
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "pen") {
    if (!el.points || el.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i += 1) ctx.lineTo(el.points[i].x, el.points[i].y);
    ctx.stroke();
    return;
  }

  if (el.type === "rect") {
    ctx.strokeRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
    return;
  }

  if (el.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      (el.x1 + el.x2) / 2,
      (el.y1 + el.y2) / 2,
      Math.abs(el.x2 - el.x1) / 2,
      Math.abs(el.y2 - el.y1) / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    return;
  }

  if (el.type === "arrow") {
    drawArrow(el);
    return;
  }

  if (el.type === "text") {
    ctx.font = `${Math.max(14, el.size * 6)}px Segoe UI`;
    ctx.fillText(el.text, el.x, el.y);
  }
}

function renderBoard() {
  ctx.clearRect(0, 0, boardCanvas.clientWidth, boardCanvas.clientHeight);
  boardElements.forEach((el, index) => {
    drawElement(el);
    if (index === selectedIndex && currentTool === "select") drawSelectionBox(el);
  });
}

async function saveBoard() {
  await api("/api/board", {
    method: "PUT",
    body: JSON.stringify({ elements: boardElements }),
  });
}

async function loadBoard() {
  const data = await api("/api/board");
  boardElements = Array.isArray(data.elements) ? data.elements : [];
  redoStack = [];
  selectedIndex = -1;
  renderBoard();
}

function resetRedo() {
  redoStack = [];
}

function startDrawing(e) {
  const point = getPoint(e);
  drawing = true;

  if (currentTool === "select") {
    selectedIndex = -1;
    for (let i = boardElements.length - 1; i >= 0; i -= 1) {
      if (hitElement(boardElements[i], point)) {
        selectedIndex = i;
        dragStart = point;
        break;
      }
    }
    renderBoard();
    return;
  }

  resetRedo();

  if (currentTool === "text") {
    drawing = false;
    const text = prompt("Digite o texto para inserir na lousa:");
    if (!text || !text.trim()) return;

    boardElements.push({
      type: "text",
      x: point.x,
      y: point.y,
      text: text.trim(),
      color: strokeColor.value,
      size: Number(strokeWidth.value),
    });

    selectedIndex = boardElements.length - 1;
    saveBoard().catch((err) => alert(err.message));
    renderBoard();
    return;
  }

  if (currentTool === "pen") {
    currentElement = {
      type: "pen",
      points: [point],
      color: strokeColor.value,
      size: Number(strokeWidth.value),
    };
    boardElements.push(currentElement);
    selectedIndex = boardElements.length - 1;
    return;
  }

  currentElement = {
    type: currentTool,
    x1: point.x,
    y1: point.y,
    x2: point.x,
    y2: point.y,
    color: strokeColor.value,
    size: Number(strokeWidth.value),
  };

  boardElements.push(currentElement);
  selectedIndex = boardElements.length - 1;
}

function moveDrawing(e) {
  if (!drawing) return;
  const point = getPoint(e);

  if (currentTool === "select") {
    if (selectedIndex >= 0 && dragStart) {
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;
      moveElement(boardElements[selectedIndex], dx, dy);
      dragStart = point;
      renderBoard();
    }
    return;
  }

  if (!currentElement) return;

  if (currentElement.type === "pen") {
    currentElement.points.push(point);
  } else {
    currentElement.x2 = point.x;
    currentElement.y2 = point.y;
  }

  renderBoard();
}

function endDrawing() {
  if (!drawing) return;
  drawing = false;
  currentElement = null;
  dragStart = null;
  saveBoard().catch((err) => alert(err.message));
}

boardCanvas.addEventListener("pointerdown", startDrawing);
boardCanvas.addEventListener("pointermove", moveDrawing);
boardCanvas.addEventListener("pointerup", endDrawing);
boardCanvas.addEventListener("pointerleave", endDrawing);

undoBtn.addEventListener("click", async () => {
  if (!boardElements.length) return;
  redoStack.push(boardElements.pop());
  selectedIndex = -1;
  await saveBoard();
  renderBoard();
});

redoBtn.addEventListener("click", async () => {
  if (!redoStack.length) return;
  boardElements.push(redoStack.pop());
  selectedIndex = boardElements.length - 1;
  await saveBoard();
  renderBoard();
});

exportBoardBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = boardCanvas.toDataURL("image/png");
  link.download = `lousa-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`;
  link.click();
});

clearBoardBtn.addEventListener("click", async () => {
  if (!confirm("Deseja limpar toda a lousa?")) return;
  boardElements = [];
  redoStack = [];
  selectedIndex = -1;
  await saveBoard();
  renderBoard();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  renderBoard();
});

async function init() {
  try {
    applyTheme(getTheme());
    setTool("select");
    resizeCanvas();
    await Promise.all([loadTasks(), loadBoard()]);
  } catch (error) {
    alert(`Erro ao carregar dados: ${error.message}`);
  }
}

init();




