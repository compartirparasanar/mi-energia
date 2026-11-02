// js/views.js
// Unico archivo que modifica el DOM. Cada funcion renderiza una vista completa
// dentro de <main id="app-content">. Lee datos de GUIDE_CONTENT (js/content.js).

// Cuántas cosas se pueden elegir en Mi día segun el nivel de hoy (step-14e).
// Decisión del autor, no de la guía: un único sitio para poder cambiarla.
var MI_DIA_LIMITS = { alta: 3, media: 2, baja: 1 };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Frases de arranque que en el documento original son recuadros destacados.
// Se detectan por el texto literal (ya presente en content.js) para darles
// una caja con fondo beige, sin modificar el contenido ni su esquema.
// Las que tienen una etiqueta real (p.ej. "Objetivo del capítulo:") muestran
// esa etiqueta como eyebrow y el resto de la frase como cuerpo. Las que no
// tienen una etiqueta de ese tipo (cierres, frases sueltas) se muestran
// igual que antes, sin eyebrow — nunca se inventa un "¿Sabías que…?" donde
// el texto real no es un dato curioso.
var CALLOUT_LABELS = {
  'Objetivo del capítulo:': 'OBJETIVO DEL CAPÍTULO',
  'Objetivo de la semana:': 'OBJETIVO DE LA SEMANA',
  'Regla práctica:': 'REGLA PRÁCTICA',
  'Una única regla antes de empezar:': 'REGLA PRÁCTICA'
};

var CALLOUT_LINE_PREFIXES = Object.keys(CALLOUT_LABELS).concat([
  'Decir "ahora no puedo',
  'Después del día 21',
  'Gracias por dedicar tu energía'
]);

function isCalloutLine(line) {
  return CALLOUT_LINE_PREFIXES.some(function (prefix) {
    return line.indexOf(prefix) === 0;
  });
}

function calloutLabelFor(line) {
  var prefix = Object.keys(CALLOUT_LABELS).filter(function (p) {
    return line.indexOf(p) === 0;
  })[0];
  return prefix ? { label: CALLOUT_LABELS[prefix], prefix: prefix } : null;
}

// Convierte un bloque de texto (lineas separadas por \n, donde las lineas que
// empiezan con "- " son items de lista) en HTML con parrafos y listas.
function renderTextBlock(text) {
  var lines = String(text).split('\n');
  var html = '';
  var listBuffer = [];

  function flushList() {
    if (listBuffer.length) {
      html += '<ul>' + listBuffer.map(function (l) {
        return '<li>' + escapeHtml(l) + '</li>';
      }).join('') + '</ul>';
      listBuffer = [];
    }
  }

  lines.forEach(function (line) {
    if (line.indexOf('- ') === 0) {
      listBuffer.push(line.slice(2));
    } else {
      flushList();
      if (line.trim() !== '') {
        if (line.indexOf('@') === 0) {
          html += '<p class="signature">' + escapeHtml(line) + '</p>';
        } else if (isCalloutLine(line)) {
          var calloutLabel = calloutLabelFor(line);
          if (calloutLabel) {
            var body = line.slice(calloutLabel.prefix.length).trim();
            html += '<div class="callout"><p class="eyebrow">' + escapeHtml(calloutLabel.label) + '</p><p>' + escapeHtml(body) + '</p></div>';
          } else {
            html += '<p class="callout">' + escapeHtml(line) + '</p>';
          }
        } else {
          html += '<p>' + escapeHtml(line) + '</p>';
        }
      }
    }
  });
  flushList();
  return html;
}

// Resalta la pestana activa del menu inferior fijo segun la ruta actual.
// Se llama desde app.js tras cada render; solo actualiza clases de DOM, no
// decide ninguna ruta.
function setActiveNavTab(hash) {
  var tab = 'inicio';
  if (hash.indexOf('/pasos') === 0) {
    tab = 'dia';
  } else if (hash.indexOf('/herramientas') === 0) {
    tab = 'herramientas';
  }
  // La guia (/guia, /guia/N, /guia/toolkit, /guia/plan-21) ya no tiene
  // pestaña propia (step-14e): se abre desde una tarjeta de Inicio, asi que
  // se resalta "Inicio" mientras se navega dentro de ella. /evolucion,
  // /registro (ruta antigua sin enlace en el menu), /mis-datos, /instalar y
  // /privacidad tambien cuentan como "Inicio": el menu inferior solo tiene
  // 3 elementos (Inicio / Mi día / Herramientas).
  var links = document.querySelectorAll('.bottom-nav a');
  links.forEach(function (link) {
    if (link.getAttribute('data-nav') === tab) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

// Dias transcurridos desde una fecha YYYY-MM-DD hasta hoy, en dias civiles
// (mismo calculo UTC que usa buildEvolutionSummary para "esta semana").
function daysSinceDate(dateStr) {
  var todayParts = todayDateString().split('-').map(Number);
  var todayUTC = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
  var parts = dateStr.split('-').map(Number);
  var entryUTC = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  return Math.round((todayUTC - entryUTC) / 86400000);
}

// Sello y saludo de Inicio, con la "bienvenida de nuevo" opcional
// (step-14d). Extraido de renderHome por el limite de 150 lineas.
function homeGreetingHtml(showWelcomeBack) {
  var html = '<div class="home-seal"><img src="assets/logo_b-transparente.svg" alt="Sello compartir · para · sanar" width="160" height="160"></div>';
  html += '<div class="home-greeting"><p class="eyebrow">@compartir.para.sanar</p><h1>Hola</h1>';
  html += '<p id="home-welcome-back" class="home-welcome-back"' + (showWelcomeBack ? '' : ' hidden') +
    '>Qué bien verte. Poquito a poco.</p>';
  html += '</div>';
  return html;
}

// HTML del bloque opcional de nota en Inicio (today es la entrada de hoy, o
// null si todavia no se ha guardado nada). Extraido de renderHome para
// mantenerla dentro del limite de 150 lineas por funcion. Las etiquetas se
// quitaron de aqui en step-14e (apenas se usaban): el campo y los datos
// siguen intactos, solo se editan ahora desde Evolución.
function homeExtraSectionHtml(today) {
  var html = '<div id="home-extra-section"' + (today ? '' : ' hidden') + '>';
  html += '<button type="button" class="bento-skip-link-white" id="home-extra-toggle" aria-expanded="false">Añadir nota</button>';
  html += '<div id="home-extra-wrap" hidden>';
  html += '<label for="home-note" class="exercise-label">Nota (opcional)</label>';
  html += '<textarea id="home-note" class="field-textarea">' + escapeHtml(today ? today.note : '') + '</textarea>';
  html += '<button type="button" class="btn" id="home-note-save">Guardar nota</button>';
  html += '<p id="home-note-confirm" class="confirmation confirmation-on-dark" hidden>Nota guardada.</p>';
  html += '</div>';
  html += '</div>';
  return html;
}

// HTML del bloque "¿Y ahora qué?" en Inicio (step-14e): la frase del autor
// segun el nivel elegido, con el botón "Elegir mi día" hacia Mi día.
function homeDiaSectionHtml(today) {
  var html = '<div id="home-dia-section"' + (today ? '' : ' hidden') + '>';
  html += '<p class="eyebrow">¿Y ahora qué?</p>';
  html += '<p id="home-dia-frase" class="confirmation confirmation-on-dark">' +
    (today ? escapeHtml(GUIDE_CONTENT.miDiaFrases[today.level]) : '') + '</p>';
  html += '<a class="btn btn-on-dark" href="#/pasos">Elegir mi día</a>';
  html += '</div>';
  return html;
}

function renderHome() {
  var today = getTodayEntry();
  var entries = getEnergyLog();

  // "Bienvenida de nuevo" (step-14d): si hace 3 dias o mas que no se
  // registra nada, un saludo sin contar dias ni reprochar. Desaparece en
  // cuanto se registra (aqui, porque today ya existiria; y al momento, al
  // ocultarla a mano en el click del nivel, ver mas abajo).
  var showWelcomeBack = !today && entries.length > 0 && daysSinceDate(entries[0].date) >= 3;

  var html = homeGreetingHtml(showWelcomeBack);

  html += '<div class="bento-grid">';

  html += '<div class="bento-card bento-card-hero">';
  html += '<h2>¿Cómo está tu energía hoy?</h2>';
  html += '<div class="bento-hero-well">';
  html += '<div class="level-buttons" id="home-level-buttons">';
  ['alta', 'media', 'baja'].forEach(function (level) {
    var isSelected = !!(today && today.level === level);
    html += '<button type="button" class="level-btn' + (isSelected ? ' selected' : '') +
      '" data-level="' + level + '">' + levelLabel(level) + '</button>';
  });
  html += '</div>';
  html += '</div>';
  html += '<button type="button" class="bento-skip-link-white" id="home-skip-btn">Prefiero no registrar hoy</button>';
  html += '<p id="home-log-confirm" class="confirmation confirmation-on-dark"' + (today ? '' : ' hidden') + '>' +
    (today ? 'Ya has registrado hoy. Puedes cambiarlo cuando quieras.' : 'Guardado.') + '</p>';
  html += '<p id="home-skip-msg" class="confirmation confirmation-on-dark" hidden>Vale, hoy no es necesario. Puedes registrar cuando quieras.</p>';

  // Nota opcional: nunca es un paso obligatorio entre el toque y el
  // guardado. El guardado ya ocurre al tocar un nivel (ver abajo); esta
  // sección solo aparece despues, y sigue siendo opcional.
  html += homeExtraSectionHtml(today);

  // "¿Y ahora qué?" (step-14e): la frase del autor segun el nivel, con el
  // botón que lleva a Mi día. Nunca bloquea nada.
  html += homeDiaSectionHtml(today);

  html += '</div>';

  html += '<a class="bento-card bento-card-wide bento-mini-chart" href="#/evolucion">';
  html += '<div class="bento-card-header-row"><p class="eyebrow">Últimos 7 días</p><span class="bento-card-chevron" aria-hidden="true">›</span></div>';
  html += '<h3>Tu evolución</h3>';
  if (entries.length >= 2) {
    html += '<canvas id="home-evolution-canvas"></canvas>';
  } else {
    html += '<p>Aún no hay suficientes registros para ver tu evolución.</p>';
  }
  if (entries.length >= 3 && !hasSeenResumen()) {
    html += '<p class="evolution-ready-hint">Tu resumen está listo.</p>';
  }
  html += '</a>';

  var ultimoCapitulo = getUltimoCapitulo();
  html += '<a class="bento-card bento-card-wide" href="#/guia">';
  if (ultimoCapitulo) {
    html += '<h3>Seguir con la guía</h3>';
    html += '<p>Vas por el Capítulo ' + ultimoCapitulo + ' de ' + GUIDE_CONTENT.chapters.length + '.</p>';
  } else {
    html += '<h3>Empezar la guía</h3>';
    html += '<p>9 capítulos cortos, a tu ritmo.</p>';
  }
  html += '</a>';

  html += '</div>';

  var isInstalled = window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;
  html += '<p class="home-footer">Recibes esta app por tu suscripción a @compartir.para.sanar.' +
    (isInstalled ? '' : ' <a href="#/instalar">Cómo instalar</a>') + '</p>';

  document.getElementById('app-content').innerHTML = html;

  if (entries.length >= 2) {
    var canvas = document.getElementById('home-evolution-canvas');
    drawEvolutionChart(canvas, entries.slice(0, 7).reverse());
  }

  var levelButtons = document.querySelectorAll('#home-level-buttons .level-btn');
  var logConfirm = document.getElementById('home-log-confirm');
  var skipMsg = document.getElementById('home-skip-msg');
  var extraSection = document.getElementById('home-extra-section');
  var extraToggle = document.getElementById('home-extra-toggle');
  var extraWrap = document.getElementById('home-extra-wrap');
  var noteTextarea = document.getElementById('home-note');
  var noteConfirm = document.getElementById('home-note-confirm');
  var diaSection = document.getElementById('home-dia-section');
  var diaFrase = document.getElementById('home-dia-frase');
  var welcomeBack = document.getElementById('home-welcome-back');

  levelButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      levelButtons.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      var level = btn.getAttribute('data-level');
      var existing = getTodayEntry();
      saveEntry({
        date: todayDateString(),
        level: level,
        note: existing ? existing.note : '',
        tags: existing && Array.isArray(existing.tags) ? existing.tags : []
      });
      if (welcomeBack) welcomeBack.hidden = true;
      skipMsg.hidden = true;
      logConfirm.textContent = 'Guardado.';
      logConfirm.hidden = false;
      extraSection.hidden = false;
      diaSection.hidden = false;
      diaFrase.textContent = GUIDE_CONTENT.miDiaFrases[level];
    });
  });

  document.getElementById('home-skip-btn').addEventListener('click', function () {
    logConfirm.hidden = true;
    skipMsg.hidden = false;
  });

  extraToggle.addEventListener('click', function () {
    var wasHidden = extraWrap.hidden;
    extraWrap.hidden = !wasHidden;
    extraToggle.setAttribute('aria-expanded', wasHidden ? 'true' : 'false');
    extraToggle.textContent = wasHidden ? 'Ocultar nota' : 'Añadir nota';
  });

  document.getElementById('home-note-save').addEventListener('click', function () {
    var existing = getTodayEntry();
    if (!existing) return;
    saveEntry({
      date: todayDateString(),
      level: existing.level,
      note: noteTextarea.value,
      tags: Array.isArray(existing.tags) ? existing.tags : []
    });
    noteConfirm.hidden = false;
  });
}

