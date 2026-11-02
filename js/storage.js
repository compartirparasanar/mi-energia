// js/storage.js
// Unico archivo que lee/escribe localStorage. Guarda el registro diario de
// energia bajo la clave "mi-energia-log". Todo permanece en el dispositivo:
// nada de esto se envia a ningun servidor.

var ENERGY_LOG_KEY = 'mi-energia-log';
var EXERCISES_KEY = 'mi-energia-ejercicios';
var EXERCISE_IDS = ['ex-1-1', 'ex-2-1', 'ex-3-1', 'ex-3-2', 'ex-5-1', 'ex-6-1'];
var CHECKLISTS_KEY = 'mi-energia-checklists';
var CHECKLIST_IDS = ['daily', 'weekly'];
// "Pequeño paso de hoy" (paso de un toque): mismas 6 claves que
// GUIDE_CONTENT.pasoPreguntas en content.js (las preguntas cortas basadas
// en el Ejercicio 3.2, "ladrones silenciosos"), para no duplicar ids.
var PASOS_KEY = 'mi-energia-pasos';
var PASOS_IDS = ['decisiones', 'notificaciones', 'conversaciones', 'cambios', 'ambientes', 'deberia'];
// Etiquetas opcionales del registro diario (Fase 3, "Valor de vuelta"). Se
// guardan como parte del propio registro (entry.tags), nunca bloquean el
// guardado: se pueden añadir o quitar despues de elegir un nivel.
var LOG_TAGS = ['Dormí mal', 'Mucho esfuerzo', 'Mucho estrés', 'Pude descansar'];
// Marca de "ya ha visto el resumen de Evolución" (Fase 3): un solo booleano,
// no un dato de uso. Se guarda aparte del registro para poder borrarla o
// llevarla en la copia de seguridad igual que el resto.
var RESUMEN_SEEN_KEY = 'mi-energia-resumen-visto';
// "Mis cosas" (step-14e, "Mi día"): ítems que la persona añade a mano con
// "+ Añadir la mía", además de la lista fija del autor en content.js. Los 3
// primeros grupos alimentan los grupos de Mi día; "quitan" es solo para el
// Ejercicio 1 ("¿Qué te quita energía?"), no se usa en ningún otro sitio.
var MIS_COSAS_KEY = 'mi-energia-mis-cosas';
var MIS_COSAS_GROUPS = ['pesan', 'ligeras', 'recargan', 'quitan'];
// "Mi día" (step-14e): por fecha, las cosas elegidas hoy (chosen) y cuáles
// se marcaron como hechas al "Cerrar el día" (done). Sin rachas ni memoria
// entre días: cada fecha es independiente.
var MI_DIA_KEY = 'mi-energia-mi-dia';
// Último capítulo de la guía visitado (step-14e), para la tarjeta "Seguir
// con la guía" / "Empezar la guía" de Inicio. Un solo número, no un dato de
// uso: no cuenta cuántas veces se ha leído, solo el más reciente.
var ULTIMO_CAPITULO_KEY = 'mi-energia-ultimo-capitulo';

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
  localStorage.removeItem(PASOS_KEY);
  localStorage.removeItem(RESUMEN_SEEN_KEY);
  localStorage.removeItem(MIS_COSAS_KEY);
  localStorage.removeItem(MI_DIA_KEY);
  localStorage.removeItem(ULTIMO_CAPITULO_KEY);
}

// Valida un array de etiquetas de registro: solo strings presentes en
// LOG_TAGS. Un array vacio es valido (sin etiquetas ese dia).
function isValidTagsArray(value) {
  return Array.isArray(value) && value.every(function (t) {
    return LOG_TAGS.indexOf(t) !== -1;
  });
}

// Devuelve si la persona ya ha visto el resumen de Evolución alguna vez
// (para no repetir el aviso "Tu resumen está listo" en Inicio).
function hasSeenResumen() {
  return localStorage.getItem(RESUMEN_SEEN_KEY) === '1';
}

function markResumenSeen() {
  localStorage.setItem(RESUMEN_SEEN_KEY, '1');
}

// Valida un array de "mis cosas" de un grupo: solo strings no vacíos.
function isValidCosasArray(value) {
  return Array.isArray(value) && value.every(function (v) {
    return typeof v === 'string' && v.trim() !== '';
  });
}

function isValidMisCosas(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(obj).every(function (g) {
    return MIS_COSAS_GROUPS.indexOf(g) !== -1 && isValidCosasArray(obj[g]);
  });
}

// Devuelve las 4 listas de "mis cosas" (siempre las 4 claves presentes,
// vacías si no se ha añadido nada todavía).
function getMisCosas() {
  var raw = localStorage.getItem(MIS_COSAS_KEY);
  var data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  if (!isValidMisCosas(data)) data = {};
  var result = {};
  MIS_COSAS_GROUPS.forEach(function (g) {
    result[g] = Array.isArray(data[g]) ? data[g] : [];
  });
  return result;
}

