"use strict";

const STORAGE_KEY = "taskflow.tasks.v1";
const WORDS_STORAGE_KEY = "taskflow.words.v1";
const SUBJECTS_STORAGE_KEY = "taskflow.subjects.v1";
const THEME_KEY = "taskflow.theme.v1";
const WEEKDAYS = [
  { id: "1", name: "Lunes" },
  { id: "2", name: "Martes" },
  { id: "3", name: "Miércoles" },
  { id: "4", name: "Jueves" },
  { id: "5", name: "Viernes" },
];
const ATTACHMENTS_DB_NAME = "tareas.attachments";
const ATTACHMENTS_STORE_NAME = "files";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const elements = {
  addButton: document.querySelector("#add-task-button"),
  cancelDialog: document.querySelector("#cancel-dialog"),
  cancelDelete: document.querySelector("#cancel-delete"),
  cancelWordDialog: document.querySelector("#cancel-word-dialog"),
  closeDialog: document.querySelector("#close-dialog"),
  closeDeleteDialog: document.querySelector("#close-delete-dialog"),
  closeCompletionDialog: document.querySelector("#close-completion-dialog"),
  closeAttachmentDialog: document.querySelector("#close-attachment-dialog"),
  closeWordDialog: document.querySelector("#close-word-dialog"),
  closeSubjectDialog: document.querySelector("#close-subject-dialog"),
  completeWithoutScore: document.querySelector("#complete-without-score"),
  completionDialog: document.querySelector("#completion-dialog"),
  completionError: document.querySelector("#completion-error"),
  completionForm: document.querySelector("#completion-form"),
  completionScale: document.querySelector("#completion-scale"),
  completionScore: document.querySelector("#completion-score"),
  completionTitle: document.querySelector("#completion-title"),
  confirmDelete: document.querySelector("#confirm-delete"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteMessage: document.querySelector("#delete-message"),
  deleteTitle: document.querySelector("#delete-title"),
  dialog: document.querySelector("#task-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  attachmentDialog: document.querySelector("#attachment-dialog"),
  attachmentDialogTitle: document.querySelector("#attachment-dialog-title"),
  attachmentPreviewContent: document.querySelector("#attachment-preview-content"),
  emptyAddButton: document.querySelector("#empty-add-button"),
  emptyMessage: document.querySelector("#empty-message"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  form: document.querySelector("#task-form"),
  formError: document.querySelector("#form-error"),
  historyTab: document.querySelector("#history-tab"),
  calendarTab: document.querySelector("#calendar-tab"),
  installAppButton: document.querySelector("#install-app-button"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  pendingBadge: document.querySelector("#pending-badge"),
  pendingTab: document.querySelector("#pending-tab"),
  searchInput: document.querySelector("#search-input"),
  sortBox: document.querySelector("#sort-box"),
  sortSelect: document.querySelector("#sort-select"),
  taskCount: document.querySelector("#task-count"),
  taskDescription: document.querySelector("#task-description"),
  taskDueDate: document.querySelector("#task-due-date"),
  taskAttachment: document.querySelector("#task-attachment"),
  taskAttachmentCurrent: document.querySelector("#task-attachment-current"),
  taskAttachmentName: document.querySelector("#task-attachment-name"),
  taskList: document.querySelector("#task-list"),
  taskTitle: document.querySelector("#task-title"),
  removeTaskAttachment: document.querySelector("#remove-task-attachment"),
  shareButton: document.querySelector("#share-app-button"),
  subjectDialog: document.querySelector("#subject-dialog"),
  subjectDialogTitle: document.querySelector("#subject-dialog-title"),
  subjectForm: document.querySelector("#subject-form"),
  subjectFormError: document.querySelector("#subject-form-error"),
  subjectName: document.querySelector("#subject-name"),
  subjectDay: document.querySelector("#subject-day"),
  subjectStartTime: document.querySelector("#subject-start-time"),
  subjectEndTime: document.querySelector("#subject-end-time"),
  cancelSubjectDialog: document.querySelector("#cancel-subject-dialog"),
  themeToggle: document.querySelector("#theme-toggle"),
  toast: document.querySelector("#toast"),
  toolbar: document.querySelector("#task-toolbar"),
  wordDefinition: document.querySelector("#word-definition"),
  wordDialog: document.querySelector("#word-dialog"),
  wordDialogTitle: document.querySelector("#word-dialog-title"),
  wordForm: document.querySelector("#word-form"),
  wordFormError: document.querySelector("#word-form-error"),
  wordTerm: document.querySelector("#word-term"),
  wordsTab: document.querySelector("#words-tab"),
};

let tasks = loadTasks();
let words = loadWords();
let subjects = loadSubjects();
let activeView = "pending";
let editingTaskId = null;
let editingWordId = null;
let editingSubjectId = null;
let pendingDeleteItem = null;
let completingTaskId = null;
let deferredInstallPrompt = null;
let toastTimeout;
let attachmentsDatabasePromise = null;
let currentAttachmentUrl = null;
let removeCurrentAttachment = false;

function loadTasks() {
  try {
    const storedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(storedTasks)) {
      throw new Error("El formato guardado no es una lista.");
    }

    return storedTasks.filter(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.createdAt === "string" &&
        typeof task.completed === "boolean",
    );
  } catch (error) {
    console.error("No se pudieron cargar las tareas guardadas.", error);
    return [];
  }
}

function loadWords() {
  try {
    const storedWords = JSON.parse(localStorage.getItem(WORDS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(storedWords)) {
      throw new Error("El formato guardado no es una lista.");
    }

    return storedWords.filter(
      (word) =>
        word &&
        typeof word.id === "string" &&
        typeof word.term === "string" &&
        typeof word.definition === "string" &&
        typeof word.createdAt === "string",
    );
  } catch (error) {
    console.error("No se pudieron cargar las palabras guardadas.", error);
    return [];
  }
}

function loadSubjects() {
  try {
    const storedSubjects = JSON.parse(localStorage.getItem(SUBJECTS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(storedSubjects)) {
      throw new Error("El formato guardado no es una lista.");
    }

    return storedSubjects.flatMap((subject) => {
      if (
        !subject ||
        typeof subject.id !== "string" ||
        typeof subject.name !== "string" ||
        !/^[1-5]$/.test(subject.day)
      ) {
        return [];
      }

      const startTime = subject.startTime ?? subject.time;
      if (!isValidScheduleTime(startTime)) return [];

      const endTime = subject.endTime ?? minutesToTime(Math.min(timeToMinutes(startTime) + 60, 1435));
      if (!isValidScheduleTime(endTime) || timeToMinutes(endTime) <= timeToMinutes(startTime)) return [];

      return [{ ...subject, startTime, endTime }];
    });
  } catch (error) {
    console.error("No se pudieron cargar las materias guardadas.", error);
    return [];
  }
}

function isValidScheduleTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && timeToMinutes(value) % 5 === 0;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainder = String(minutes % 60).padStart(2, "0");
  return `${hours}:${remainder}`;
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las tareas.", error);
    showToast("No se pudo guardar. Revisa el espacio disponible en tu dispositivo.");
    return false;
  }
}

function saveWords() {
  try {
    localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(words));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las palabras.", error);
    showToast("No se pudo guardar. Revisa el espacio disponible en tu dispositivo.");
    return false;
  }
}

function saveSubjects() {
  try {
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(subjects));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las materias.", error);
    showToast("No se pudo guardar. Revisa el espacio disponible en tu dispositivo.");
    return false;
  }
}

function openAttachmentsDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador no permite guardar archivos adjuntos."));
  }

  if (!attachmentsDatabasePromise) {
    attachmentsDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(ATTACHMENTS_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ATTACHMENTS_STORE_NAME)) {
          database.createObjectStore(ATTACHMENTS_STORE_NAME, { keyPath: "taskId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento de archivos."));
      request.onblocked = () => reject(new Error("El almacenamiento de archivos está ocupado en otra pestaña."));
    });
  }

  return attachmentsDatabasePromise;
}