function renderGuideIndex() {
  var html = '<h1>Guía</h1>';
  html += '<details class="inline-details">';
  html += '<summary>Cómo usar esta guía</summary>';
  html += '<h2>' + escapeHtml(GUIDE_CONTENT.intro.title) + '</h2>';
  GUIDE_CONTENT.intro.sections.forEach(function (section) {
    html += renderTextBlock(section.body);
  });
  html += '</details>';
  html += '<ul class="guide-index">';
  GUIDE_CONTENT.chapters.forEach(function (ch) {
    html += '<li><a href="#/guia/' + ch.id + '">' + escapeHtml(ch.title) + '</a></li>';
  });
  html += '<li><a href="#/guia/plan-21">Plan día a día (21 días)</a></li>';
  html += '</ul>';
  document.getElementById('app-content').innerHTML = html;
}

// HTML del Ejercicio 1 ("Mis dos listas"): dos pantallas de chips tocables.
// Lo que se toca en la pantalla 2 ("qué te devuelve energía") queda también
// como elección inicial del grupo "Me recargan" de Mi día (decisión A del
// plan); lo que se toca en la pantalla 1 es solo para tomar conciencia, no
// afecta a Mi día. "+ Añadir" en cualquiera de las dos guarda en mis-cosas.
function ejercicioE1Html() {
  var cfg = GUIDE_CONTENT.ejercicioE1;
  var saved = getExerciseAnswers('ex-3-1') || { quitan: [], recargan: [] };
  var misCosas = getMisCosas();
  var html = '<h3>' + escapeHtml(cfg.titulo) + '</h3>';
  ['pantalla1', 'pantalla2'].forEach(function (key, i) {
    var group = i === 0 ? 'quitan' : 'recargan';
    var answerKey = i === 0 ? 'quitan' : 'recargan';
    var pantalla = cfg[key];
    var items = pantalla.chips.concat(misCosas[group] || []);
    html += '<p class="exercise-label">' + escapeHtml(pantalla.pregunta) + '</p>';
    html += '<div class="tag-chips ejercicio-e1-chips" data-answer-key="' + answerKey + '" data-mis-cosas-group="' + group + '">';
    items.forEach(function (item) {
      var isChecked = saved[answerKey] && saved[answerKey].indexOf(item) !== -1;
      html += '<button type="button" class="tag-chip ejercicio-e1-item' + (isChecked ? ' selected' : '') +
        '" data-item="' + escapeHtml(item) + '">' + escapeHtml(item) + '</button>';
    });
    html += '</div>';
    html += '<div class="mi-dia-add-row">';
    html += '<input type="text" class="exercise-input ejercicio-e1-add-input" data-mis-cosas-group="' + group + '" data-answer-key="' + answerKey + '" placeholder="Añadir la mía">';
    html += '<button type="button" class="btn btn-secondary ejercicio-e1-add-btn" data-mis-cosas-group="' + group + '" data-answer-key="' + answerKey + '">+ Añadir la mía</button>';
    html += '</div>';
  });
  html += '<p class="confirmation" id="ejercicio-e1-final"' + (saved.recargan && saved.recargan.length ? '' : ' hidden') + '>' + escapeHtml(cfg.final) + '</p>';
  return html;
}

