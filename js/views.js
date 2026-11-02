// js/views.js
// Unico archivo que modifica el DOM. Cada funcion renderiza una vista completa
// dentro de <main id="app-content">. Lee datos de GUIDE_CONTENT (js/content.js).

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
  if (hash.indexOf('/guia') === 0) {
    tab = 'guia';
  } else if (hash.indexOf('/pasos') === 0) {
    tab = 'pasos';
  }
  // /evolucion, /registro (ruta antigua sin enlace en el menu), /mis-datos,
  // /instalar y /privacidad se consideran parte de "Inicio" a efectos de
  // pestaña activa: el menu inferior solo tiene 3 elementos.
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

// HTML del bloque opcional de nota y etiquetas en Inicio (today es la
// entrada de hoy, o null si todavia no se ha guardado nada). Extraido de
// renderHome para mantenerla dentro del limite de 150 lineas por funcion.
function homeExtraSectionHtml(today) {
  var html = '<div id="home-extra-section"' + (today ? '' : ' hidden') + '>';
  html += '<button type="button" class="bento-skip-link-white" id="home-extra-toggle" aria-expanded="false">Añadir nota o etiquetas</button>';
  html += '<div id="home-extra-wrap" hidden>';
  html += '<p class="exercise-label">Etiquetas (opcional)</p>';
  html += '<div class="tag-chips" id="home-tags">';
  LOG_TAGS.forEach(function (tag) {
    var isChecked = !!(today && Array.isArray(today.tags) && today.tags.indexOf(tag) !== -1);
    html += '<button type="button" class="tag-chip' + (isChecked ? ' selected' : '') +
      '" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</button>';
  });
  html += '</div>';
  html += '<label for="home-note" class="exercise-label">Nota (opcional)</label>';
  html += '<textarea id="home-note" class="field-textarea">' + escapeHtml(today ? today.note : '') + '</textarea>';
  html += '<button type="button" class="btn" id="home-note-save">Guardar nota</button>';
  html += '<p id="home-note-confirm" class="confirmation confirmation-on-dark" hidden>Nota guardada.</p>';
  html += '</div>';
  html += '</div>';
  return html;
}

// HTML del bloque plegable "¿Y ahora qué?" en Inicio (consejos segun el
// nivel de hoy). Extraido de renderHome por el mismo motivo que arriba.
function homeTipsSectionHtml(today) {
  var html = '<details class="inline-details" id="home-tips-section"' + (today ? '' : ' hidden') + '>';
  html += '<summary>¿Y ahora qué?</summary>';
  html += '<div id="home-tips-content">' + (today ? tipsListHtml(today.level) : '') + '</div>';
  html += '</details>';
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

  // Nota y etiquetas opcionales: nunca son un paso obligatorio entre el
  // toque y el guardado. El guardado ya ocurre al tocar un nivel (ver
  // abajo); esta sección solo aparece despues, y sigue siendo opcional.
  html += homeExtraSectionHtml(today);

  // "¿Y ahora qué?": consejos literales de la guía segun el nivel elegido.
  // Opcional, plegado por defecto, y nunca bloquea nada.
  html += homeTipsSectionHtml(today);

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

  html += '<a class="bento-card bento-card-wide" href="#/guia">';
  html += '<h3>Seguir con la guía</h3>';
  html += '<p>Continúa donde lo dejaste.</p>';
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
  var tipsSection = document.getElementById('home-tips-section');
  var tipsContent = document.getElementById('home-tips-content');
  var tagButtons = document.querySelectorAll('#home-tags .tag-chip');
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
      tipsSection.hidden = false;
      tipsContent.innerHTML = tipsListHtml(level);
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
    extraToggle.textContent = wasHidden ? 'Ocultar nota o etiquetas' : 'Añadir nota o etiquetas';
  });

  tagButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var existing = getTodayEntry();
      if (!existing) return;
      btn.classList.toggle('selected');
      var tags = Array.isArray(existing.tags) ? existing.tags.slice() : [];
      var tag = btn.getAttribute('data-tag');
      var idx = tags.indexOf(tag);
      if (btn.classList.contains('selected')) {
        if (idx === -1) tags.push(tag);
      } else if (idx !== -1) {
        tags.splice(idx, 1);
      }
      saveEntry({ date: todayDateString(), level: existing.level, note: existing.note, tags: tags });
    });
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

