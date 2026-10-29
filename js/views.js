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
  } else if (hash.indexOf('/registro') === 0 || hash.indexOf('/evolucion') === 0) {
    tab = 'registro';
  } else if (hash.indexOf('/mis-datos') === 0 || hash === '/instalar' || hash === '/privacidad') {
    tab = 'ajustes';
  }
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

function renderHome() {
  var today = getTodayEntry();
  var entries = getEnergyLog();

  var totalExercises = GUIDE_CONTENT.chapters.reduce(function (sum, ch) {
    return sum + ch.exercises.length;
  }, 0);

  var html = '<div class="home-seal"><img src="assets/logo_b-transparente.svg" alt="Sello compartir · para · sanar" width="160" height="160"></div>';
  html += '<div class="home-greeting"><p class="eyebrow">@compartir.para.sanar</p><h1>Hola</h1></div>';

  html += '<div class="callout">';
  html += '<p>Instala la app antes de empezar a registrar, para no perder tus datos.</p>';
  html += '<p><a href="#/instalar">Cómo instalarla</a></p>';
  html += '</div>';

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
  html += '</div>';

  html += '<a class="bento-card bento-card-wide bento-mini-chart" href="#/evolucion">';
  html += '<div class="bento-card-header-row"><p class="eyebrow">Últimos 7 días</p><span class="bento-card-chevron" aria-hidden="true">›</span></div>';
  html += '<h3>Tu evolución</h3>';
  if (entries.length >= 2) {
    html += '<canvas id="home-evolution-canvas"></canvas>';
  } else {
    html += '<p>Aún no hay suficientes registros para ver tu evolución.</p>';
  }
  html += '</a>';

  html += '<a class="bento-card" href="#/guia">';
  html += '<h3>Seguir con la guía</h3>';
  html += '<p>Continúa donde lo dejaste.</p>';
  html += '</a>';

  html += '<a class="bento-card" href="#/guia/plan-21">';
  html += '<h3>Plan de 21 días</h3>';
  html += '<p>Un paso pequeño cada día.</p>';
  html += '</a>';

  html += '<a class="bento-card bento-card-wide bento-card-beige" href="#/guia">';
  html += '<div class="bento-card-header-row"><h3>Mis ejercicios</h3><span class="bento-card-chevron" aria-hidden="true">›</span></div>';
  html += '<p>' + totalExercises + ' ejercicios de la guía, listos para completar a tu ritmo.</p>';
  html += '</a>';

  html += '</div>';

  html += '<ul class="action-list">';
  html += '<li><a href="#/mis-datos">Exportar o importar tu copia de seguridad</a></li>';
  html += '</ul>';
  html += '<p class="home-footer">Recibes esta app por tu suscripción a @compartir.para.sanar. <a href="#/privacidad">Más sobre privacidad</a></p>';

  document.getElementById('app-content').innerHTML = html;

  if (entries.length >= 2) {
    var canvas = document.getElementById('home-evolution-canvas');
    drawEvolutionChart(canvas, entries.slice(0, 7).reverse());
  }

  var levelButtons = document.querySelectorAll('#home-level-buttons .level-btn');
  var logConfirm = document.getElementById('home-log-confirm');
  var skipMsg = document.getElementById('home-skip-msg');
  levelButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      levelButtons.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      var level = btn.getAttribute('data-level');
      var existing = getTodayEntry();
      saveEntry({ date: todayDateString(), level: level, note: existing ? existing.note : '' });
      skipMsg.hidden = true;
      logConfirm.textContent = 'Guardado.';
      logConfirm.hidden = false;
    });
  });

  document.getElementById('home-skip-btn').addEventListener('click', function () {
    logConfirm.hidden = true;
    skipMsg.hidden = false;
  });
}

function renderGuideIndex() {
  var html = '<h1>Guía</h1>';
  html += '<h2>' + escapeHtml(GUIDE_CONTENT.intro.title) + '</h2>';
  GUIDE_CONTENT.intro.sections.forEach(function (section) {
    html += renderTextBlock(section.body);
  });
  html += '<ul class="guide-index">';
  GUIDE_CONTENT.chapters.forEach(function (ch) {
    html += '<li><a href="#/guia/' + ch.id + '">' + escapeHtml(ch.title) + '</a></li>';
  });
  html += '<li><a href="#/guia/toolkit">Tu kit de herramientas</a></li>';
  html += '<li><a href="#/guia/plan-21">Plan de acción de 21 días</a></li>';
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
  ch.sections.forEach(function (section) {
    if (section.heading) {
      html += '<h2>' + escapeHtml(section.heading) + '</h2>';
    }
    html += renderTextBlock(section.body);
  });
  var formedExerciseIds = [];
  if (ch.exercises.length) {
    html += '<h2>Ejercicios</h2>';
    ch.exercises.forEach(function (exercise) {
      html += '<div class="exercise-card">';
      html += '<h3>' + escapeHtml(exercise.title) + '</h3>';
      html += renderTextBlock(exercise.instructions);
      var exId = exerciseIdFromTitle(exercise.title);
      if (exId && EXERCISE_SCHEMA[exId]) {
        html += exerciseFormHtml(exId);
        formedExerciseIds.push(exId);
      }
      html += '</div>';
    });
  }
  var nextCh = GUIDE_CONTENT.chapters[Number(id)];
  html += '<p class="chapter-end-msg">Has llegado al final de este capítulo. Vuelve cuando quieras, a tu ritmo.</p>';
  if (nextCh) {
    html += '<div class="chapter-next-wrap"><a class="btn" href="#/guia/' + nextCh.id + '">Siguiente →</a></div>';
  } else {
    html += '<div class="chapter-next-wrap"><a class="btn" href="#/guia">Volver a la guía</a></div>';
  }
  container.innerHTML = html;
  formedExerciseIds.forEach(function (exId) {
    initExerciseForm(exId);
  });
}