// Conecta los chips y "+ Añadir" del Ejercicio 1 (ver ejercicioE1Html).
// Cada toque guarda al instante; el de la pantalla 2 ("recargan") también
// se refleja en las cosas elegidas hoy en Mi día (decisión A del plan).
function wireEjercicioE1() {
  var today = todayDateString();

  function toggleItem(answerKey, group, item, btn) {
    var saved = getExerciseAnswers('ex-3-1') || { quitan: [], recargan: [] };
    var list = Array.isArray(saved[answerKey]) ? saved[answerKey].slice() : [];
    var idx = list.indexOf(item);
    var nowSelected;
    if (idx === -1) { list.push(item); nowSelected = true; } else { list.splice(idx, 1); nowSelected = false; }
    saved[answerKey] = list;
    saveExerciseAnswers('ex-3-1', saved);
    btn.classList.toggle('selected', nowSelected);
    if (group === 'recargan') {
      var chosen = getMiDiaForDate(today).chosen.slice();
      var cIdx = chosen.indexOf(item);
      if (nowSelected && cIdx === -1) chosen.push(item);
      if (!nowSelected && cIdx !== -1) chosen.splice(cIdx, 1);
      setMiDiaChosen(today, chosen);
    }
    var finalMsg = document.getElementById('ejercicio-e1-final');
    if (finalMsg) finalMsg.hidden = !(saved.recargan && saved.recargan.length);
  }

  document.querySelectorAll('.ejercicio-e1-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.ejercicio-e1-chips');
      toggleItem(wrap.getAttribute('data-answer-key'), wrap.getAttribute('data-mis-cosas-group'), btn.getAttribute('data-item'), btn);
    });
  });

  document.querySelectorAll('.ejercicio-e1-add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-mis-cosas-group');
      var answerKey = btn.getAttribute('data-answer-key');
      var input = document.querySelector('.ejercicio-e1-add-input[data-mis-cosas-group="' + group + '"]');
      var label = input ? input.value.trim() : '';
      if (!label) return;
      addMiCosa(group, label);
      var content = document.getElementById('ejercicio-e1-content');
      content.innerHTML = ejercicioE1Html();
      wireEjercicioE1();
      var newBtn = content.querySelector('.ejercicio-e1-item[data-item="' + CSS.escape(label) + '"]');
      if (newBtn && !newBtn.classList.contains('selected')) {
        var wrap = newBtn.closest('.ejercicio-e1-chips');
        toggleItem(wrap.getAttribute('data-answer-key'), group, label, newBtn);
      }
    });
  });
}

// HTML del Ejercicio 2 ("Mi ritual mínimo"): un momento del día y hasta 3
// pasos tocados de la lista del autor. Sin límite forzado: la propia
// instrucción ("toca 3 pasos") ya guía cuántos elegir.
function ejercicioE2Html() {
  var cfg = GUIDE_CONTENT.ejercicioE2;
  var saved = getExerciseAnswers('ex-5-1') || { momento: '', pasos: [] };
  var html = '<h3>' + escapeHtml(cfg.titulo) + '</h3>';
  html += '<p class="exercise-label">' + escapeHtml(cfg.intro1) + '</p>';
  html += '<div class="tag-chips" id="ejercicio-e2-momento">';
  ['Mañana', 'Tarde', 'Noche'].forEach(function (m) {
    html += '<button type="button" class="tag-chip ejercicio-e2-momento-btn' + (saved.momento === m ? ' selected' : '') +
      '" data-momento="' + escapeHtml(m) + '">' + escapeHtml(m) + '</button>';
  });
  html += '</div>';
  html += '<p class="exercise-label">' + escapeHtml(cfg.intro2) + '</p>';
  html += '<div class="tag-chips" id="ejercicio-e2-pasos">';
  cfg.opciones.forEach(function (opt) {
    var isChecked = Array.isArray(saved.pasos) && saved.pasos.indexOf(opt) !== -1;
    html += '<button type="button" class="tag-chip ejercicio-e2-paso-btn' + (isChecked ? ' selected' : '') +
      '" data-paso="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</button>';
  });
  html += '</div>';
  html += '<p class="confirmation" id="ejercicio-e2-final"' + (saved.pasos && saved.pasos.length ? '' : ' hidden') + '>' + escapeHtml(cfg.final) + '</p>';
  return html;
}

function wireEjercicioE2() {
  function save(momento, pasos) {
    saveExerciseAnswers('ex-5-1', { momento: momento, pasos: pasos });
    var finalMsg = document.getElementById('ejercicio-e2-final');
    if (finalMsg) finalMsg.hidden = !(pasos && pasos.length);
  }
  document.querySelectorAll('.ejercicio-e2-momento-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var saved = getExerciseAnswers('ex-5-1') || { momento: '', pasos: [] };
      document.querySelectorAll('.ejercicio-e2-momento-btn').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      save(btn.getAttribute('data-momento'), saved.pasos || []);
    });
  });
  document.querySelectorAll('.ejercicio-e2-paso-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var saved = getExerciseAnswers('ex-5-1') || { momento: '', pasos: [] };
      var pasos = Array.isArray(saved.pasos) ? saved.pasos.slice() : [];
      var paso = btn.getAttribute('data-paso');
      var idx = pasos.indexOf(paso);
      if (idx === -1) { pasos.push(paso); btn.classList.add('selected'); } else { pasos.splice(idx, 1); btn.classList.remove('selected'); }
      save(saved.momento || '', pasos);
    });
  });
}

// HTML del Ejercicio 3 ("El filtro de las 3 preguntas"). No se guarda
// respuesta: es una herramienta para usar cada vez con una situación nueva.
function ejercicioE3Html() {
  var cfg = GUIDE_CONTENT.ejercicioE3;
  var html = '<h3>' + escapeHtml(cfg.titulo) + '</h3>';
  cfg.preguntas.forEach(function (pregunta, i) {
    html += '<p class="paso-question">' + escapeHtml(pregunta) + '</p>';
    html += '<div class="confirm-buttons ejercicio-e3-pregunta" data-index="' + i + '">';
    html += '<button type="button" class="btn ejercicio-e3-si" data-index="' + i + '">Sí</button>';
    html += '<button type="button" class="btn btn-secondary ejercicio-e3-no" data-index="' + i + '">No</button>';
    html += '</div>';
  });
  html += '<div id="ejercicio-e3-resultado" hidden>';
  html += '<p class="confirmation">' + escapeHtml(cfg.resultadoIntro) + '</p>';
  cfg.frases.forEach(function (frase, i) {
    html += '<p class="ejercicio-e3-frase">' + escapeHtml(frase) +
      ' <button type="button" class="btn btn-secondary ejercicio-e3-copiar" data-frase="' + escapeHtml(frase) + '">Copiar frase</button></p>';
  });
  html += '</div>';
  return html;
}

function wireEjercicioE3() {
  var respuestas = {};
  var resultado = document.getElementById('ejercicio-e3-resultado');

  function responder(index, valor, siBtn, noBtn) {
    respuestas[index] = valor;
    siBtn.classList.toggle('selected', valor === true);
    noBtn.classList.toggle('selected', valor === false);
    var answeredCount = Object.keys(respuestas).length;
    if (answeredCount < 3) { resultado.hidden = true; return; }
    var algunNo = Object.keys(respuestas).some(function (k) { return respuestas[k] === false; });
    resultado.hidden = !algunNo;
  }

  document.querySelectorAll('.ejercicio-e3-pregunta').forEach(function (group) {
    var index = group.getAttribute('data-index');
    var siBtn = group.querySelector('.ejercicio-e3-si');
    var noBtn = group.querySelector('.ejercicio-e3-no');
    siBtn.addEventListener('click', function () { responder(index, true, siBtn, noBtn); });
    noBtn.addEventListener('click', function () { responder(index, false, siBtn, noBtn); });
  });

  document.querySelectorAll('.ejercicio-e3-copiar').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var frase = btn.getAttribute('data-frase');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(frase).then(function () {
          btn.textContent = 'Copiada';
        }).catch(function () {
          btn.textContent = 'No se pudo copiar';
        });
      }
    });
  });
}

// Pestaña "Herramientas" (step-14e): los 3 ejercicios de menos de 2 minutos,
// cada uno plegado por defecto, y un enlace discreto a la guía al final.
function renderEjercicios() {
  var html = '<h1>Herramientas</h1>';
  html += '<p>' + escapeHtml(GUIDE_CONTENT.ejerciciosIntro) + '</p>';

  html += '<details class="inline-details exercise-card" id="ejercicio-e1">';
  html += '<summary>' + escapeHtml(GUIDE_CONTENT.ejercicioE1.titulo) + '</summary>';
  html += '<div id="ejercicio-e1-content">' + ejercicioE1Html() + '</div>';
  html += '</details>';

  html += '<details class="inline-details exercise-card" id="ejercicio-e2">';
  html += '<summary>' + escapeHtml(GUIDE_CONTENT.ejercicioE2.titulo) + '</summary>';
  html += '<div id="ejercicio-e2-content">' + ejercicioE2Html() + '</div>';
  html += '</details>';

  html += '<details class="inline-details exercise-card" id="ejercicio-e3">';
  html += '<summary>' + escapeHtml(GUIDE_CONTENT.ejercicioE3.titulo) + '</summary>';
  html += '<div id="ejercicio-e3-content">' + ejercicioE3Html() + '</div>';
  html += '</details>';

  html += '<p class="chapter-end-msg"><a href="#/guia">Leer la guía</a></p>';

  document.getElementById('app-content').innerHTML = html;
  wireEjercicioE1();
  wireEjercicioE2();
  wireEjercicioE3();
}

// (step-14e: EXERCISE_SCHEMA/exerciseFormHtml/initExerciseForm/
// initExerciseToggle se quitaron de aquí — los ejercicios ya no tienen
// formulario dentro del capítulo. Lo que sigue interactivo (E1 y E2) vive
// en Herramientas, con su propio HTML/wiring; ver renderEjercicios.)