async function getStoredAttachment(taskId) {
  const database = await openAttachmentsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ATTACHMENTS_STORE_NAME, "readonly");
    const request = transaction.objectStore(ATTACHMENTS_STORE_NAME).get(taskId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el archivo adjunto."));
  });
}

async function storeAttachment(taskId, file, type) {
  const database = await openAttachmentsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
    transaction.objectStore(ATTACHMENTS_STORE_NAME).put({
      taskId,
      file: new Blob([file], { type }),
      name: file.name,
      type,
      size: file.size,
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar el archivo adjunto."));
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudo guardar el archivo adjunto."));
  });
}

async function removeStoredAttachment(taskId) {
  const database = await openAttachmentsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
    transaction.objectStore(ATTACHMENTS_STORE_NAME).delete(taskId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo quitar el archivo adjunto."));
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudo quitar el archivo adjunto."));
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatDate(dateString, options = { day: "numeric", month: "short", year: "numeric" }) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Fecha no válida";
  return new Intl.DateTimeFormat("es", options).format(date);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTaskDateLabel(task) {
  if (activeView === "history" && task.completedAt) {
    const completed = new Date(task.completedAt);
    return `Completada el ${new Intl.DateTimeFormat("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(completed)}`;
  }

  if (!task.dueDate) return "Sin fecha de vencimiento";

  const dueDate = new Date(`${task.dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = !task.completed && dueDate < today;
  const label = formatDate(task.dueDate);

  return `<span class="${isOverdue ? "overdue" : ""}">${isOverdue ? "Vencida · " : "Vence · "}${label}</span>`;
}

function getVisibleTasks() {
  const isHistory = activeView === "history";
  const query = elements.searchInput.value.trim().toLocaleLowerCase("es");
  const visibleTasks = tasks.filter((task) => {
    if (task.completed !== isHistory) return false;
    if (!query) return true;
    return `${task.title} ${task.description ?? ""}`.toLocaleLowerCase("es").includes(query);
  });

  switch (elements.sortSelect.value) {
    case "newest":
      visibleTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "oldest":
      visibleTasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "alphabetical":
      visibleTasks.sort((a, b) => a.title.localeCompare(b.title, "es"));
      break;
    case "due":
    default:
      visibleTasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }

  if (isHistory) {
    visibleTasks.sort((a, b) => {
      if (elements.sortSelect.value !== "due") return 0;
      return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
    });
  }

  return visibleTasks;
}

function getVisibleWords() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase("es");
  return words
    .filter((word) => `${word.term} ${word.definition}`.toLocaleLowerCase("es").includes(query))
    .sort((a, b) => a.term.localeCompare(b.term, "es"));
}

function getVisibleSubjects() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase("es");
  return subjects
    .filter((subject) => subject.name.toLocaleLowerCase("es").includes(query))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name, "es"));
}

function renderWord(word) {
  return `
    <article class="word-card" data-word-id="${escapeHtml(word.id)}">
      <div class="word-details">
        <h3>${escapeHtml(word.term)}</h3>
        <p>${escapeHtml(word.definition).replace(/\n/g, "<br>")}</p>
      </div>
      <div class="task-actions">
        <button class="task-menu" type="button" data-action="menu" aria-expanded="false" aria-label="Opciones para ${escapeHtml(word.term)}" title="Opciones">···</button>
        <div class="task-actions-menu" hidden>
          <button type="button" data-action="edit">Editar palabra</button>
          <button class="delete-action" type="button" data-action="delete">Eliminar palabra</button>
        </div>
      </div>
    </article>`;
}

function renderCalendar(visibleSubjects) {
  const startOfDay = 7 * 60 + 30;
  const endOfDay = 18 * 60;
  const firstMinute = visibleSubjects.length
    ? Math.min(startOfDay, ...visibleSubjects.map((subject) => timeToMinutes(subject.startTime)))
    : startOfDay;
  const lastMinute = visibleSubjects.length
    ? Math.max(endOfDay, ...visibleSubjects.map((subject) => timeToMinutes(subject.endTime)))
    : endOfDay;
  const tickCount = Math.max(1, (lastMinute - firstMinute) / 5);
  const timeLabels = Array.from({ length: tickCount + 1 }, (_, index) => {
    const time = firstMinute + index * 5;
    return index === 0 || time % 60 === 0 || index === tickCount
      ? `<span class="calendar-time-label" style="grid-row:${index + 2}">${minutesToTime(time)}</span>`
      : "";
  }).join("");
  const columns = WEEKDAYS.map((day, dayIndex) => {
    const daySubjects = visibleSubjects.filter((subject) => subject.day === day.id);
    const blocks = daySubjects.map((subject) => {
      const startMinute = timeToMinutes(subject.startTime);
      const endMinute = timeToMinutes(subject.endTime);
      const startRow = 2 + (startMinute - firstMinute) / 5;
      const rowSpan = (endMinute - startMinute) / 5;
      return `
        <article class="calendar-block" style="grid-row:${startRow} / span ${rowSpan}">
          <div class="calendar-block-copy">
            <h3>${escapeHtml(subject.name)}</h3>
            <time>${escapeHtml(subject.startTime)}–<wbr>${escapeHtml(subject.endTime)}</time>
          </div>
          <div class="calendar-block-actions">
            <button class="calendar-block-action calendar-delete-button" type="button" data-action="delete" data-subject-id="${escapeHtml(subject.id)}" aria-label="Eliminar ${escapeHtml(subject.name)}" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
              </svg>
            </button>
            <button class="calendar-block-action calendar-edit-button" type="button" data-action="edit-subject" data-subject-id="${escapeHtml(subject.id)}" aria-label="Modificar ${escapeHtml(subject.name)}" title="Modificar">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
              </svg>
            </button>
          </div>
        </article>`;
    }).join("");
    return `
      <section class="calendar-day-column" aria-label="${day.name}" style="--calendar-ticks:${tickCount}; grid-column:${dayIndex + 2}">
        <h2 class="calendar-day-heading">${day.name}</h2>
        <div class="calendar-day-track"></div>
        ${blocks}
      </section>`;
  }).join("");

  return `
    <div class="calendar-grid-wrap">
      <div class="calendar-grid" style="--calendar-ticks:${tickCount}">
        <div class="calendar-time-column">
          <span class="calendar-grid-heading" aria-hidden="true"></span>
          ${timeLabels}
        </div>
        ${columns}
      </div>
    </div>`;
}

function renderTask(task) {
  const description = task.description
    ? `<p>${escapeHtml(task.description).replace(/\n/g, "<br>")}</p>`
    : "";
  const completedLabel =
    activeView === "history"
      ? `<span class="completed-label"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>${getTaskDateLabel(task)}</span>${renderTaskScore(task)}`
      : "";
  const meta = activeView === "pending"
    ? `<div class="task-meta ${task.dueDate ? "has-due-date" : ""} ${task.dueDate && task.dueDate < dateKey(new Date()) ? "overdue" : ""}">
         <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
         <span>${getTaskDateLabel(task)}</span>
       </div>`
    : completedLabel;
  const attachment = task.attachment
    ? `<button class="task-attachment-link" type="button" data-action="attachment">
         <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
           ${task.attachment.type === "application/pdf"
             ? '<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5M8 15h8m-8 3h6"/>'
             : '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'}
         </svg>
         <span>${escapeHtml(task.attachment.name)}</span>
       </button>`
    : "";

  return `
    <article class="task-card ${task.completed ? "completed" : ""}" data-task-id="${escapeHtml(task.id)}">
      <button class="complete-button" type="button" data-action="toggle" aria-label="${task.completed ? "Restaurar tarea" : "Marcar tarea como completada"}">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      <div class="task-details">
        <h3>${escapeHtml(task.title)}</h3>
        ${description}
        ${meta}
        ${attachment}
      </div>
      <div class="task-card-actions">
        <button class="calendar-block-action calendar-edit-button" type="button" data-action="edit-task" aria-label="Modificar ${escapeHtml(task.title)}" title="Modificar">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          </svg>
        </button>
        <button class="calendar-block-action calendar-delete-button" type="button" data-action="delete" aria-label="Eliminar ${escapeHtml(task.title)}" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
          </svg>
        </button>
      </div>
    </article>`;
}

function renderTaskScore(task) {
  if (typeof task.score !== "number") return "";
  const score = new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(task.score);
  const scale =
    typeof task.scoreScale === "number"
      ? ` / ${new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(task.scoreScale)}`
      : "";
  return `<span class="task-score">Puntaje: ${score}${scale}</span>`;
}

function render() {
  const isWords = activeView === "words";
  const isCalendar = activeView === "calendar";
  const isHistory = activeView === "history";
  const pendingCount = tasks.filter((task) => !task.completed).length;
  const visibleTasks = isWords || isCalendar ? [] : getVisibleTasks();
  const visibleWords = isWords ? getVisibleWords() : [];
  const visibleSubjects = isCalendar ? getVisibleSubjects() : [];
  const visibleCount = isWords
    ? visibleWords.length
    : isCalendar
      ? visibleSubjects.length
      : visibleTasks.length;

  elements.pageSubtitle.textContent = isWords
    ? "Mi diccionario personal"
    : isCalendar
      ? "Horario semanal · lunes a viernes"
      : isHistory
        ? "Tus tareas completadas"
        : "Mis Tareas Activas";
  elements.searchInput.placeholder = isWords
    ? "Buscar palabra..."
    : isCalendar
      ? "Buscar materia o actividad..."
      : "Buscar tarea...";
  const addLabel = isWords ? "Agregar palabra" : isCalendar ? "Agregar bloque" : "Agregar tarea";
  elements.addButton.setAttribute("aria-label", addLabel);
  elements.addButton.title = addLabel;
  elements.taskCount.textContent = isWords
    ? `${visibleCount} ${visibleCount === 1 ? "palabra guardada" : "palabras guardadas"}`
    : isCalendar
      ? `${visibleCount} ${visibleCount === 1 ? "bloque programado" : "bloques programados"}`
      : isHistory
        ? `${visibleCount} ${visibleCount === 1 ? "tarea completada" : "tareas completadas"}`
        : `${visibleCount} ${visibleCount === 1 ? "tarea pendiente" : "tareas pendientes"}`;
  elements.pendingBadge.textContent = pendingCount > 99 ? "99+" : String(pendingCount);
  elements.pendingBadge.hidden = pendingCount === 0;
  elements.toolbar.hidden = false;
  elements.sortBox.hidden = isWords || isCalendar;
  elements.taskList.innerHTML = isWords
    ? visibleWords.map(renderWord).join("")
    : isCalendar
      ? renderCalendar(visibleSubjects)
      : visibleTasks.map(renderTask).join("");
  const isEmptySearch = Boolean(elements.searchInput.value.trim()) && visibleCount === 0;
  elements.emptyState.hidden = isCalendar ? !isEmptySearch : visibleCount > 0;
  elements.taskList.hidden = isCalendar ? isEmptySearch : visibleCount === 0;

  elements.emptyTitle.textContent = elements.searchInput.value.trim()
    ? isWords ? "No encontramos palabras" : isCalendar ? "No encontramos materias" : "No encontramos tareas"
    : isWords
      ? "Tu diccionario está vacío"
      : isCalendar
        ? "Tu horario está vacío"
        : isHistory
          ? "Aún no hay historial"
          : "Todo listo por aquí";
  elements.emptyMessage.textContent = elements.searchInput.value.trim()
    ? "Prueba con otra búsqueda."
    : isWords
      ? "Agrega una palabra y su definición para tenerlas a mano."
      : isCalendar
          ? "Agrega materias y actividades para organizar tu semana."
        : isHistory
          ? "Cuando completes una tarea, aparecerá aquí."
          : "Agrega una tarea para empezar a organizarte.";
  elements.emptyAddButton.textContent = addLabel;
  elements.emptyAddButton.hidden = isHistory || Boolean(elements.searchInput.value.trim());

  elements.pendingTab.classList.toggle("active", activeView === "pending");
  elements.historyTab.classList.toggle("active", isHistory);
  elements.wordsTab.classList.toggle("active", isWords);
  elements.calendarTab.classList.toggle("active", isCalendar);
  elements.pendingTab.toggleAttribute("aria-current", activeView === "pending");
  elements.historyTab.toggleAttribute("aria-current", isHistory);
  elements.wordsTab.toggleAttribute("aria-current", isWords);
  elements.calendarTab.toggleAttribute("aria-current", isCalendar);
  elements.sortSelect.setAttribute(
    "aria-label",
    isCalendar ? "Ordenar materias por día y hora" : isHistory ? "Ordenar historial" : "Ordenar tareas pendientes",
  );
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 3000);
}

function openTaskDialog(task = null) {
  editingTaskId = task?.id ?? null;
  removeCurrentAttachment = false;
  elements.form.reset();
  elements.formError.hidden = true;
  elements.dialogTitle.textContent = task ? "Editar tarea" : "Nueva tarea";
  elements.form.querySelector('[type="submit"]').textContent = task ? "Guardar cambios" : "Guardar tarea";

  if (task) {
    elements.taskTitle.value = task.title;
    elements.taskDescription.value = task.description ?? "";
    elements.taskDueDate.value = task.dueDate ?? "";
  }

  updateTaskAttachmentStatus(task?.attachment ?? null);
  elements.dialog.showModal();
  elements.taskTitle.focus();
}

function updateTaskAttachmentStatus(existingAttachment = null) {
  const selectedFile = elements.taskAttachment.files[0];
  if (selectedFile) {
    elements.taskAttachmentName.textContent = `Nuevo archivo: ${selectedFile.name}`;
    elements.taskAttachmentCurrent.hidden = false;
    elements.removeTaskAttachment.hidden = !existingAttachment || removeCurrentAttachment;
    return;
  }

  elements.taskAttachmentCurrent.hidden = !existingAttachment || removeCurrentAttachment;
  elements.taskAttachmentName.textContent = existingAttachment
    ? removeCurrentAttachment
      ? ""
      : `Adjunto actual: ${existingAttachment.name}`
    : "";
  elements.removeTaskAttachment.hidden = !existingAttachment || removeCurrentAttachment;
}

function openWordDialog(word = null) {
  editingWordId = word?.id ?? null;
  elements.wordForm.reset();
  elements.wordFormError.hidden = true;
  elements.wordDialogTitle.textContent = word ? "Editar palabra" : "Nueva palabra";
  elements.wordForm.querySelector('[type="submit"]').textContent = word ? "Guardar cambios" : "Guardar palabra";

  if (word) {
    elements.wordTerm.value = word.term;
    elements.wordDefinition.value = word.definition;
  }

  elements.wordDialog.showModal();
  elements.wordTerm.focus();
}

function openSubjectDialog(subject = null) {
  editingSubjectId = subject?.id ?? null;
  elements.subjectForm.reset();
  elements.subjectFormError.hidden = true;
  elements.subjectDialogTitle.textContent = subject ? "Modificar bloque" : "Nuevo bloque";
  elements.subjectForm.querySelector('[type="submit"]').textContent = subject ? "Guardar cambios" : "Guardar bloque";

  if (subject) {
    elements.subjectName.value = subject.name;
    elements.subjectDay.value = subject.day;
    elements.subjectStartTime.value = subject.startTime;
    elements.subjectEndTime.value = subject.endTime;
  }

  elements.subjectDialog.showModal();
  elements.subjectName.focus();
}

function closeTaskDialog() {
  elements.dialog.close();
  editingTaskId = null;
  elements.formError.hidden = true;
}

function closeWordDialog() {
  elements.wordDialog.close();
  editingWordId = null;
  elements.wordFormError.hidden = true;
}

function closeSubjectDialog() {
  elements.subjectDialog.close();
  editingSubjectId = null;
  elements.subjectFormError.hidden = true;
}

function openCompletionDialog(task) {
  completingTaskId = task.id;
  elements.completionForm.reset();
  elements.completionError.hidden = true;
  elements.completionTitle.textContent = `Completar: ${task.title}`;
  elements.completionDialog.showModal();
  elements.completionScore.focus();
}

function closeCompletionDialog() {
  elements.completionDialog.close();
  completingTaskId = null;
  elements.completionError.hidden = true;
}

function finishTask(score = null, scoreScale = null) {
  const task = tasks.find((item) => item.id === completingTaskId);
  if (!task) {
    closeCompletionDialog();
    return;
  }

  const previousTasks = tasks;
  tasks = tasks.map((item) =>
    item.id === task.id
      ? { ...item, completed: true, completedAt: new Date().toISOString(), score, scoreScale }
      : item,
  );

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  closeCompletionDialog();
  render();
  showToast("¡Tarea completada!");
}

function handleCompletionSubmit(event) {
  event.preventDefault();
  const rawScore = elements.completionScore.value.trim();
  const rawScale = elements.completionScale.value.trim();
  const score = rawScore === "" ? null : Number(rawScore);
  const scoreScale = rawScale === "" ? null : Number(rawScale);

  if (score === null && scoreScale !== null) {
    elements.completionError.textContent = "Ingresa el puntaje obtenido o deja también vacía la escala.";
    elements.completionError.hidden = false;
    elements.completionScore.focus();
    return;
  }

  if (score !== null && (!Number.isFinite(score) || score < 0)) {
    elements.completionError.textContent = "El puntaje debe ser un número igual o mayor que cero.";
    elements.completionError.hidden = false;
    elements.completionScore.focus();
    return;
  }

  if (scoreScale !== null && (!Number.isFinite(scoreScale) || scoreScale <= 0)) {
    elements.completionError.textContent = "La escala máxima debe ser mayor que cero.";
    elements.completionError.hidden = false;
    elements.completionScale.focus();
    return;
  }

  if (score !== null && scoreScale !== null && score > scoreScale) {
    elements.completionError.textContent = "El puntaje obtenido no puede superar la escala máxima.";
    elements.completionError.hidden = false;
    elements.completionScore.focus();
    return;
  }

  finishTask(score, scoreScale);
}

async function handleSubmit(event) {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  if (!title) {
    elements.formError.textContent = "Escribe un nombre para la tarea.";
    elements.formError.hidden = false;
    elements.taskTitle.focus();
    return;
  }

  const selectedFile = elements.taskAttachment.files[0] ?? null;
  const fileName = selectedFile?.name.toLocaleLowerCase("es") ?? "";
  const selectedAttachmentType = fileName.endsWith(".pdf")
    ? "application/pdf"
    : /\.(jpe?g)$/.test(fileName)
      ? "image/jpeg"
      : null;
  if (selectedFile) {
    if (!selectedAttachmentType) {
      elements.formError.textContent = "El archivo debe ser JPG o PDF.";
      elements.formError.hidden = false;
      return;
    }
    if (selectedFile.size === 0 || selectedFile.size > MAX_ATTACHMENT_SIZE) {
      elements.formError.textContent = "El archivo debe tener contenido y pesar como máximo 10 MB.";
      elements.formError.hidden = false;
      return;
    }
  }

  const now = new Date().toISOString();
  const isEditing = Boolean(editingTaskId);
  const currentTask = isEditing ? tasks.find((task) => task.id === editingTaskId) : null;
  const taskId = currentTask?.id ?? crypto.randomUUID();
  const previousAttachment = currentTask?.attachment ?? null;
  const nextAttachment = selectedFile
    ? { name: selectedFile.name, type: selectedAttachmentType, size: selectedFile.size }
    : removeCurrentAttachment
      ? null
      : previousAttachment;
  const fields = {
    title,
    description: elements.taskDescription.value.trim(),
    dueDate: elements.taskDueDate.value,
    attachment: nextAttachment,
  };
  const previousTasks = tasks;

  let storedAttachmentBeforeChange = null;
  const attachmentChanged = Boolean(selectedFile) || removeCurrentAttachment;
  if (attachmentChanged) {
    try {
      storedAttachmentBeforeChange = currentTask ? await getStoredAttachment(taskId) : null;
      if (selectedFile) {
        await storeAttachment(taskId, selectedFile, selectedAttachmentType);
      } else {
        await removeStoredAttachment(taskId);
      }
    } catch (error) {
      console.error("No se pudo actualizar el archivo adjunto.", error);
      elements.formError.textContent = error.message || "No se pudo guardar el archivo adjunto.";
      elements.formError.hidden = false;
      return;
    }
  }

  if (currentTask) {
    tasks = tasks.map((task) => (task.id === taskId ? { ...task, ...fields } : task));
  } else {
    tasks = [{ id: taskId, ...fields, createdAt: now, completed: false }, ...tasks];
  }

  if (!saveTasks()) {
    tasks = previousTasks;
    if (attachmentChanged) {
      try {
        if (storedAttachmentBeforeChange) {
          await storeAttachment(taskId, storedAttachmentBeforeChange.file, storedAttachmentBeforeChange.type);
        } else {
          await removeStoredAttachment(taskId);
        }
      } catch (error) {
        console.error("No se pudo restaurar el archivo adjunto tras un error de guardado.", error);
        showToast("La tarea no se guardó y no se pudo restaurar su archivo adjunto.");
      }
    }
    return;
  }

  closeTaskDialog();
  activeView = "pending";
  render();
  showToast(isEditing ? "Tarea actualizada" : "Tarea agregada");
}

function handleWordSubmit(event) {
  event.preventDefault();
  const term = elements.wordTerm.value.trim();
  const definition = elements.wordDefinition.value.trim();
  if (!term || !definition) {
    elements.wordFormError.textContent = "Escribe la palabra y su definición.";
    elements.wordFormError.hidden = false;
    return;
  }

  const isEditing = Boolean(editingWordId);
  const previousWords = words;
  if (editingWordId) {
    words = words.map((word) =>
      word.id === editingWordId ? { ...word, term, definition } : word,
    );
  } else {
    words = [{ id: crypto.randomUUID(), term, definition, createdAt: new Date().toISOString() }, ...words];
  }

  if (!saveWords()) {
    words = previousWords;
    return;
  }

  closeWordDialog();
  activeView = "words";
  render();
  showToast(isEditing ? "Palabra actualizada" : "Palabra agregada");
}

function handleSubjectSubmit(event) {
  event.preventDefault();
  const name = elements.subjectName.value.trim();
  const day = elements.subjectDay.value;
  const startTime = elements.subjectStartTime.value;
  const endTime = elements.subjectEndTime.value;
  if (!name || !/^[1-5]$/.test(day) || !isValidScheduleTime(startTime) || !isValidScheduleTime(endTime)) {
    elements.subjectFormError.textContent = "Escribe el nombre, elige un día y selecciona horas en intervalos de cinco minutos.";
    elements.subjectFormError.hidden = false;
    return;
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    elements.subjectFormError.textContent = "La hora de fin debe ser posterior a la hora de inicio.";
    elements.subjectFormError.hidden = false;
    return;
  }

  const hasTimeConflict = subjects.some((subject) =>
    subject.id !== editingSubjectId &&
    subject.day === day &&
    timeToMinutes(startTime) < timeToMinutes(subject.endTime) &&
    timeToMinutes(endTime) > timeToMinutes(subject.startTime),
  );
  if (hasTimeConflict) {
    elements.subjectFormError.textContent = "Ese horario se cruza con otro bloque del mismo día.";
    elements.subjectFormError.hidden = false;
    return;
  }

  const isEditing = Boolean(editingSubjectId);
  const previousSubjects = subjects;
  if (editingSubjectId) {
    subjects = subjects.map((subject) =>
      subject.id === editingSubjectId ? { ...subject, name, day, startTime, endTime } : subject,
    );
  } else {
    subjects = [...subjects, { id: crypto.randomUUID(), name, day, startTime, endTime }];
  }

  if (!saveSubjects()) {
    subjects = previousSubjects;
    return;
  }

  closeSubjectDialog();
  activeView = "calendar";
  render();
  showToast(isEditing ? "Bloque modificado" : "Bloque agregado");
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest("[data-task-id]");
  const wordCard = event.target.closest("[data-word-id]");
  const subjectId = button?.dataset.subjectId;

  if (activeView === "words" && button && wordCard) {
    const word = words.find((item) => item.id === wordCard.dataset.wordId);
    if (!word) return;

    if (button.dataset.action === "menu") {
      const menu = wordCard.querySelector(".task-actions-menu");
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isExpanded));
      menu.hidden = isExpanded;
    } else if (button.dataset.action === "edit") {
      openWordDialog(word);
    } else if (button.dataset.action === "delete") {
      pendingDeleteItem = { type: "word", id: word.id };
      elements.deleteTitle.textContent = "Eliminar palabra";
      elements.deleteMessage.textContent = `¿Eliminar "${word.term}" y su definición? Esta acción no se puede deshacer.`;
      elements.confirmDelete.textContent = "Eliminar palabra";
      elements.deleteDialog.showModal();
    }
    return;
  }

  if (activeView === "calendar" && button?.dataset.action === "edit-subject" && subjectId) {
    const subject = subjects.find((item) => item.id === subjectId);
    if (subject) openSubjectDialog(subject);
    return;
  }

  if (activeView === "calendar" && button?.dataset.action === "delete" && subjectId) {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) return;

    pendingDeleteItem = { type: "subject", id: subject.id };
    elements.deleteTitle.textContent = "Eliminar bloque";
    elements.deleteMessage.textContent = `¿Eliminar "${subject.name}" del horario? Esta acción no se puede deshacer.`;
    elements.confirmDelete.textContent = "Eliminar bloque";
    elements.deleteDialog.showModal();
    return;
  }

  if (!button || !card) return;

  const task = tasks.find((item) => item.id === card.dataset.taskId);
  if (!task) return;

  if (button.dataset.action === "attachment") {
    openTaskAttachment(task);
    return;
  }

  if (button.dataset.action === "toggle") {
    if (!task.completed) {
      openCompletionDialog(task);
      return;
    }

    const previousTasks = tasks;
    tasks = tasks.map((item) =>
      item.id === task.id
        ? { ...item, completed: false, completedAt: null, score: null, scoreScale: null }
        : item,
    );

    if (!saveTasks()) {
      tasks = previousTasks;
      return;
    }

    render();
    showToast("Tarea devuelta a pendientes");
    return;
  }

  if (button.dataset.action === "menu") {
    const menu = card.querySelector(".task-actions-menu");
    const isExpanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isExpanded));
    menu.hidden = isExpanded;
    return;
  }

  if (button.dataset.action === "edit-task") {
    openTaskDialog(task);
    return;
  }

  if (button.dataset.action === "delete") {
    pendingDeleteItem = { type: "task", id: task.id };
    elements.deleteTitle.textContent = "Eliminar tarea";
    elements.deleteMessage.textContent = `¿Eliminar "${task.title}"? Esta acción no se puede deshacer.`;
    elements.confirmDelete.textContent = "Eliminar tarea";
    elements.deleteDialog.showModal();
  }
}

async function deleteSelectedTask() {
  if (!pendingDeleteItem) {
    elements.deleteDialog.close();
    return;
  }

  const deletedType = pendingDeleteItem.type;
  let attachmentCleanupFailed = false;
  if (pendingDeleteItem.type === "word") {
    const previousWords = words;
    words = words.filter((word) => word.id !== pendingDeleteItem.id);
    if (!saveWords()) {
      words = previousWords;
      return;
    }
  } else if (pendingDeleteItem.type === "subject") {
    const previousSubjects = subjects;
    subjects = subjects.filter((subject) => subject.id !== pendingDeleteItem.id);
    if (!saveSubjects()) {
      subjects = previousSubjects;
      return;
    }
  } else {
    const task = tasks.find((item) => item.id === pendingDeleteItem.id);
    const previousTasks = tasks;
    tasks = tasks.filter((task) => task.id !== pendingDeleteItem.id);
    if (!saveTasks()) {
      tasks = previousTasks;
      return;
    }
    if (task?.attachment) {
      try {
        await removeStoredAttachment(task.id);
      } catch (error) {
        console.error("No se pudo borrar el archivo adjunto de la tarea eliminada.", error);
        attachmentCleanupFailed = true;
      }
    }
  }

  elements.deleteDialog.close();
  pendingDeleteItem = null;
  render();
  showToast(
    attachmentCleanupFailed
      ? "La tarea se eliminó, pero su archivo adjunto no pudo borrarse."
      : activeView === "words"
        ? "Palabra eliminada"
            : deletedType === "subject"
              ? "Bloque eliminado"
            : "Tarea eliminada",
  );
}

async function openTaskAttachment(task) {
  elements.attachmentDialogTitle.textContent = task.attachment?.name ?? "Archivo de la tarea";
  elements.attachmentPreviewContent.textContent = "Cargando archivo…";
  elements.attachmentDialog.showModal();

  try {
    const storedAttachment = await getStoredAttachment(task.id);
    if (!storedAttachment) {
      elements.attachmentPreviewContent.textContent = "No se encontró el archivo adjunto en este dispositivo.";
      return;
    }

    if (!elements.attachmentDialog.open) return;
    currentAttachmentUrl = URL.createObjectURL(storedAttachment.file);
    const downloadLink = document.createElement("a");
    downloadLink.className = "attachment-download";
    downloadLink.href = currentAttachmentUrl;
    downloadLink.download = storedAttachment.name;
    downloadLink.textContent = "Descargar archivo";

    if (storedAttachment.type.startsWith("image/")) {
      const image = document.createElement("img");
      image.className = "attachment-preview-image";
      image.src = currentAttachmentUrl;
      image.alt = `Foto adjunta: ${storedAttachment.name}`;
      elements.attachmentPreviewContent.replaceChildren(image, downloadLink);
    } else {
      const preview = document.createElement("iframe");
      preview.className = "attachment-preview-pdf";
      preview.src = currentAttachmentUrl;
      preview.title = `Vista previa de ${storedAttachment.name}`;
      elements.attachmentPreviewContent.replaceChildren(preview, downloadLink);
    }
  } catch (error) {
    console.error("No se pudo abrir el archivo adjunto.", error);
    elements.attachmentPreviewContent.textContent = "No se pudo abrir el archivo adjunto.";
  }
}

function closeAttachmentPreview() {
  elements.attachmentDialog.close();
  if (currentAttachmentUrl) {
    URL.revokeObjectURL(currentAttachmentUrl);
    currentAttachmentUrl = null;
  }
}

function setActiveView(view) {
  activeView = view;
  elements.searchInput.value = "";
  elements.sortSelect.value = "due";
  render();
}

function addItemForActiveView() {
  if (activeView === "words") {
    openWordDialog();
    return;
  }
  if (activeView === "calendar") {
    openSubjectDialog();
    return;
  }
  openTaskDialog();
}

async function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === "accepted") showToast("¡Tareas se está instalando!");
    return;
  }

  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    showToast("Tareas ya está instalada en este dispositivo.");
    return;
  }

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    showToast("En Safari, toca Compartir y luego «Agregar a pantalla de inicio».");
  } else {
    showToast("Abre el menú del navegador y elige «Instalar aplicación» o «Agregar a pantalla de inicio».");
  }
}

async function shareApp() {
  const shareData = {
    title: "Tareas",
    text: "Organiza tus tareas con esta aplicación.",
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("No se pudo compartir la aplicación.", error);
    }
  }

  try {
    await navigator.clipboard.writeText(shareData.url);
    showToast("Enlace de la aplicación copiado.");
  } catch (error) {
    console.error("No se pudo copiar el enlace de la aplicación.", error);
    window.prompt("Copia el enlace de la aplicación:", shareData.url);
  }
}

function initializeTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch (error) {
    console.error("No se pudo leer el tema guardado.", error);
  }

  document.body.classList.toggle("light-theme", savedTheme === "light");
  elements.themeToggle.setAttribute("aria-pressed", String(savedTheme === "light"));
}

elements.addButton.addEventListener("click", addItemForActiveView);
elements.emptyAddButton.addEventListener("click", addItemForActiveView);
elements.closeDialog.addEventListener("click", closeTaskDialog);
elements.cancelDialog.addEventListener("click", closeTaskDialog);
elements.closeDeleteDialog.addEventListener("click", () => {
  elements.deleteDialog.close();
  pendingDeleteItem = null;
});
elements.cancelDelete.addEventListener("click", () => {
  elements.deleteDialog.close();
  pendingDeleteItem = null;
});
elements.confirmDelete.addEventListener("click", deleteSelectedTask);
elements.form.addEventListener("submit", handleSubmit);
elements.taskAttachment.addEventListener("change", () => {
  const task = tasks.find((item) => item.id === editingTaskId);
  updateTaskAttachmentStatus(task?.attachment ?? null);
});
elements.removeTaskAttachment.addEventListener("click", () => {
  const task = tasks.find((item) => item.id === editingTaskId);
  if (elements.taskAttachment.files.length) {
    elements.taskAttachment.value = "";
    updateTaskAttachmentStatus(task?.attachment ?? null);
    return;
  }
  removeCurrentAttachment = true;
  updateTaskAttachmentStatus(task?.attachment ?? null);
});
elements.completionForm.addEventListener("submit", handleCompletionSubmit);
elements.completeWithoutScore.addEventListener("click", () => finishTask());
elements.wordForm.addEventListener("submit", handleWordSubmit);
elements.taskList.addEventListener("click", handleTaskAction);
elements.searchInput.addEventListener("input", render);
elements.sortSelect.addEventListener("change", render);
elements.pendingTab.addEventListener("click", () => setActiveView("pending"));
elements.historyTab.addEventListener("click", () => setActiveView("history"));
elements.wordsTab.addEventListener("click", () => setActiveView("words"));
elements.calendarTab.addEventListener("click", () => setActiveView("calendar"));
elements.installAppButton.addEventListener("click", installApp);
elements.shareButton.addEventListener("click", shareApp);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeTaskDialog();
});
elements.wordDialog.addEventListener("click", (event) => {
  if (event.target === elements.wordDialog) closeWordDialog();
});
elements.subjectDialog.addEventListener("click", (event) => {
  if (event.target === elements.subjectDialog) closeSubjectDialog();
});
elements.completionDialog.addEventListener("click", (event) => {
  if (event.target === elements.completionDialog) closeCompletionDialog();
});
elements.attachmentDialog.addEventListener("click", (event) => {
  if (event.target === elements.attachmentDialog) closeAttachmentPreview();
});
elements.deleteDialog.addEventListener("click", (event) => {
  if (event.target === elements.deleteDialog) {
    elements.deleteDialog.close();
    pendingDeleteItem = null;
  }
});
elements.closeWordDialog.addEventListener("click", closeWordDialog);
elements.cancelWordDialog.addEventListener("click", closeWordDialog);
elements.subjectForm.addEventListener("submit", handleSubjectSubmit);
elements.closeSubjectDialog.addEventListener("click", closeSubjectDialog);
elements.cancelSubjectDialog.addEventListener("click", closeSubjectDialog);
elements.closeCompletionDialog.addEventListener("click", closeCompletionDialog);
elements.closeAttachmentDialog.addEventListener("click", closeAttachmentPreview);
elements.themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-theme");
  try {
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
  } catch (error) {
    console.error("No se pudo guardar el tema seleccionado.", error);
  }
  elements.themeToggle.setAttribute("aria-pressed", String(isLight));
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showToast("Tareas quedó instalada correctamente.");
});

initializeTheme();
render();

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("No se pudo registrar el modo sin conexión.", error);
    });
  });
}