function renderToolkit() {
  var tools = [
    GUIDE_CONTENT.toolkit.dailyChecklist,
    GUIDE_CONTENT.toolkit.weeklyChecklist,
    GUIDE_CONTENT.toolkit.fatigueLog,
    GUIDE_CONTENT.toolkit.energyMap
  ];
  var html = '<a class="chapter-back-link" href="#/guia">‹ Mi guía</a>';
  html += '<h1>Tu kit de herramientas</h1><div class="toolkit-grid">';
  tools.forEach(function (tool) {
    html += '<div class="card"><h2>' + escapeHtml(tool.title) + '</h2><ul>';
    tool.items.forEach(function (item) {
      html += '<li>' + escapeHtml(item) + '</li>';
    });
    html += '</ul></div>';
  });
  html += '</div><p><a href="#/guia">Volver a la guía</a></p>';
  document.getElementById('app-content').innerHTML = html;
}

function renderActionPlan() {
  var html = '<a class="chapter-back-link" href="#/guia">‹ Mi guía</a>';
  html += '<h1>Plan de acción de 21 días</h1>';
  GUIDE_CONTENT.actionPlan.weeks.forEach(function (week) {
    html += '<h2>' + escapeHtml(week.name) + '</h2>';
    html += '<div class="callout"><p class="eyebrow">OBJETIVO DE LA SEMANA</p><p>' + escapeHtml(week.objective) + '</p></div>';
    html += '<div class="plan-week">';
    week.days.forEach(function (day) {
      html += '<h3>' + escapeHtml(day.title) + '</h3>';
      html += renderTextBlock(day.description);
    });
    html += '</div>';
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
  html += '<textarea id="log-note">' + escapeHtml(selectedNote) + '</textarea>';
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
        '<span class="log-date">' + escapeHtml(entry.date) + '</span>';
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
    saveEntry({ date: todayDateString(), level: level, note: note });
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

function renderEvolution() {
  var html = '<p class="eyebrow">Últimos 14 días</p><h1>Evolución</h1>';
  var entries = getEnergyLog().slice(0, 14).reverse();

  if (entries.length < 2) {
    html += '<p>Necesitas al menos 2 registros para ver tu evolución.</p>';
    document.getElementById('app-content').innerHTML = html;
    return;
  }

  html += '<div class="chart-card"><canvas id="evolution-canvas"></canvas></div>';
  html += '<div class="chart-legend">';
  ['alta', 'media', 'baja'].forEach(function (level) {
    html += '<span class="legend-item"><span class="legend-dot legend-dot-' + level + '"></span>' +
      escapeHtml(CHART_LEVEL_LABELS[level]) + '</span>';
  });
  html += '</div>';

  document.getElementById('app-content').innerHTML = html;

  var canvas = document.getElementById('evolution-canvas');
  drawEvolutionChart(canvas, entries);
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
        replaceAllData(pendingImportData.entries, pendingImportData.exercises);
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
  var html = '<h1>Instalar la app</h1>';
  html += '<div class="callout"><p>Instala la app antes de empezar a registrar, para no perder tus datos.</p></div>';

  html += '<h2>En iPhone (con Safari)</h2>';
  html += '<ol>';
  html += '<li>Abre esta página en Safari (no en Chrome ni otro navegador).</li>';
  html += '<li>Toca el icono Compartir (el cuadrado con una flecha hacia arriba), en la barra de abajo.</li>';
  html += '<li>Desplázate hacia abajo y toca "Añadir a pantalla de inicio".</li>';
  html += '<li>Toca "Añadir" arriba a la derecha.</li>';
  html += '<li>A partir de ahora, abre siempre la app desde el icono nuevo de tu pantalla de inicio, no desde Safari.</li>';
  html += '</ol>';

  html += '<h2>En Android (con Chrome)</h2>';
  html += '<ol>';
  html += '<li>Abre esta página en Chrome.</li>';
  html += '<li>Toca el menú (los tres puntos, arriba a la derecha).</li>';
  html += '<li>Toca "Instalar app" o "Añadir a pantalla de inicio".</li>';
  html += '<li>Confirma tocando "Instalar".</li>';
  html += '</ol>';

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