// Ejercicios que ahora se hacen tocando desde Herramientas (step-14e): si
// un ejercicio del capítulo es uno de estos dos, se añade un enlace
// discreto para no perder el acceso a su version interactiva.
var CHAPTER_EXERCISE_TOOL_LINKS = {
  'Ejercicio 3.1': true,
  'Ejercicio 5.1': true
};

function renderChapter(id) {
  var container = document.getElementById('app-content');
  var ch = GUIDE_CONTENT.chapters[Number(id) - 1];
  if (!ch) {
    container.innerHTML = '<h1>Capítulo no encontrado</h1><p><a href="#/guia">Volver a la guía</a></p>';
    return;
  }
  setUltimoCapitulo(Number(id));
  // El título real ya incluye "Capítulo N — Título" (content.js). La etiqueta
  // "CAPÍTULO N DE 9" se muestra por separado como eyebrow, así que aquí se
  // usa solo la parte posterior al guión para no repetir el número dos veces.
  var titleParts = ch.title.split(' — ');
  var chapterTitleText = titleParts.length > 1 ? titleParts.slice(1).join(' — ') : ch.title;

  var html = '<a class="chapter-back-link" href="#/guia">‹ Mi guía</a>';
  html += '<p class="eyebrow">CAPÍTULO ' + Number(id) + ' DE ' + GUIDE_CONTENT.chapters.length + '</p>';
  html += '<h1 class="chapter-title">' + escapeHtml(chapterTitleText) + '</h1>';
  var chapterChecklistIds = [];
  ch.sections.forEach(function (section) {
    if (section.heading) {
      html += '<h2>' + escapeHtml(section.heading) + '</h2>';
    }
    // La checklist diaria y la semanal del Capítulo 7 son el mismo contenido
    // que GUIDE_CONTENT.toolkit.dailyChecklist / weeklyChecklist (misma
    // frase literal). Se detectan por el título exacto para dibujarlas como
    // casillas reales en vez de texto plano, sin duplicar los datos.
    if (section.heading === GUIDE_CONTENT.toolkit.dailyChecklist.title) {
      html += renderChecklistHtml('daily', GUIDE_CONTENT.toolkit.dailyChecklist.items);
      chapterChecklistIds.push('daily');
    } else if (section.heading === GUIDE_CONTENT.toolkit.weeklyChecklist.title) {
      html += renderChecklistHtml('weekly', GUIDE_CONTENT.toolkit.weeklyChecklist.items);
      chapterChecklistIds.push('weekly');
    } else {
      html += renderTextBlock(section.body);
    }
  });
  // step-14e: los ejercicios ya no tienen formulario dentro del capítulo
  // (ninguno se borra, se quedan como lectura; 3.1 y 5.1 se hacen tocando
  // desde Herramientas, con un enlace para encontrarlos).
  if (ch.exercises.length) {
    html += '<h2>Ejercicios</h2>';
    ch.exercises.forEach(function (exercise) {
      html += '<div class="exercise-card">';
      html += '<h3>' + escapeHtml(exercise.title) + '</h3>';
      html += renderTextBlock(exercise.instructions);
      var toolMatch = Object.keys(CHAPTER_EXERCISE_TOOL_LINKS).filter(function (prefix) {
        return exercise.title.indexOf(prefix) === 0;
      })[0];
      if (toolMatch) {
        html += '<p><a href="#/herramientas">Puedes hacerlo tocando, en Herramientas.</a></p>';
      }
      html += '</div>';
    });
  }
  if (Number(id) === 8) {
    html += '<div class="chapter-plan-link-wrap"><a class="btn btn-outline" href="#/guia/plan-21">Ver el plan día a día</a></div>';
  }
  var nextCh = GUIDE_CONTENT.chapters[Number(id)];
  html += '<p class="chapter-end-msg">Has llegado al final de este capítulo. Vuelve cuando quieras, a tu ritmo.</p>';
  if (nextCh) {
    html += '<div class="chapter-next-wrap"><a class="btn" href="#/guia/' + nextCh.id + '">Siguiente →</a></div>';
  } else {
    html += '<div class="chapter-next-wrap"><a class="btn" href="#/guia">Volver a la guía</a></div>';
  }
  container.innerHTML = html;
  chapterChecklistIds.forEach(function (checklistId) {
    initChecklist(checklistId);
  });
}

// Dibuja una checklist (diaria o semanal) como casillas reales, marcables
// con un toque. Las marcas se guardan por el dia de hoy: cada dia la lista
// arranca sin marcar, sin rachas ni porcentajes ni mensajes de logro. El
// texto de cada item es el literal de la guia, quitando solo el simbolo ☐
// que ahora sustituye la casilla real.
function renderChecklistHtml(checklistId, items) {
  var marks = getChecklistMarks(todayDateString(), checklistId);
  var html = '<ul class="checklist" data-checklist-id="' + checklistId + '">';
  items.forEach(function (item, i) {
    var label = String(item).replace(/^☐\s*/, '');
    var checked = marks[i] === true ? ' checked' : '';
    html += '<li><label class="checklist-check"><input type="checkbox" data-checklist-index="' + i + '"' +
      checked + '> ' + escapeHtml(label) + '</label></li>';
  });
  html += '</ul>';
  return html;
}

// Conecta las casillas de una checklist ya insertada en el DOM. Puede haber
// como mucho una instancia de cada checklist en pantalla a la vez (la del
// capítulo 7 o la del Toolkit, nunca las dos juntas).
function initChecklist(checklistId) {
  var today = todayDateString();
  var list = document.querySelector('.checklist[data-checklist-id="' + checklistId + '"]');
  if (!list) return;
  var inputs = list.querySelectorAll('input[type="checkbox"]');
  inputs.forEach(function (input) {
    input.addEventListener('change', function () {
      var index = Number(input.getAttribute('data-checklist-index'));
      setChecklistMark(today, checklistId, index, input.checked);
    });
  });
}

function renderToolkit() {
  var html = '<a class="chapter-back-link" href="#/guia">‹ Mi guía</a>';
  html += '<h1>Tu kit de herramientas</h1><div class="toolkit-grid">';

  html += '<div class="card"><h2>' + escapeHtml(GUIDE_CONTENT.toolkit.dailyChecklist.title) + '</h2>';
  html += renderChecklistHtml('daily', GUIDE_CONTENT.toolkit.dailyChecklist.items);
  html += '</div>';

  html += '<div class="card"><h2>' + escapeHtml(GUIDE_CONTENT.toolkit.weeklyChecklist.title) + '</h2>';
  html += renderChecklistHtml('weekly', GUIDE_CONTENT.toolkit.weeklyChecklist.items);
  html += '</div>';

  [GUIDE_CONTENT.toolkit.fatigueLog, GUIDE_CONTENT.toolkit.energyMap].forEach(function (tool) {
    html += '<div class="card"><h2>' + escapeHtml(tool.title) + '</h2><ul>';
    tool.items.forEach(function (item) {
      html += '<li>' + escapeHtml(item) + '</li>';
    });
    html += '</ul></div>';
  });

  html += '</div><p><a href="#/guia">Volver a la guía</a></p>';
  document.getElementById('app-content').innerHTML = html;
  initChecklist('daily');
  initChecklist('weekly');
}

// Indice deterministico para elegir, segun la fecha de calendario, cual de
// las 6 preguntas de GUIDE_CONTENT.pasoPreguntas se muestra como paso de un
// toque. Mismo dia natural => mismo indice siempre (nunca al azar); avanza
// un item cada dia y da la vuelta cada 6 dias.
function pasoIndexForDate(dateStr) {
  var parts = String(dateStr).split('-');
  var items = GUIDE_CONTENT.pasoPreguntas;
  if (parts.length !== 3) return 0;
  var days = Math.floor(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / 86400000);
  var n = items.length;
  return ((days % n) + n) % n;
}

// HTML de la tarjeta de "paso de un toque". offset permite ver "Otro paso"
// sin cambiar de dia: se suma al indice del dia y se le aplica el modulo,
// así que nunca se sale del rango de las 6 preguntas.
function renderPasoCardHtml(offset) {
  var items = GUIDE_CONTENT.pasoPreguntas;
  var today = todayDateString();
  var idx = (pasoIndexForDate(today) + (offset || 0)) % items.length;
  var item = items[idx];
  var todayPasos = getPasosForDate(today);
  var answered = Object.prototype.hasOwnProperty.call(todayPasos, item.key);

  var html = '<div class="card paso-card">';
  html += '<p class="eyebrow">Pequeño paso de hoy</p>';
  if (answered) {
    html += '<p class="confirmation">' + escapeHtml(GUIDE_CONTENT.pasoCierre) + '</p>';
  } else {
    html += '<p class="paso-question">' + escapeHtml(item.label) + '</p>';
    html += '<div class="confirm-buttons">';
    html += '<button type="button" class="btn" id="paso-si-btn" data-paso-key="' + item.key + '">Sí</button>';
    html += '<button type="button" class="btn btn-secondary" id="paso-no-btn" data-paso-key="' + item.key + '">No</button>';
    html += '</div>';
  }
  html += '<button type="button" class="btn btn-outline paso-otro-btn" id="paso-otro-btn">Otro paso</button>';
  html += '</div>';
  return html;
}