// Añade una cosa propia a un grupo (sin duplicados, ignora texto vacío).
function addMiCosa(group, label) {
  if (MIS_COSAS_GROUPS.indexOf(group) === -1) return;
  label = String(label || '').trim();
  if (!label) return;
  var all = getMisCosas();
  if (all[group].indexOf(label) === -1) {
    all[group].push(label);
    localStorage.setItem(MIS_COSAS_KEY, JSON.stringify(all));
  }
}

// Valida el registro de "Mi día" de un dia concreto: chosen (array de
// strings, lo elegido hoy) y done (objeto string->boolean, lo marcado al
// Cerrar el día). Ambos son opcionales por separado.
function isValidMiDiaDay(day) {
  if (day === null || typeof day !== 'object' || Array.isArray(day)) {
    return false;
  }
  var chosenOk = !('chosen' in day) || isValidCosasArray(day.chosen);
  var doneOk = !('done' in day) || (day.done !== null && typeof day.done === 'object' &&
    !Array.isArray(day.done) && Object.keys(day.done).every(function (k) {
      return typeof day.done[k] === 'boolean';
    }));
  return chosenOk && doneOk;
}

function isValidMiDiaBlock(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(obj).every(function (date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidMiDiaDay(obj[date]);
  });
}

function getAllMiDia() {
  var raw = localStorage.getItem(MI_DIA_KEY);
  var data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  return isValidMiDiaBlock(data) ? data : {};
}

// Devuelve lo elegido y lo marcado de un día concreto (nunca null: arrays y
// objetos vacíos si no hay nada guardado ese día).
function getMiDiaForDate(date) {
  var all = getAllMiDia();
  var day = all[date];
  return {
    chosen: (day && Array.isArray(day.chosen)) ? day.chosen : [],
    done: (day && day.done && typeof day.done === 'object') ? day.done : {}
  };
}

function setMiDiaChosen(date, chosen) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidCosasArray(chosen)) return;
  var all = getAllMiDia();
  var day = (all[date] && typeof all[date] === 'object') ? all[date] : {};
  day.chosen = chosen;
  all[date] = day;
  localStorage.setItem(MI_DIA_KEY, JSON.stringify(all));
}

function setMiDiaDone(date, label, value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof label !== 'string') return;
  var all = getAllMiDia();
  var day = (all[date] && typeof all[date] === 'object') ? all[date] : {};
  var done = (day.done && typeof day.done === 'object') ? day.done : {};
  done[label] = !!value;
  day.done = done;
  all[date] = day;
  localStorage.setItem(MI_DIA_KEY, JSON.stringify(all));
}

// Último capítulo de la guía visitado, para la tarjeta de Inicio. null si
// todavía no se ha abierto ningún capítulo.
function getUltimoCapitulo() {
  var raw = localStorage.getItem(ULTIMO_CAPITULO_KEY);
  var n = Number(raw);
  return (raw !== null && Number.isInteger(n) && n >= 1 && n <= 9) ? n : null;
}

function setUltimoCapitulo(n) {
  n = Number(n);
  if (Number.isInteger(n) && n >= 1 && n <= 9) {
    localStorage.setItem(ULTIMO_CAPITULO_KEY, String(n));
  }
}