// Esquema de los 6 ejercicios reales de la guía (ver js/content.js). Cada
// clave identifica un ejercicio ("ex-<capítulo>-<número>", tomado del título
// literal) y describe sus campos para poder dibujar el formulario y leer sus
// valores de forma genérica, sin una función de renderizado por ejercicio.
var EXERCISE_SCHEMA = {
  'ex-1-1': {
    type: 'fields',
    fields: [
      { key: 'cuerpo', label: '¿Cómo se siente tu fatiga en el cuerpo? (3 palabras)' },
      { key: 'mente', label: '¿Cómo se siente en la mente?' },
      { key: 'ultimaVez', label: '¿Cuál fue la última vez que "pagaste" un esfuerzo dos días después?' }
    ]
  },
  'ex-2-1': {
    type: 'days',
    days: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
    dayLabels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  },
  'ex-3-1': {
    type: 'fields',
    fields: [
      { key: 'listaA1', label: 'Lista A — Lo que me quita energía (1)' },
      { key: 'listaA2', label: 'Lista A — Lo que me quita energía (2)' },
      { key: 'listaA3', label: 'Lista A — Lo que me quita energía (3)' },
      { key: 'listaB1', label: 'Lista B — Lo que me devuelve energía (1)' },
      { key: 'listaB2', label: 'Lista B — Lo que me devuelve energía (2)' },
      { key: 'listaB3', label: 'Lista B — Lo que me devuelve energía (3)' }
    ]
  },
  'ex-3-2': {
    type: 'checks',
    checks: [
      { key: 'decisiones', label: 'Tomar muchas decisiones pequeñas seguidas' },
      { key: 'notificaciones', label: 'Notificaciones y redes sociales sin límite de tiempo' },
      { key: 'conversaciones', label: 'Conversaciones de pie o en movimiento' },
      { key: 'cambios', label: 'Cambios de plan inesperados' },
      { key: 'ambientes', label: 'Ambientes con mucho ruido o luz' },
      { key: 'deberia', label: 'Sentir que "debería" poder con todo' }
    ]
  },
  'ex-5-1': {
    type: 'momento-fields',
    momentoOptions: ['Mañana', 'Tarde', 'Noche'],
    fields: [
      { key: 'paso1', label: 'Paso 1' },
      { key: 'paso2', label: 'Paso 2' },
      { key: 'paso3', label: 'Paso 3' }
    ]
  },
  'ex-6-1': {
    type: 'fields',
    fields: [
      { key: 'tarea1', label: 'Tarea delegable 1' },
      { key: 'tarea2', label: 'Tarea delegable 2' },
      { key: 'tarea3', label: 'Tarea delegable 3' }
    ]
  }
};

// Correspondencia entre el símbolo guardado (igual que en el texto de la
// guía) y el valor "alta/media/baja" que ya usan los estilos de .level-btn
// del registro diario, para reutilizar exactamente los mismos colores.
var EXERCISE_DAY_LEVELS = [
  { symbol: '🟢', level: 'alta' },
  { symbol: '🟡', level: 'media' },
  { symbol: '🔴', level: 'baja' }
];

// Extrae el id de ejercicio ("ex-1-1") del título literal de content.js
// ("Ejercicio 1.1 — ..."), sin tocar el texto original.
function exerciseIdFromTitle(title) {
  var match = /Ejercicio\s+(\d+)\.(\d+)/.exec(String(title));
  return match ? 'ex-' + match[1] + '-' + match[2] : null;
}