function wirePasoCard(container, currentOffset, onOffsetChange) {
  var today = todayDateString();
  var siBtn = container.querySelector('#paso-si-btn');
  var noBtn = container.querySelector('#paso-no-btn');
  if (siBtn) {
    siBtn.addEventListener('click', function () {
      setPaso(today, siBtn.getAttribute('data-paso-key'), true);
      onOffsetChange(currentOffset);
    });
  }
  if (noBtn) {
    noBtn.addEventListener('click', function () {
      setPaso(today, noBtn.getAttribute('data-paso-key'), false);
      onOffsetChange(currentOffset);
    });
  }
  var otroBtn = container.querySelector('#paso-otro-btn');
  if (otroBtn) {
    otroBtn.addEventListener('click', function () {
      onOffsetChange(currentOffset + 1);
    });
  }
}

// Fecha de ayer (YYYY-MM-DD), para "Repetir lo de ayer".
function yesterdayDateString() {
  var parts = todayDateString().split('-').map(Number);
  var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

// Nivel que manda hoy en Mi día: el de hoy si ya se registró, si no el del
// registro mas reciente, y si no hay ninguno, "media" (sin presionar a
// elegir un nivel antes de poder usar Mi día).
function miDiaLevelForToday() {
  var today = getTodayEntry();
  if (today) return today.level;
  var entries = getEnergyLog();
  return entries.length ? entries[0].level : 'media';
}

// HTML de un grupo de "Mis cosas" (Pesan / Ligeras / Me recargan): chips
// tocables mas lo añadido a mano, y el campo "+ Añadir la mía" al final.
function miDiaGroupHtml(groupKey, chosen, misCosas, isOpen) {
  var group = GUIDE_CONTENT.miDia.grupos[groupKey];
  var items = group.items.concat(misCosas[groupKey] || []);
  var html = '<details class="inline-details mi-dia-group"' + (isOpen ? ' open' : '') + '>';
  html += '<summary>' + escapeHtml(group.label) + '</summary>';
  html += '<div class="tag-chips" data-group="' + groupKey + '">';
  items.forEach(function (item) {
    var isChosen = chosen.indexOf(item) !== -1;
    html += '<button type="button" class="tag-chip mi-dia-item' + (isChosen ? ' selected' : '') +
      '" data-item="' + escapeHtml(item) + '">' + escapeHtml(item) + '</button>';
  });
  html += '</div>';
  html += '<div class="mi-dia-add-row">';
  html += '<input type="text" class="exercise-input mi-dia-add-input" data-group="' + groupKey + '" placeholder="Añadir la mía">';
  html += '<button type="button" class="btn btn-secondary mi-dia-add-btn" data-group="' + groupKey + '">+ Añadir la mía</button>';
  html += '</div>';
  html += '</details>';
  return html;
}

// HTML de "Cerrar el día": una casilla por cada cosa elegida hoy (todas
// opcionales) y el botón de cierre. Sin casillas si no se eligió nada, pero
// el botón sigue disponible: cerrar el día no depende de haber elegido algo.
function cerrarElDiaHtml(chosen, done) {
  var cfg = GUIDE_CONTENT.miDia.cerrarElDia;
  var html = '<h2>' + escapeHtml(cfg.titulo) + '</h2>';
  html += '<p>' + escapeHtml(cfg.pregunta) + '</p>';
  if (chosen.length) {
    html += '<div class="mi-dia-cerrar-list">';
    chosen.forEach(function (item) {
      var checked = done[item] === true ? ' checked' : '';
      html += '<label class="checklist-check"><input type="checkbox" class="mi-dia-done-check" data-item="' +
        escapeHtml(item) + '"' + checked + '> ' + escapeHtml(item) + '</label>';
    });
    html += '</div>';
  }
  html += '<button type="button" class="btn" id="mi-dia-cerrar-btn">' + escapeHtml(cfg.titulo) + '</button>';
  html += '<p id="mi-dia-cerrar-msg" class="confirmation" hidden></p>';
  return html;
}

function renderMiDia() {
  var today = todayDateString();
  var level = miDiaLevelForToday();
  var miDiaToday = getMiDiaForDate(today);
  var misCosas = getMisCosas();
  var order = GUIDE_CONTENT.miDia.ordenPorNivel[level];
  var everUsed = Object.keys(getAllMiDia()).length > 0;
  var yesterdayChosen = getMiDiaForDate(yesterdayDateString()).chosen;

  var html = '<h1>Mi día</h1>';
  html += '<p class="eyebrow">' + escapeHtml(GUIDE_CONTENT.miDia.subtitulos[level]) + '</p>';
  if (!everUsed) {
    html += '<div class="callout"><p>' + escapeHtml(GUIDE_CONTENT.miDia.primeraVez) + '</p></div>';
  }
  if (yesterdayChosen.length) {
    html += '<button type="button" class="btn btn-outline" id="mi-dia-repetir-btn">Repetir lo de ayer</button>';
  }

  html += '<div id="mi-dia-groups">';
  order.forEach(function (groupKey, i) {
    html += miDiaGroupHtml(groupKey, miDiaToday.chosen, misCosas, i === 0);
  });
  html += '</div>';
  html += '<p id="mi-dia-limit-warning" class="confirmation" hidden></p>';
  html += '<div id="mi-dia-cerrar-wrap">' + cerrarElDiaHtml(miDiaToday.chosen, miDiaToday.done) + '</div>';

  html += '<details class="inline-details" id="mi-dia-paso-section">';
  html += '<summary>Pequeño paso de hoy</summary>';
  html += '<div id="mi-dia-paso-content">' + renderPasoCardHtml(0) + '</div>';
  html += '</details>';
  html += '<p class="chapter-end-msg"><a href="#/herramientas">¿Dudas si meter algo más? Pruébalo aquí</a></p>';

  document.getElementById('app-content').innerHTML = html;
  wireMiDiaPaso(0);
  wireMiDiaGroups(level, MI_DIA_LIMITS[level]);
  wireMiDiaAddForms();
  wireMiDiaCerrar();
  var repetirBtn = document.getElementById('mi-dia-repetir-btn');
  if (repetirBtn) {
    repetirBtn.addEventListener('click', function () {
      setMiDiaChosen(today, yesterdayChosen.slice());
      renderMiDia();
    });
  }
}

// Vuelve a pintar solo "Cerrar el día" (tras elegir/quitar/añadir una cosa),
// sin tocar los grupos plegables ni su estado abierto/cerrado.
function refreshCerrarElDia() {
  var miDiaToday = getMiDiaForDate(todayDateString());
  var wrap = document.getElementById('mi-dia-cerrar-wrap');
  wrap.innerHTML = cerrarElDiaHtml(miDiaToday.chosen, miDiaToday.done);
  wireMiDiaCerrar();
}

function wireMiDiaPaso(offset) {
  var content = document.getElementById('mi-dia-paso-content');
  wirePasoCard(content, offset, function (nextOffset) {
    content.innerHTML = renderPasoCardHtml(nextOffset);
    wireMiDiaPaso(nextOffset);
  });
}

function wireMiDiaCerrar() {
  var today = todayDateString();
  var checks = document.querySelectorAll('.mi-dia-done-check');
  checks.forEach(function (input) {
    input.addEventListener('change', function () {
      setMiDiaDone(today, input.getAttribute('data-item'), input.checked);
    });
  });
  var cerrarBtn = document.getElementById('mi-dia-cerrar-btn');
  var cerrarMsg = document.getElementById('mi-dia-cerrar-msg');
  if (cerrarBtn) {
    cerrarBtn.addEventListener('click', function () {
      var cfg = GUIDE_CONTENT.miDia.cerrarElDia;
      var anyChecked = Array.prototype.some.call(checks, function (input) { return input.checked; });
      cerrarMsg.textContent = anyChecked ? cfg.mensajeConMarcas : cfg.mensajeSinMarcas;
      cerrarMsg.hidden = false;
    });
  }
}

// Campos "+ Añadir la mía" de cada grupo: añade a mis-cosas y la elige de
// una vez (sin pasar dos veces por lo mismo).
function wireMiDiaAddForms() {
  document.querySelectorAll('.mi-dia-add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      var input = document.querySelector('.mi-dia-add-input[data-group="' + group + '"]');
      var label = input ? input.value.trim() : '';
      if (!label) return;
      addMiCosa(group, label);
      input.value = '';
      renderMiDia();
    });
  });
}

