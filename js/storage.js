// js/storage.js
// Unico archivo que lee/escribe localStorage. Guarda el registro diario de
// energia bajo la clave "mi-energia-log". Todo permanece en el dispositivo:
// nada de esto se envia a ningun servidor.

var ENERGY_LOG_KEY = 'mi-energia-log';
var EXERCISES_KEY = 'mi-energia-ejercicios';
var EXERCISE_IDS = ['ex-1-1', 'ex-2-1', 'ex-3-1', 'ex-3-2', 'ex-5-1', 'ex-6-1'];
var CHECKLISTS_KEY = 'mi-energia-checklists';
var CHECKLIST_IDS = ['daily', 'weekly'];

function todayDateString() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function getEnergyLog() {
  var raw = localStorage.getItem(ENERGY_LOG_KEY);
  var entries = [];
  try {
    entries = raw ? JSON.parse(raw) : [];
  } catch (e) {
    entries = [];
  }
  return entries.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });
}

function saveEntry(entry) {
  var raw = localStorage.getItem(ENERGY_LOG_KEY);
  var entries = [];
  try {
    entries = raw ? JSON.parse(raw) : [];
  } catch (e) {
    entries = [];
  }
  var index = entries.findIndex(function (e) {
    return e.date === entry.date;
  });
  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }
  localStorage.setItem(ENERGY_LOG_KEY, JSON.stringify(entries));
}

function getTodayEntry() {
  var today = todayDateString();
  var entries = getEnergyLog();
  var match = entries.filter(function (e) {
    return e.date === today;
  });
  return match.length ? match[0] : null;
}

function deleteAllData() {
  localStorage.removeItem(ENERGY_LOG_KEY);
  localStorage.removeItem(EXERCISES_KEY);
  localStorage.removeItem(CHECKLISTS_KEY);
}

// Comprueba recursivamente que un valor de respuesta de ejercicio es solo
// texto, booleano o un objeto anidado de esos mismos tipos (como los dias
// del Ejercicio 2.1, que guardan {nivel, nota} por cada dia).
function isValidExerciseValue(value, depth) {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (depth > 0 && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).every(function (key) {
      return isValidExerciseValue(value[key], depth - 1);
    });
  }
  return false;
}

// Valida el bloque completo de respuestas de ejercicios (una copia de
// seguridad antigua sin este bloque es valida: un objeto vacio pasa).
function isValidExercisesBlock(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(obj).every(function (id) {
    return EXERCISE_IDS.indexOf(id) !== -1 && isValidExerciseValue(obj[id], 2);
  });
}

function getAllExerciseAnswers() {
  var raw = localStorage.getItem(EXERCISES_KEY);
  var data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  return isValidExercisesBlock(data) ? data : {};
}

function getExerciseAnswers(exerciseId) {
  var all = getAllExerciseAnswers();
  return all[exerciseId] || null;
}

function saveExerciseAnswers(exerciseId, answers) {
  if (EXERCISE_IDS.indexOf(exerciseId) === -1 || !isValidExerciseValue(answers, 2)) {
    return;
  }
  var all = getAllExerciseAnswers();
  all[exerciseId] = answers;
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(all));
}

// Valida las marcas de un dia concreto: un objeto cuyas claves son ids de
// checklist conocidos y cuyos valores son arrays de booleanos (una posicion
// por item de la checklist).
function isValidChecklistDay(day) {
  if (day === null || typeof day !== 'object' || Array.isArray(day)) {
    return false;
  }
  return Object.keys(day).every(function (id) {
    return CHECKLIST_IDS.indexOf(id) !== -1 && Array.isArray(day[id]) &&
      day[id].every(function (v) { return typeof v === 'boolean'; });
  });
}

// Valida el bloque completo de marcas de checklists (una copia de seguridad
// antigua sin este bloque es valida: un objeto vacio pasa).
function isValidChecklistsBlock(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(obj).every(function (date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidChecklistDay(obj[date]);
  });
}

function getAllChecklistMarks() {
  var raw = localStorage.getItem(CHECKLISTS_KEY);
  var data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  return isValidChecklistsBlock(data) ? data : {};
}

// Devuelve las marcas de una checklist para un dia concreto (array de
// booleanos). Si no hay marcas guardadas para ese dia, la lista arranca
// vacia (equivale a "todo sin marcar": no hay rachas ni memoria entre dias).
function getChecklistMarks(date, checklistId) {
  var all = getAllChecklistMarks();
  var day = all[date];
  return (day && Array.isArray(day[checklistId])) ? day[checklistId] : [];
}

function setChecklistMark(date, checklistId, index, checked) {
  if (CHECKLIST_IDS.indexOf(checklistId) === -1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return;
  }
  var all = getAllChecklistMarks();
  var day = (all[date] && typeof all[date] === 'object') ? all[date] : {};
  var marks = Array.isArray(day[checklistId]) ? day[checklistId].slice() : [];
  // Rellena huecos con false antes del indice marcado: un array con huecos
  // (undefined) se convertiria en null al guardar como JSON, y el array
  // dejaria de ser valido (solo se aceptan booleanos).
  while (marks.length < index) {
    marks.push(false);
  }
  marks[index] = !!checked;
  day[checklistId] = marks;
  all[date] = day;
  localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(all));
}

// Serializa todos los registros y respuestas de ejercicios en un JSON
// descargable como copia de seguridad. No incluye nada más que no esté ya
// guardado en el dispositivo.
function exportDataJSON() {
  var entries = getEnergyLog();
  var exercises = getAllExerciseAnswers();
  var checklists = getAllChecklistMarks();
  return JSON.stringify({ app: 'mi-energia', version: 3, entries: entries, exercises: exercises, checklists: checklists }, null, 2);
}

function isValidLogEntry(entry) {
  return entry !== null && typeof entry === 'object' &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    ['alta', 'media', 'baja'].indexOf(entry.level) !== -1;
}

// Valida un texto como copia de seguridad de Mi Energía. No escribe nada
// en localStorage: solo parsea y comprueba el formato. Devuelve
// {entries, exercises, checklists} ya saneados, o null si no es valida. Las
// copias antiguas sin bloque de ejercicios o de checklists son válidas (se
// usa un objeto vacío para el bloque que falte).
function parseBackupJSON(jsonText) {
  var parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return null;
  }
  var entries = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(entries) || !entries.every(isValidLogEntry)) {
    return null;
  }
  var sanitizedEntries = entries.map(function (e) {
    return {
      date: e.date,
      level: e.level,
      note: typeof e.note === 'string' ? e.note : ''
    };
  });
  var rawExercises = (!Array.isArray(parsed) && parsed && parsed.exercises) || {};
  var exercises = isValidExercisesBlock(rawExercises) ? rawExercises : {};
  var rawChecklists = (!Array.isArray(parsed) && parsed && parsed.checklists) || {};
  var checklists = isValidChecklistsBlock(rawChecklists) ? rawChecklists : {};
  return { entries: sanitizedEntries, exercises: exercises, checklists: checklists };
}

// Sustituye todos los registros, respuestas de ejercicios y marcas de
// checklist actuales por los indicados. Se usa tras confirmar una importacion.
function replaceAllData(entries, exercises, checklists) {
  localStorage.setItem(ENERGY_LOG_KEY, JSON.stringify(entries));
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(exercises || {}));
  localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists || {}));
}