// Genera el formulario HTML de un ejercicio ya rellenado con sus respuestas
// guardadas (si las hay). El botón cambia de texto a "Guardar cambios"
// cuando ya existe una respuesta previa, para poder revisarla y editarla.
function exerciseFormHtml(id) {
  var schema = EXERCISE_SCHEMA[id];
  if (!schema) return '';
  var saved = getExerciseAnswers(id);
  var html = '<form class="exercise-form" data-exercise-id="' + id + '">';

  if (schema.type === 'fields' || schema.type === 'momento-fields') {
    if (schema.type === 'momento-fields') {
      var savedMomento = saved && typeof saved.momento === 'string' ? saved.momento : '';
      html += '<label class="exercise-label" for="' + id + '-momento">Momento del día</label>';
      html += '<select class="exercise-select" id="' + id + '-momento" data-field="momento">';
      html += '<option value="">Elige un momento</option>';
      schema.momentoOptions.forEach(function (opt) {
        var sel = savedMomento === opt ? ' selected' : '';
        html += '<option value="' + escapeHtml(opt) + '"' + sel + '>' + escapeHtml(opt) + '</option>';
      });
      html += '</select>';
    }
    schema.fields.forEach(function (f) {
      var val = saved && typeof saved[f.key] === 'string' ? saved[f.key] : '';
      html += '<label class="exercise-label" for="' + id + '-' + f.key + '">' + escapeHtml(f.label) + '</label>';
      html += '<input class="exercise-input" type="text" id="' + id + '-' + f.key + '" data-field="' + f.key + '" value="' + escapeHtml(val) + '">';
    });
  } else if (schema.type === 'days') {
    schema.days.forEach(function (dayKey, i) {
      var dayData = saved && saved[dayKey] && typeof saved[dayKey] === 'object' ? saved[dayKey] : {};
      var nivel = typeof dayData.nivel === 'string' ? dayData.nivel : '';
      var nota = typeof dayData.nota === 'string' ? dayData.nota : '';
      html += '<div class="exercise-day">';
      html += '<p class="exercise-day-label">' + escapeHtml(schema.dayLabels[i]) + '</p>';
      html += '<div class="level-buttons exercise-level-buttons" data-day="' + dayKey + '">';
      EXERCISE_DAY_LEVELS.forEach(function (lvl) {
        var selected = nivel === lvl.symbol ? ' selected' : '';
        html += '<button type="button" class="level-btn' + selected + '" data-level="' + lvl.level + '" data-symbol="' + lvl.symbol + '">' + lvl.symbol + '</button>';
      });
      html += '</div>';
      html += '<input class="exercise-input" type="text" data-day-note="' + dayKey + '" placeholder="Lo que más energía me gastó" value="' + escapeHtml(nota) + '">';
      html += '</div>';
    });
  } else if (schema.type === 'checks') {
    schema.checks.forEach(function (c) {
      var checked = saved && saved[c.key] === true ? ' checked' : '';
      html += '<label class="exercise-check"><input type="checkbox" data-check="' + c.key + '"' + checked + '> ' + escapeHtml(c.label) + '</label>';
    });
  }

  var buttonLabel = saved ? 'Guardar cambios' : 'Guardar ejercicio';
  html += '<button type="button" class="btn exercise-save-btn">' + buttonLabel + '</button>';
  html += '<p class="exercise-saved-msg visually-hidden" role="status">Guardado.</p>';
  html += '</form>';
  return html;
}

// Conecta los eventos de un formulario de ejercicio ya insertado en el DOM:
// selección de nivel por día y guardado. Se llama tras fijar innerHTML.
function initExerciseForm(id) {
  var schema = EXERCISE_SCHEMA[id];
  var form = document.querySelector('.exercise-form[data-exercise-id="' + id + '"]');
  if (!schema || !form) return;

  if (schema.type === 'days') {
    var groups = form.querySelectorAll('.exercise-level-buttons');
    for (var g = 0; g < groups.length; g++) {
      var buttons = groups[g].querySelectorAll('.level-btn');
      for (var b = 0; b < buttons.length; b++) {
        (function (btn, allButtons) {
          btn.addEventListener('click', function () {
            for (var k = 0; k < allButtons.length; k++) {
              allButtons[k].classList.remove('selected');
            }
            btn.classList.add('selected');
          });
        })(buttons[b], buttons);
      }
    }
  }

  var saveBtn = form.querySelector('.exercise-save-btn');
  var msg = form.querySelector('.exercise-saved-msg');

  saveBtn.addEventListener('click', function () {
    var answers = {};
    if (schema.type === 'fields' || schema.type === 'momento-fields') {
      if (schema.type === 'momento-fields') {
        var momentoSelect = form.querySelector('[data-field="momento"]');
        answers.momento = momentoSelect ? momentoSelect.value : '';
      }
      schema.fields.forEach(function (f) {
        var input = form.querySelector('[data-field="' + f.key + '"]');
        answers[f.key] = input ? input.value : '';
      });
    } else if (schema.type === 'days') {
      schema.days.forEach(function (dayKey) {
        var group = form.querySelector('.exercise-level-buttons[data-day="' + dayKey + '"]');
        var selected = group ? group.querySelector('.level-btn.selected') : null;
        var noteInput = form.querySelector('[data-day-note="' + dayKey + '"]');
        answers[dayKey] = {
          nivel: selected ? selected.getAttribute('data-symbol') : '',
          nota: noteInput ? noteInput.value : ''
        };
      });
    } else if (schema.type === 'checks') {
      schema.checks.forEach(function (c) {
        var input = form.querySelector('[data-check="' + c.key + '"]');
        answers[c.key] = !!(input && input.checked);
      });
    }
    saveExerciseAnswers(id, answers);
    saveBtn.textContent = 'Guardar cambios';
    msg.classList.remove('visually-hidden');
    var toggleBtn = document.querySelector('.exercise-toggle-btn[data-exercise-id="' + id + '"]');
    if (toggleBtn) {
      toggleBtn.textContent = 'Ver mis respuestas';
    }
  });
}