// Toca una cosa: si ya estaba elegida, siempre se puede quitar. Si no, y ya
// se llegó al límite del nivel, muestra el aviso suave con "Añadir
// igualmente" en vez de añadirla directamente — nunca bloquea del todo.
function wireMiDiaGroups(level, limit) {
  var today = todayDateString();
  var warning = document.getElementById('mi-dia-limit-warning');

  function hideWarning() {
    warning.hidden = true;
    warning.innerHTML = '';
  }

  function selectItem(item, btn) {
    var current = getMiDiaForDate(today).chosen.slice();
    if (current.indexOf(item) === -1) current.push(item);
    setMiDiaChosen(today, current);
    btn.classList.add('selected');
    hideWarning();
    refreshCerrarElDia();
  }

  function showLimitWarning(item, btn) {
    hideWarning();
    var text = document.createElement('span');
    text.textContent = GUIDE_CONTENT.miDia.avisoLimite.replace('{n}', String(limit)) + ' ';
    var addAnyway = document.createElement('button');
    addAnyway.type = 'button';
    addAnyway.className = 'btn btn-secondary';
    addAnyway.textContent = 'Añadir igualmente';
    addAnyway.addEventListener('click', function () { selectItem(item, btn); });
    warning.appendChild(text);
    warning.appendChild(addAnyway);
    warning.hidden = false;
  }

  document.querySelectorAll('.mi-dia-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.getAttribute('data-item');
      if (btn.classList.contains('selected')) {
        var current = getMiDiaForDate(today).chosen.slice();
        var idx = current.indexOf(item);
        if (idx !== -1) current.splice(idx, 1);
        setMiDiaChosen(today, current);
        btn.classList.remove('selected');
        hideWarning();
        refreshCerrarElDia();
        return;
      }
      if (getMiDiaForDate(today).chosen.length >= limit) {
        showLimitWarning(item, btn);
        return;
      }
      selectItem(item, btn);
    });
  });
}

function renderActionPlan() {
  var html = '<a class="chapter-back-link" href="#/guia/8">‹ Volver al capítulo 8</a>';
  html += '<h1>Plan de acción de 21 días</h1>';
  GUIDE_CONTENT.actionPlan.weeks.forEach(function (week) {
    html += '<h2>' + escapeHtml(week.name) + '</h2>';
    html += '<div class="callout"><p class="eyebrow">OBJETIVO DE LA SEMANA</p><p>' + escapeHtml(week.objective) + '</p></div>';
    html += '<details class="inline-details">';
    html += '<summary>Ver día a día</summary>';
    html += '<div class="plan-week">';
    week.days.forEach(function (day) {
      html += '<h3>' + escapeHtml(day.title) + '</h3>';
      html += renderTextBlock(day.description);
    });
    html += '</div>';
    html += '</details>';
  });
  html += '<p><a href="#/guia">Volver a la guía</a></p>';
  document.getElementById('app-content').innerHTML = html;
}

function levelLabel(level) {
  if (level === 'alta') return '🟢 Alta';
  if (level === 'media') return '🟡 Media';
  if (level === 'baja') return '🔴 Baja';
  return level;
}

function levelBadgeClass(level) {
  if (level === 'alta') return 'badge-success';
  if (level === 'media') return 'badge-warning';
  if (level === 'baja') return 'badge-danger';
  return '';
}

var LOG_MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Formato de fecha solo para mostrar (no se usa para guardar ni comparar).
function formatDisplayDate(dateStr) {
  var parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  var day = Number(parts[2]);
  var month = LOG_MONTH_NAMES[Number(parts[1]) - 1] || '';
  return day + ' de ' + month;
}

var LOG_MONTH_SHORT_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Formato corto de fecha, solo para mostrar en listas largas (el historial
// de Evolución): "1 nov" en vez de "1 de noviembre".
function formatShortDate(dateStr) {
  var parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  var day = Number(parts[2]);
  var month = LOG_MONTH_SHORT_NAMES[Number(parts[1]) - 1] || '';
  return day + ' ' + month;
}

function renderLog() {
  var today = getTodayEntry();
  var selectedLevel = today ? today.level : '';
  var selectedNote = today ? today.note : '';

  var html = '<h1>Registro</h1>';
  html += '<p class="eyebrow">Hoy · ' + escapeHtml(formatDisplayDate(todayDateString())) + '</p>';
  html += '<div class="bento-card registro-card">';
  html += '<form id="log-form">';
  html += '<div class="level-buttons">';
  ['alta', 'media', 'baja'].forEach(function (level) {
    var isSelected = level === selectedLevel;
    html += '<button type="button" class="level-btn' + (isSelected ? ' selected' : '') +
      '" data-level="' + level + '">' + levelLabel(level) + '</button>';
  });
  html += '</div>';
  html += '<input type="hidden" id="log-level" value="' + escapeHtml(selectedLevel) + '">';
  html += '<label for="log-note" class="exercise-label">Nota (opcional)</label>';
  html += '<textarea id="log-note" class="field-textarea">' + escapeHtml(selectedNote) + '</textarea>';
  html += '<button type="submit" id="log-save">Guardar</button>';
  html += '<button type="button" class="bento-skip-link" id="log-skip-btn">Prefiero no registrar hoy</button>';
  html += '<div id="log-confirmation" class="callout" hidden><p class="confirmation">Guardado en tu móvil. Puedes editarlo cuando quieras.</p></div>';
  html += '<p id="log-skip-msg" class="confirmation" hidden>Vale, hoy no es necesario. Puedes registrar cuando quieras.</p>';
  html += '</form>';
  html += '</div>';

  html += '<h2>Registros recientes</h2>';
  var entries = getEnergyLog();
  if (entries.length === 0) {
    html += '<p>Aún no tienes registros. ¡Registra tu energía de hoy!</p>';
  } else {
    html += '<ul class="log-list">';
    entries.forEach(function (entry) {
      html += '<li><span class="badge ' + levelBadgeClass(entry.level) + '">' +
        escapeHtml(levelLabel(entry.level)) + '</span> ' +
        '<span class="log-date">' + escapeHtml(formatShortDate(entry.date)) + '</span>';
      if (entry.note) {
        html += '<p class="log-note">' + escapeHtml(entry.note) + '</p>';
      }
      html += '</li>';
    });
    html += '</ul>';
  }

  document.getElementById('app-content').innerHTML = html;

  var levelInput = document.getElementById('log-level');
  var buttons = document.querySelectorAll('.level-btn');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      levelInput.value = btn.getAttribute('data-level');
    });
  });

  document.getElementById('log-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var level = levelInput.value;
    if (!level) return;
    var note = document.getElementById('log-note').value;
    var existingForTags = getTodayEntry();
    saveEntry({
      date: todayDateString(),
      level: level,
      note: note,
      tags: existingForTags && Array.isArray(existingForTags.tags) ? existingForTags.tags : []
    });
    renderLog();
    var confirmation = document.getElementById('log-confirmation');
    if (confirmation) {
      confirmation.hidden = false;
    }
  });

  document.getElementById('log-skip-btn').addEventListener('click', function () {
    document.getElementById('log-skip-msg').hidden = false;
  });
}

// Valor numerico de cada nivel, solo para promediar internamente (nunca se
// muestra un numero ni una puntuacion a la persona).
var LOG_LEVEL_VALUE = { alta: 3, media: 2, baja: 1 };

// Construye el resumen determinista (sin IA) de Evolución, en capas segun
// cuantos dias hay registrados en total. Funcion pura: recibe las entradas
// ya ordenadas por getEnergyLog() (mas reciente primero) y devuelve un
// array de lineas de texto (sin HTML). Nunca usa lenguaje causal ("porque"),
// solo observacional ("parece que"), y nunca compara, puntua ni premia.
function buildEvolutionSummary(entries) {
  var total = entries.length;
  var lines = [];

  if (total < 3) {
    var missing = 3 - total;
    lines.push('Apunta 3 días para ver tu evolución. Te falta' + (missing === 1 ? '' : 'n') + ' ' + missing + ' más.');
    return lines;
  }

  var counts = { alta: 0, media: 0, baja: 0 };
  entries.forEach(function (e) { counts[e.level] = (counts[e.level] || 0) + 1; });

  lines.push('Tu primer vistazo');
  lines.push('Hasta ahora llevas ' + counts.alta + ' día' + (counts.alta === 1 ? '' : 's') +
    ' con energía alta, ' + counts.media + ' con media y ' + counts.baja + ' con baja.');

  var bestDay = null;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].level === 'alta') {
      bestDay = entries[i];
      break;
    }
  }
  if (bestDay) {
    lines.push('Tu mejor día hasta ahora fue el ' + formatShortDate(bestDay.date) + '.');
  }

  if (total >= 7) {
    var todayParts = todayDateString().split('-').map(Number);
    var todayUTC = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
    var weekCounts = { alta: 0, media: 0, baja: 0 };
    entries.forEach(function (e) {
      var parts = e.date.split('-').map(Number);
      var entryUTC = Date.UTC(parts[0], parts[1] - 1, parts[2]);
      var diffDays = Math.round((todayUTC - entryUTC) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weekCounts[e.level] = (weekCounts[e.level] || 0) + 1;
      }
    });
    lines.push('Esta semana: ' + weekCounts.alta + ' días altos, ' + weekCounts.media + ' medios, ' + weekCounts.baja + ' bajos');
  }

  if (total >= 14) {
    var tagLine = null;
    for (var t = 0; t < LOG_TAGS.length; t++) {
      var tag = LOG_TAGS[t];
      var withTag = [];
      var withoutTag = [];
      entries.forEach(function (e) {
        var hasTag = Array.isArray(e.tags) && e.tags.indexOf(tag) !== -1;
        (hasTag ? withTag : withoutTag).push(LOG_LEVEL_VALUE[e.level] || 0);
      });
      if (withTag.length >= 4 && withoutTag.length >= 4) {
        var avgWith = withTag.reduce(function (a, b) { return a + b; }, 0) / withTag.length;
        var avgWithout = withoutTag.reduce(function (a, b) { return a + b; }, 0) / withoutTag.length;
        if (avgWith < avgWithout) {
          tagLine = 'Parece que los días con ' + tag + ' tu energía fue más baja.';
        } else if (avgWith > avgWithout) {
          tagLine = 'Parece que los días con ' + tag + ' tu energía fue más alta.';
        }
        if (tagLine) break;
      }
    }
    lines.push(tagLine || 'Todavía son pocos días para sacar conclusiones.');
  }

  return lines;
}

