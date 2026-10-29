// js/storage.js
// Unico archivo que lee/escribe localStorage. Guarda el registro diario de
// energia bajo la clave "mi-energia-log". Todo permanece en el dispositivo:
// nada de esto se envia a ningun servidor.

var ENERGY_LOG_KEY = 'mi-energia-log';
var EXERCISES_KEY = 'mi-energia-ejercicios';
var EXERCISE_IDS = ['ex-1-1', 'ex-2-1', 'ex-3-1', 'ex-3-2', 'ex-5-1', 'ex-6-1'];

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

// Serializa todos los registros y respuestas de ejercicios en un JSON
// descargable como copia de seguridad. No incluye nada más que no esté ya
// guardado en el dispositivo.
function exportDataJSON() {
  var entries = getEnergyLog();
  var exercises = getAllExerciseAnswers();
  return JSON.stringify({ app: 'mi-energia', version: 2, entries: entries, exercises: exercises }, null, 2);
}

function isValidLogEntry(entry) {
  return entry !== null && typeof entry === 'object' &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    ['alta', 'media', 'baja'].indexOf(entry.level) !== -1;
}

// Valida un texto como copia de seguridad de Mi Energía. No escribe nada
// en localStorage: solo parsea y comprueba el formato. Devuelve
// {entries, exercises} ya saneados, o null si no es valida. Las copias
// antiguas sin bloque de ejercicios son válidas (se usa un objeto vacío).
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
  return { entries: sanitizedEntries, exercises: exercises };
}

// Sustituye todos los registros y respuestas de ejercicios actuales por
// los indicados. Se usa tras confirmar una importacion.
function replaceAllData(entries, exercises) {
  localStorage.setItem(ENERGY_LOG_KEY, JSON.stringify(entries));
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(exercises || {}));
}