// Conecta el boton secundario que despliega u oculta el formulario de un
// ejercicio. El formulario arranca siempre oculto: el texto del ejercicio
// se lee primero, y apuntar la respuesta es opcional. Al desplegar el
// formulario se oculta el texto del ejercicio (ejemplos y "tu turno"), para
// no mostrar dos veces lo mismo: el formulario ya es la version rellenable
// de esos mismos espacios en blanco. Al volver a plegarlo, el texto reaparece.
function initExerciseToggle(id) {
  var toggleBtn = document.querySelector('.exercise-toggle-btn[data-exercise-id="' + id + '"]');
  var wrap = document.getElementById(id + '-wrap');
  var instructions = document.getElementById(id + '-instructions');
  if (!toggleBtn || !wrap) return;
  toggleBtn.addEventListener('click', function () {
    var wasHidden = wrap.hidden;
    wrap.hidden = !wasHidden;
    toggleBtn.setAttribute('aria-expanded', wasHidden ? 'true' : 'false');
    if (instructions) {
      instructions.hidden = wasHidden;
    }
  });
}

function renderChapter(id) {
  var container = document.getElementById('app-content');
  var ch = GUIDE_CONTENT.chapters[Number(id) - 1];
  if (!ch) {
    container.innerHTML = '<h1>Capítulo no encontrado</h1><p><a href="#/guia">Volver a la guía</a></p>';
    return;
  }
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
  var formedExerciseIds = [];
  if (ch.exercises.length) {
    html += '<h2>Ejercicios</h2>';
    ch.exercises.forEach(function (exercise) {
      html += '<div class="exercise-card">';
      html += '<h3>' + escapeHtml(exercise.title) + '</h3>';
      var exId = exerciseIdFromTitle(exercise.title);
      if (exId && EXERCISE_SCHEMA[exId]) {
        html += '<div id="' + exId + '-instructions">' + renderTextBlock(exercise.instructions) + '</div>';
        var hasSaved = !!getExerciseAnswers(exId);
        var toggleLabel = hasSaved ? 'Ver mis respuestas' : 'Apuntarlo aquí (opcional)';
        var wrapId = exId + '-wrap';
        html += '<button type="button" class="btn btn-outline exercise-toggle-btn" data-exercise-id="' + exId +
          '" aria-expanded="false" aria-controls="' + wrapId + '">' + escapeHtml(toggleLabel) + '</button>';
        html += '<div class="exercise-form-wrap" id="' + wrapId + '" hidden>';
        html += exerciseFormHtml(exId);
        html += '</div>';
        formedExerciseIds.push(exId);
      } else {
        html += renderTextBlock(exercise.instructions);
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
  formedExerciseIds.forEach(function (exId) {
    initExerciseForm(exId);
    initExerciseToggle(exId);
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

// Indice deterministico (0-5) para elegir, segun la fecha de calendario,
// cual de los 6 "ladrones silenciosos" del Ejercicio 3.2 se muestra como
// paso de un toque. Mismo dia natural => mismo indice siempre (nunca al
// azar); avanza un item cada dia y da la vuelta cada 6 dias.
function pasoIndexForDate(dateStr) {
  var parts = String(dateStr).split('-');
  var items = EXERCISE_SCHEMA['ex-3-2'].checks;
  if (parts.length !== 3) return 0;
  var days = Math.floor(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / 86400000);
  var n = items.length;
  return ((days % n) + n) % n;
}

// HTML de la tarjeta de "paso de un toque" (Fase 2). offset permite ver
// "Otro paso" sin cambiar de dia: se suma al indice del dia y se le aplica
// el modulo, así que nunca se sale del rango de los 6 items. Reutiliza
// EXERCISE_SCHEMA['ex-3-2'].checks como unica fuente de los 6 "ladrones
// silenciosos" (ya extraidos del texto literal de content.js), sin
// duplicar esa lista aqui.
function renderPasoCardHtml(offset) {
  var items = EXERCISE_SCHEMA['ex-3-2'].checks;
  var today = todayDateString();
  var idx = (pasoIndexForDate(today) + (offset || 0)) % items.length;
  var item = items[idx];
  var todayPasos = getPasosForDate(today);
  var answered = Object.prototype.hasOwnProperty.call(todayPasos, item.key);

  var html = '<div class="card paso-card">';
  html += '<p class="eyebrow">Pequeño paso de hoy</p>';
  if (answered) {
    html += '<p class="confirmation">Gracias por prestarle atención a esto.</p>';
    html += '<p class="eyebrow">Listo por hoy.</p>';
  } else {
    var question = '¿Hoy te ha pasado: ' + item.label.charAt(0).toLowerCase() + item.label.slice(1) + '?';
    html += '<p class="paso-question">' + escapeHtml(question) + '</p>';
    html += '<div class="confirm-buttons">';
    html += '<button type="button" class="btn" id="paso-si-btn" data-paso-key="' + item.key + '">Sí</button>';
    html += '<button type="button" class="btn btn-secondary" id="paso-no-btn" data-paso-key="' + item.key + '">No</button>';
    html += '</div>';
  }
  html += '<button type="button" class="btn btn-outline paso-otro-btn" id="paso-otro-btn">Otro paso</button>';
  html += '</div>';
  return html;
}

// Pestaña "Pequeños pasos": arriba, el paso de un toque (Ejercicio 3.2 en
// rotación diaria); debajo, las checklists diaria y semanal ya existentes
// (mismo componente que el Capítulo 7 y el Toolkit, reutilizadas sin
// duplicar datos ni logica).
function renderSmallSteps(offset) {
  var currentOffset = offset || 0;
  var html = '<h1>Pequeños pasos</h1>';
  html += renderPasoCardHtml(currentOffset);
  html += '<div class="toolkit-grid">';

  html += '<div class="card"><h2>' + escapeHtml(GUIDE_CONTENT.toolkit.dailyChecklist.title) + '</h2>';
  html += renderChecklistHtml('daily', GUIDE_CONTENT.toolkit.dailyChecklist.items);
  html += '</div>';

  html += '<div class="card"><h2>' + escapeHtml(GUIDE_CONTENT.toolkit.weeklyChecklist.title) + '</h2>';
  html += renderChecklistHtml('weekly', GUIDE_CONTENT.toolkit.weeklyChecklist.items);
  html += '</div>';

  html += '</div>';
  document.getElementById('app-content').innerHTML = html;
  initChecklist('daily');
  initChecklist('weekly');

  var today = todayDateString();
  var siBtn = document.getElementById('paso-si-btn');
  var noBtn = document.getElementById('paso-no-btn');
  if (siBtn) {
    siBtn.addEventListener('click', function () {
      setPaso(today, siBtn.getAttribute('data-paso-key'), true);
      renderSmallSteps(currentOffset);
    });
  }
  if (noBtn) {
    noBtn.addEventListener('click', function () {
      setPaso(today, noBtn.getAttribute('data-paso-key'), false);
      renderSmallSteps(currentOffset);
    });
  }
  var otroBtn = document.getElementById('paso-otro-btn');
  if (otroBtn) {
    otroBtn.addEventListener('click', function () {
      renderSmallSteps(currentOffset + 1);
    });
  }
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

// Lista de 2 consejos literales de la guía (GUIDE_CONTENT.energyTips) para
// el nivel de energía indicado. Usada en el bloque "¿Y ahora qué?" de
// Inicio, tanto en el render inicial como al cambiar de nivel sin recargar
// toda la página.
function tipsListHtml(level) {
  var tips = (GUIDE_CONTENT.energyTips && GUIDE_CONTENT.energyTips[level]) || [];
  var html = '<ul class="tips-list">';
  tips.forEach(function (tip) {
    html += '<li>' + escapeHtml(tip) + '</li>';
  });
  html += '</ul>';
  return html;
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
// que el resto de views.js (p.ej. initExerciseToggle): se vuelve a llamar a
// esta función con la fecha abierta, o con null para cerrarla.
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
        replaceAllData(pendingImportData.entries, pendingImportData.exercises, pendingImportData.checklists, pendingImportData.pasos, pendingImportData.resumenSeen);
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