// editingDate (opcional): fecha ISO del registro cuyo formulario de edición
// está desplegado ahora mismo. Sigue el mismo patrón de re-render completo
// que el resto de views.js: se vuelve a llamar a esta función con la fecha
// abierta, o con null para cerrarla.
function renderEvolution(editingDate) {
  // Se marca como "visto" en cuanto se abre esta vista, sin importar
  // cuantos registros haya: por eso "Tu resumen está listo" en Inicio no
  // vuelve a aparecer nunca mas.
  markResumenSeen();

  var html = '<p class="eyebrow">Últimos 14 días</p><h1>Evolución</h1>';
  var allEntries = getEnergyLog();

  if (allEntries.length < 2) {
    html += '<p>Necesitas al menos 2 registros para ver tu evolución.</p>';
    document.getElementById('app-content').innerHTML = html;
    return;
  }

  var chartEntries = allEntries.slice(0, 14).reverse();

  html += '<div class="chart-card"><canvas id="evolution-canvas"></canvas></div>';
  html += '<div class="chart-legend">';
  ['alta', 'media', 'baja'].forEach(function (level) {
    html += '<span class="legend-item"><span class="legend-dot legend-dot-' + level + '"></span>' +
      escapeHtml(CHART_LEVEL_LABELS[level]) + '</span>';
  });
  html += '</div>';

  var summaryLines = buildEvolutionSummary(allEntries);
  if (summaryLines.length) {
    html += '<div class="card evolution-summary">';
    summaryLines.forEach(function (line) {
      html += '<p>' + escapeHtml(line) + '</p>';
    });
    html += '</div>';
  }

  html += '<h2>Historial</h2>';
  html += '<ul class="log-list">';
  allEntries.forEach(function (entry) {
    var isEditing = editingDate === entry.date;
    html += '<li>';
    html += '<button type="button" class="evolution-entry-btn" data-date="' + escapeHtml(entry.date) +
      '" aria-expanded="' + (isEditing ? 'true' : 'false') + '">' +
      '<span class="badge ' + levelBadgeClass(entry.level) + '">' + escapeHtml(levelLabel(entry.level)) + '</span> ' +
      '<span class="log-date">' + escapeHtml(formatShortDate(entry.date)) + '</span>' +
      '</button>';
    if (!isEditing && Array.isArray(entry.tags) && entry.tags.length) {
      html += '<p class="log-tags">';
      entry.tags.forEach(function (tag) {
        html += '<span class="log-tag-pill">' + escapeHtml(tag) + '</span>';
      });
      html += '</p>';
    }
    if (entry.note && !isEditing) {
      html += '<p class="log-note">' + escapeHtml(entry.note) + '</p>';
    }
    if (isEditing) {
      html += '<div class="evolution-edit-form">';
      html += '<div class="level-buttons evolution-edit-levels">';
      ['alta', 'media', 'baja'].forEach(function (level) {
        var isSelected = level === entry.level;
        html += '<button type="button" class="level-btn' + (isSelected ? ' selected' : '') +
          '" data-level="' + level + '">' + levelLabel(level) + '</button>';
      });
      html += '</div>';
      html += '<p class="exercise-label">Etiquetas (opcional)</p>';
      html += '<div class="tag-chips evolution-edit-tags">';
      LOG_TAGS.forEach(function (tag) {
        var isChecked = Array.isArray(entry.tags) && entry.tags.indexOf(tag) !== -1;
        html += '<button type="button" class="tag-chip' + (isChecked ? ' selected' : '') +
          '" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</button>';
      });
      html += '</div>';
      html += '<label for="evolution-edit-note" class="exercise-label">Nota (opcional)</label>';
      html += '<textarea id="evolution-edit-note" class="field-textarea">' + escapeHtml(entry.note || '') + '</textarea>';
      html += '<div class="confirm-buttons">';
      html += '<button type="button" class="btn" id="evolution-edit-save">Guardar</button>';
      html += '<button type="button" class="btn btn-secondary" id="evolution-edit-cancel">Cancelar</button>';
      html += '</div>';
      html += '</div>';
    }
    html += '</li>';
  });
  html += '</ul>';

  document.getElementById('app-content').innerHTML = html;

  var canvas = document.getElementById('evolution-canvas');
  drawEvolutionChart(canvas, chartEntries);

  var entryButtons = document.querySelectorAll('.evolution-entry-btn');
  entryButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var date = btn.getAttribute('data-date');
      renderEvolution(editingDate === date ? null : date);
    });
  });

  if (editingDate) {
    var editLevels = document.querySelector('.evolution-edit-levels');
    var editButtons = editLevels ? editLevels.querySelectorAll('.level-btn') : [];
    editButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        editButtons.forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
      });
    });

    var editTagsContainer = document.querySelector('.evolution-edit-tags');
    var editTagButtons = editTagsContainer ? editTagsContainer.querySelectorAll('.tag-chip') : [];
    editTagButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.toggle('selected');
      });
    });

    var saveBtn = document.getElementById('evolution-edit-save');
    var cancelBtn = document.getElementById('evolution-edit-cancel');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var selected = editLevels ? editLevels.querySelector('.level-btn.selected') : null;
        var level = selected ? selected.getAttribute('data-level') : null;
        if (!level) return;
        var note = document.getElementById('evolution-edit-note').value;
        var tags = [];
        editTagButtons.forEach(function (b) {
          if (b.classList.contains('selected')) tags.push(b.getAttribute('data-tag'));
        });
        saveEntry({ date: editingDate, level: level, note: note, tags: tags });
        renderEvolution(null);
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        renderEvolution(null);
      });
    }
  }
}