// Comprueba recursivamente que un valor de respuesta de ejercicio es solo
// texto, booleano o un objeto anidado de esos mismos tipos (como los dias
// del Ejercicio 2.1, que guardan {nivel, nota} por cada dia).
function isValidExerciseValue(value, depth) {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(function (v) { return typeof v === 'string'; });
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

// Valida las respuestas de "pequeños pasos" de un dia concreto: un objeto
// cuyas claves son ids conocidos (PASOS_IDS) y cuyos valores son booleanos
// (true = "si me ha pasado hoy", false = "no"). Puede haber mas de una
// clave por dia si se contestó más de un "paso" ese día (botón "Otro paso").
function isValidPasosDay(day) {
  if (day === null || typeof day !== 'object' || Array.isArray(day)) {
    return false;
  }
  return Object.keys(day).every(function (key) {
    return PASOS_IDS.indexOf(key) !== -1 && typeof day[key] === 'boolean';
  });
}

// Valida el bloque completo de "pequeños pasos" (una copia de seguridad
// antigua sin este bloque es valida: un objeto vacio pasa).
function isValidPasosBlock(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(obj).every(function (date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidPasosDay(obj[date]);
  });
}

function getAllPasos() {
  var raw = localStorage.getItem(PASOS_KEY);
  var data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  return isValidPasosBlock(data) ? data : {};
}

// Devuelve las respuestas de "pequeños pasos" de un dia concreto (objeto
// clave->booleano). Si no hay nada guardado ese dia, devuelve un objeto
// vacio (no hay rachas ni memoria entre dias).
function getPasosForDate(date) {
  var all = getAllPasos();
  return (all[date] && typeof all[date] === 'object') ? all[date] : {};
}

function setPaso(date, key, value) {
  if (PASOS_IDS.indexOf(key) === -1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return;
  }
  var all = getAllPasos();
  var day = (all[date] && typeof all[date] === 'object') ? all[date] : {};
  day[key] = !!value;
  all[date] = day;
  localStorage.setItem(PASOS_KEY, JSON.stringify(all));
}

// Serializa todos los registros, respuestas de ejercicios, marcas de
// checklist, pequeños pasos y la marca de resumen visto en un JSON
// descargable como copia de seguridad. No incluye nada más que no esté ya
// guardado en el dispositivo.
function exportDataJSON() {
  var entries = getEnergyLog();
  var exercises = getAllExerciseAnswers();
  var checklists = getAllChecklistMarks();
  var pasos = getAllPasos();
  var resumenSeen = hasSeenResumen();
  var misCosas = getMisCosas();
  var miDia = getAllMiDia();
  var ultimoCapitulo = getUltimoCapitulo();
  return JSON.stringify({
    app: 'mi-energia', version: 6, entries: entries, exercises: exercises, checklists: checklists,
    pasos: pasos, resumenSeen: resumenSeen, misCosas: misCosas, miDia: miDia, ultimoCapitulo: ultimoCapitulo
  }, null, 2);
}

function isValidLogEntry(entry) {
  return entry !== null && typeof entry === 'object' &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    ['alta', 'media', 'baja'].indexOf(entry.level) !== -1;
}

// Valida un texto como copia de seguridad de Mi Energía. No escribe nada
// en localStorage: solo parsea y comprueba el formato. Devuelve
// {entries, exercises, checklists, pasos, resumenSeen} ya saneados, o null
// si no es valida. Las copias antiguas sin bloque de ejercicios,
// checklists, pasos o resumenSeen son válidas (se usa un objeto vacío o
// false para el bloque que falte).
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
      note: typeof e.note === 'string' ? e.note : '',
      tags: isValidTagsArray(e.tags) ? e.tags : []
    };
  });
  var rawExercises = (!Array.isArray(parsed) && parsed && parsed.exercises) || {};
  var exercises = isValidExercisesBlock(rawExercises) ? rawExercises : {};
  var rawChecklists = (!Array.isArray(parsed) && parsed && parsed.checklists) || {};
  var checklists = isValidChecklistsBlock(rawChecklists) ? rawChecklists : {};
  var rawPasos = (!Array.isArray(parsed) && parsed && parsed.pasos) || {};
  var pasos = isValidPasosBlock(rawPasos) ? rawPasos : {};
  var resumenSeen = (!Array.isArray(parsed) && parsed && typeof parsed.resumenSeen === 'boolean') ?
    parsed.resumenSeen : false;
  var rawMisCosas = (!Array.isArray(parsed) && parsed && parsed.misCosas) || {};
  var misCosas = isValidMisCosas(rawMisCosas) ? rawMisCosas : {};
  var rawMiDia = (!Array.isArray(parsed) && parsed && parsed.miDia) || {};
  var miDia = isValidMiDiaBlock(rawMiDia) ? rawMiDia : {};
  var rawUltimoCapitulo = (!Array.isArray(parsed) && parsed) ? parsed.ultimoCapitulo : null;
  var ultimoCapitulo = (Number.isInteger(rawUltimoCapitulo) && rawUltimoCapitulo >= 1 && rawUltimoCapitulo <= 9) ?
    rawUltimoCapitulo : null;
  return {
    entries: sanitizedEntries, exercises: exercises, checklists: checklists, pasos: pasos,
    resumenSeen: resumenSeen, misCosas: misCosas, miDia: miDia, ultimoCapitulo: ultimoCapitulo
  };
}

// Sustituye todos los registros, respuestas de ejercicios, marcas de
// checklist, pequeños pasos y la marca de resumen visto actuales por los
// indicados. Se usa tras confirmar una importacion.
function replaceAllData(entries, exercises, checklists, pasos, resumenSeen, misCosas, miDia, ultimoCapitulo) {
  localStorage.setItem(ENERGY_LOG_KEY, JSON.stringify(entries));
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(exercises || {}));
  localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists || {}));
  localStorage.setItem(PASOS_KEY, JSON.stringify(pasos || {}));
  if (resumenSeen) {
    localStorage.setItem(RESUMEN_SEEN_KEY, '1');
  } else {
    localStorage.removeItem(RESUMEN_SEEN_KEY);
  }
  localStorage.setItem(MIS_COSAS_KEY, JSON.stringify(misCosas || {}));
  localStorage.setItem(MI_DIA_KEY, JSON.stringify(miDia || {}));
  if (Number.isInteger(ultimoCapitulo) && ultimoCapitulo >= 1 && ultimoCapitulo <= 9) {
    localStorage.setItem(ULTIMO_CAPITULO_KEY, String(ultimoCapitulo));
  } else {
    localStorage.removeItem(ULTIMO_CAPITULO_KEY);
  }
}