function renderMyData() {
  var entries = getEnergyLog();
  var count = entries.length;

  var html = '<h1>Mis datos</h1>';
  html += '<p>Tienes <strong>' + count + '</strong> registro' + (count === 1 ? '' : 's') +
    ' guardado' + (count === 1 ? '' : 's') + ' en este móvil.</p>';

  html += '<div class="toolkit-grid">';

  html += '<div class="card">';
  html += '<h2>Exportar</h2>';
  html += '<div class="callout"><p>Descarga un archivo con todos tus registros, por si cambias de móvil o borras la app por error.</p></div>';
  html += '<button type="button" id="export-btn" class="btn">Exportar mis datos</button>';
  html += '</div>';

  html += '<div class="card">';
  html += '<h2>Importar</h2>';
  html += '<div class="callout"><p>Si ya tienes un archivo de copia de seguridad (.json), puedes importarlo aquí. Esto sustituirá los registros que tengas ahora mismo en este móvil.</p></div>';
  html += '<label for="import-file" class="btn btn-secondary">Elegir archivo para importar</label>';
  html += '<input type="file" id="import-file" class="visually-hidden" accept="application/json,.json">';
  html += '<div id="import-error" class="callout" hidden></div>';
  html += '<div id="import-confirm" class="callout" hidden></div>';
  html += '<p id="import-success" class="confirmation" hidden>Importación completada.</p>';
  html += '</div>';

  html += '<div class="card">';
  html += '<h2>Borrar todos tus datos</h2>';
  html += '<p>Esto elimina para siempre todos tus registros de energía guardados en este móvil. No se puede deshacer.</p>';
  html += '<button type="button" id="delete-btn" class="btn btn-danger">Borrar todos mis datos</button>';
  html += '<div id="delete-confirm" class="callout" hidden>';
  html += '<p>¿Seguro que quieres borrar todos tus registros? Esta acción no se puede deshacer.</p>';
  html += '<div class="confirm-buttons">';
  html += '<button type="button" id="delete-confirm-btn" class="btn btn-danger">Sí, borrar todo</button>';
  html += '<button type="button" id="delete-cancel-btn" class="btn btn-secondary">Cancelar</button>';
  html += '</div></div>';
  html += '<p id="delete-success" class="confirmation" hidden>Tus datos se han borrado.</p>';
  html += '</div>';

  html += '</div>';

  document.getElementById('app-content').innerHTML = html;

  document.getElementById('export-btn').addEventListener('click', function () {
    var json = exportDataJSON();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'mi-energia-' + todayDateString() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  var fileInput = document.getElementById('import-file');
  var importError = document.getElementById('import-error');
  var importConfirm = document.getElementById('import-confirm');
  var pendingImportData = null;

  fileInput.addEventListener('change', function () {
    importError.hidden = true;
    importError.innerHTML = '';
    importConfirm.hidden = true;
    importConfirm.innerHTML = '';
    pendingImportData = null;

    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var parsedData = parseBackupJSON(String(reader.result));
      if (!parsedData) {
        var errorText = document.createElement('p');
        errorText.textContent = 'Este archivo no tiene un formato válido de copia de seguridad de Mi Energía. No se ha importado nada.';
        importError.appendChild(errorText);
        importError.hidden = false;
        fileInput.value = '';
        return;
      }

      pendingImportData = parsedData;
      var currentCount = getEnergyLog().length;

      var confirmText = document.createElement('p');
      confirmText.textContent = 'Este archivo tiene ' + parsedData.entries.length + ' registro(s). Vas a sustituir tus ' +
        currentCount + ' registro(s) actuales por estos. Esta acción no se puede deshacer.';
      importConfirm.appendChild(confirmText);

      var buttonRow = document.createElement('div');
      buttonRow.className = 'confirm-buttons';

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-danger';
      confirmBtn.textContent = 'Sí, sustituir mis datos';
      confirmBtn.addEventListener('click', function () {
        replaceAllData(pendingImportData.entries, pendingImportData.exercises, pendingImportData.checklists, pendingImportData.pasos, pendingImportData.resumenSeen, pendingImportData.misCosas, pendingImportData.miDia, pendingImportData.ultimoCapitulo);
        renderMyData();
        var successEl = document.getElementById('import-success');
        if (successEl) {
          successEl.hidden = false;
        }
      });

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.addEventListener('click', function () {
        pendingImportData = null;
        fileInput.value = '';
        importConfirm.hidden = true;
        importConfirm.innerHTML = '';
      });

      buttonRow.appendChild(confirmBtn);
      buttonRow.appendChild(cancelBtn);
      importConfirm.appendChild(buttonRow);
      importConfirm.hidden = false;
    };
    reader.readAsText(file);
  });

  document.getElementById('delete-btn').addEventListener('click', function () {
    document.getElementById('delete-confirm').hidden = false;
  });

  document.getElementById('delete-cancel-btn').addEventListener('click', function () {
    document.getElementById('delete-confirm').hidden = true;
  });

  document.getElementById('delete-confirm-btn').addEventListener('click', function () {
    deleteAllData();
    renderMyData();
    var successEl = document.getElementById('delete-success');
    if (successEl) {
      successEl.hidden = false;
    }
  });
}

function renderInstall() {
  // Abre por defecto solo las instrucciones del sistema del dispositivo
  // actual (segun userAgent); el otro sistema queda plegado. Si no se
  // detecta iOS, se abre Android (por defecto, incluye escritorio).
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  var html = '<h1>Instalar la app</h1>';
  html += '<div class="callout"><p>Instala la app antes de empezar a registrar, para no perder tus datos.</p></div>';

  html += '<details class="platform-details"' + (isIOS ? ' open' : '') + '>';
  html += '<summary>En iPhone (con Safari)</summary>';
  html += '<ol>';
  html += '<li>Abre esta página en Safari (no en Chrome ni otro navegador).</li>';
  html += '<li>Toca el icono Compartir (el cuadrado con una flecha hacia arriba), en la barra de abajo.</li>';
  html += '<li>Desplázate hacia abajo y toca "Añadir a pantalla de inicio".</li>';
  html += '<li>Toca "Añadir" arriba a la derecha.</li>';
  html += '<li>A partir de ahora, abre siempre la app desde el icono nuevo de tu pantalla de inicio, no desde Safari.</li>';
  html += '</ol>';
  html += '</details>';

  html += '<details class="platform-details"' + (isIOS ? '' : ' open') + '>';
  html += '<summary>En Android (con Chrome)</summary>';
  html += '<ol>';
  html += '<li>Abre esta página en Chrome.</li>';
  html += '<li>Toca el menú (los tres puntos, arriba a la derecha).</li>';
  html += '<li>Toca "Instalar app" o "Añadir a pantalla de inicio".</li>';
  html += '<li>Confirma tocando "Instalar".</li>';
  html += '</ol>';
  html += '</details>';

  html += '<h2>¿Por qué instalar?</h2>';
  html += '<p>Safari y otros navegadores pueden borrar los datos de una pestaña normal cuando pasa tiempo sin usarla o cuando el teléfono necesita espacio. Si instalas la app como un icono aparte, tus registros quedan mucho más protegidos frente a ese borrado automático.</p>';
  html += '<p>Aun así, haz copias de seguridad de tus datos de vez en cuando desde <a href="#/mis-datos">Mis datos</a>, por si acaso.</p>';

  html += '<p class="signature">@compartir.para.sanar</p>';
  document.getElementById('app-content').innerHTML = html;
}

function renderPrivacy() {
  var html = '<h1>Privacidad</h1>';
  html += '<div class="callout"><p>Todo se guarda solo en tu móvil, no lo vemos nosotros.</p></div>';

  html += '<h2>Qué se guarda</h2>';
  html += '<p>Tus registros de energía y tus notas se guardan únicamente en este móvil, dentro del propio navegador (lo que se llama "almacenamiento local"). Nunca se copian a ningún servidor nuestro ni de terceros, ni se envían a internet en ningún momento.</p>';
  html += '<p>Lo mismo ocurre con las respuestas que escribas en los ejercicios de la guía: se guardan solo en este móvil, junto a tus registros de energía, y se incluyen igual en la exportación, la importación y el borrado de datos.</p>';
  html += '<p>Las marcas de las checklists (por ejemplo, la checklist diaria del Capítulo 7 o del Toolkit) también se guardan solo en este móvil, con el mismo tratamiento que el resto de tus datos.</p>';
  html += '<p>Lo mismo ocurre con tus respuestas en "Pequeños pasos" (si hoy te ha pasado algo o no): se guardan solo en este móvil, y se incluyen igual en la exportación, la importación y el borrado de datos.</p>';
  html += '<p>Las etiquetas opcionales que añadas a un registro (por ejemplo "Dormí mal" o "Pude descansar") se guardan junto a ese registro, solo en este móvil, con el mismo tratamiento que el resto de tus datos.</p>';
  html += '<p>Lo mismo ocurre con lo que eliges cada día en Mi día, lo que marcas al cerrar el día, las cosas que añades tú misma a las listas y el capítulo de la guía por el que vas: se guarda solo en este móvil, y se incluye igual en la exportación, la importación y el borrado de datos.</p>';

  html += '<h2>Qué no recogemos</h2>';
  html += '<p>No te pedimos nombre, correo ni ubicación para usar la app. No usamos herramientas de analítica ni medimos cómo usas la app. No hay ningún servicio externo conectado: la app funciona sin conexión a internet y no manda nada a ningún sitio.</p>';

  html += '<h2>El único enlace externo: la lista de correo</h2>';
  html += '<p>Si decides apuntarte al boletín de @compartir.para.sanar, lo harás a través de un formulario de MailerLite que abre fuera de esta app, en una página web aparte. Ese correo lo gestiona Ana directamente — esta app no tiene acceso a esa lista ni a tu dirección de correo.</p>';

  html += '<h2>Cómo borrar tus datos de este móvil</h2>';
  html += '<p>Puedes borrar todos tus registros cuando quieras desde <a href="#/mis-datos">Mis datos</a>, con el botón "Borrar todos mis datos". También puedes borrarlos desinstalando la app o borrando los datos de navegación de este sitio desde los ajustes de tu navegador o tu móvil.</p>';

  html += '<h2>Cómo darte de baja del correo</h2>';
  html += '<p>Si te apuntaste al boletín, puedes darte de baja con el enlace que aparece al final de cualquier email que recibas, o escribiendo a compartir.para.sanar@outlook.com pidiendo la baja.</p>';

  html += '<h2>Responsable y contacto</h2>';
  html += '<p>Responsable: Ana España.</p>';
  html += '<p>Contacto: compartir.para.sanar@outlook.com</p>';

  html += '<p class="signature">@compartir.para.sanar</p>';
  document.getElementById('app-content').innerHTML = html;
}
