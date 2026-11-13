// js/views.js
// Unico archivo que modifica el DOM. Cada funcion renderiza una vista completa
// dentro de <main id="app-content">. Lee datos de GUIDE_CONTENT (js/content.js).

// Cuántas cosas se pueden elegir en Mi día segun el nivel de hoy (step-14e).
// Decisión del autor, no de la guía: un único sitio para poder cambiarla.
var MI_DIA_LIMITS = { alta: 3, media: 2, baja: 1 };

// Si el aviso discreto de "instala la app" de Inicio se cerró en esta
// sesión (step-15): no se guarda en ningún sitio, solo evita que vuelva a
// aparecer mientras la pestaña siga abierta. Al recargar, puede reaparecer
// si la app sigue sin instalarse.
var installBannerDismissed = false;

// Igual que installBannerDismissed, pero para el aviso de "haz una copia
// de tus datos" (step-16): se cierra por separado, no comparte el cierre
// con el de instalar.
var backupBannerDismissed = false;

// Si la app ya se usa instalada (pantalla de inicio en iPhone/Android o
// PWA instalada en escritorio). iOS usa navigator.standalone; el resto usa
// la media query estandar display-mode.
function isStandaloneDisplay() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
}

// Si el dispositivo es un iPhone/iPad (para decidir que instrucciones y
// botones de instalar/recordatorios mostrar).
function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Texto alternativo del gráfico de evolución para lectores de pantalla
// (step-16, F): el <canvas> no tiene contenido textual propio, así que se
// resume aquí cuántos días de cada nivel hay en los datos que recibió
// drawEvolutionChart (chart.js solo dibuja; esta decisión de accesibilidad
// vive en views.js, que es quien decide el DOM).
function evolutionChartAriaLabel(entries) {
  if (!entries || !entries.length) return 'Gráfico de evolución de energía, todavía sin datos.';
  var counts = { alta: 0, media: 0, baja: 0 };
  entries.forEach(function (e) { if (counts.hasOwnProperty(e.level)) counts[e.level]++; });
  return 'Gráfico de evolución de energía de los últimos ' + entries.length + ' días registrados: ' +
    counts.alta + ' en alta, ' + counts.media + ' en media, ' + counts.baja + ' en baja.';
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
  'Objetivo del capítulo:': 'Objetivo del capítulo',
  'Objetivo de la semana:': 'Objetivo de la semana',
  'Regla práctica:': 'Regla práctica',
  'Una única regla antes de empezar:': 'Regla práctica'
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

// Quita las lineas de "rellenar a mano" (p.ej. "Tu turno: ______________"
// o "Paso 1: ______________") del texto de un ejercicio, para mostrarlo en
// modo solo lectura sin espacios en blanco que ya no se pueden rellenar
// (step-14f). No toca el texto guardado en content.js, solo lo que se
// pinta en pantalla.
function stripBlankPrompts(text) {
  return String(text).split('\n').filter(function (line) {
    return !/_{3,}\s*$/.test(line);
  }).join('\n');
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
  // /registro (ruta antigua sin enlace en el menu), /mis-datos, /instalar,
  // /recordatorios y /privacidad tambien cuentan como "Inicio": el menu
  // inferior solo tiene 3 elementos (Inicio / Mi día / Herramientas).
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
  html += '<p id="home-note-confirm" class="confirmation confirmation-on-dark" aria-live="polite" hidden>Nota guardada.</p>';
  html += '</div>';
  html += '</div>';
  return html;
}

// HTML del aviso discreto de "instala la app" en Inicio (step-15): solo en
// el primer uso (sin ningun registro todavia) y solo si no esta instalada.
// Extraido de renderHome por el limite de 150 lineas por funcion.
function homeInstallBannerHtml() {
  var html = '<div class="install-banner" id="home-install-banner">';
  html += '<p><a href="#/instalar">Instala la app para no perder tus datos</a></p>';
  html += '<button type="button" class="install-banner-close" id="home-install-banner-close" aria-label="Cerrar aviso">×</button>';
  html += '</div>';
  return html;
}

// Cierra el aviso de instalar (sin guardar nada: solo evita que reaparezca
// mientras la pestaña siga abierta).
function wireHomeInstallBanner() {
  var closeBtn = document.getElementById('home-install-banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      installBannerDismissed = true;
      document.getElementById('home-install-banner').hidden = true;
    });
  }
}

// HTML del aviso discreto de "haz una copia de tus datos" en Inicio
// (step-16): para quien ya lleva 3 registros o mas y todavia no ha
// instalado la app, como recordatorio de ir a Mis datos antes de perder
// algo. Independiente del aviso de instalar de arriba (ese es solo para
// el primer uso, sin ningun registro).
function homeBackupBannerHtml() {
  var html = '<div class="install-banner" id="home-backup-banner">';
  html += '<p><a href="#/mis-datos">Haz una copia de tus datos</a></p>';
  html += '<button type="button" class="install-banner-close" id="home-backup-banner-close" aria-label="Cerrar aviso">×</button>';
  html += '</div>';
  return html;
}

function wireHomeBackupBanner() {
  var closeBtn = document.getElementById('home-backup-banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      backupBannerDismissed = true;
      document.getElementById('home-backup-banner').hidden = true;
    });
  }
}

// HTML del bloque "¿Y ahora qué?" en Inicio (step-14e): la frase del autor
// segun el nivel elegido, con el botón "Elegir mi día" hacia Mi día.
function homeDiaSectionHtml(today) {
  var html = '<div id="home-dia-section"' + (today ? '' : ' hidden') + '>';
  html += '<p class="eyebrow">¿Y ahora qué?</p>';
  html += '<p id="home-dia-frase" class="confirmation confirmation-on-dark" aria-live="polite">' +
    (today ? escapeHtml(GUIDE_CONTENT.miDiaFrases[today.level]) : '') + '</p>';
  html += '<a class="btn btn-on-dark" href="#/pasos">Elegir mi día</a>';
  html += '</div>';
  return html;
}

// Etiqueta corta de la franja del Aviso diario ("Mañana"/"Tarde"/"Noche"),
// para la tarjeta/línea de Inicio (paso 17i). Mismos 3 valores que
// RECORDATORIO_FRANJAS en storage.js.
function franjaPrincipalLabel(franja) {
  if (franja === 'tarde') { return 'Tarde'; }
  if (franja === 'noche') { return 'Noche'; }
  return 'Mañana';
}

// Tarjeta (o línea de estado) del Aviso diario en Inicio (paso 17i): hace
// visible la función de Recordatorios, que antes solo se veía en el pie de
// página. Pura navegación -- nunca carga ni llama nada de OneSignal aqui,
// eso solo ocurre dentro de los botones de #/recordatorios (ver
// cargarOneSignalSDK()/inicializarOneSignal() y AVISO_ONESIGNAL_CONECTADO
// mas abajo).
function homeAvisoCardHtml(prefs) {
  if (prefs.activo) {
    var html = '<div class="bento-card bento-card-wide bento-card-beige bento-aviso-status">';
    html += '<p class="bento-aviso-status-text">Aviso activo · ' + escapeHtml(franjaPrincipalLabel(prefs.franja)) + '</p>';
    html += '<a class="bento-skip-link" href="#/recordatorios">Cambiar</a>';
    html += '</div>';
    return html;
  }
  if (hasOcultadoAvisoInicio()) {
    return '';
  }
  var html = '<div class="bento-card bento-card-wide bento-card-beige" id="home-aviso-card">';
  html += '<h3>Un aviso diario, si te ayuda</h3>';
  html += '<p>Te lo recordamos a la hora que elijas. Sin rachas ni culpa.</p>';
  html += '<a class="btn" href="#/recordatorios">Activar aviso</a>';
  html += '<button type="button" class="bento-skip-link" id="home-aviso-skip-btn">Ahora no</button>';
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
  var isInstalled = isStandaloneDisplay();

  var html = homeGreetingHtml(showWelcomeBack);

  // Aviso discreto de "instala la app" (step-15): solo en el primer uso
  // (todavía sin ningún registro) y solo si no está instalada. Se puede
  // cerrar; no vuelve a aparecer en esta sesión aunque sigas sin instalar.
  if (!isInstalled && entries.length === 0 && !installBannerDismissed) {
    html += homeInstallBannerHtml();
  }

  // Aviso discreto de "haz una copia de tus datos" (step-16): para quien ya
  // tiene 3 registros o más y sigue sin instalar la app. Independiente del
  // aviso de arriba (ese solo sale sin ningún registro todavía).
  if (!isInstalled && entries.length >= 3 && !backupBannerDismissed) {
    html += homeBackupBannerHtml();
  }

  html += '<div class="bento-grid">';

  html += '<div class="bento-card bento-card-hero">';
  html += '<h2>¿Cómo está tu energía hoy?</h2>';
  html += '<div class="bento-hero-well">';
  html += '<div class="level-buttons" id="home-level-buttons">';
  ['alta', 'media', 'baja'].forEach(function (level) {
    var isSelected = !!(today && today.level === level);
    html += '<button type="button" class="level-btn' + (isSelected ? ' selected' : '') +
      '" data-level="' + level + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' + levelLabel(level) + '</button>';
  });
  html += '</div>';
  html += '</div>';
  html += '<button type="button" class="bento-skip-link-white" id="home-skip-btn">Prefiero no registrar hoy</button>';
  html += '<p id="home-log-confirm" class="confirmation confirmation-on-dark" aria-live="polite"' + (today ? '' : ' hidden') + '>' +
    (today ? 'Ya has registrado hoy. Puedes cambiarlo cuando quieras.' : 'Guardado.') + '</p>';
  html += '<p id="home-skip-msg" class="confirmation confirmation-on-dark" aria-live="polite" hidden>Vale, hoy no es necesario. Puedes registrar cuando quieras.</p>';

  // Nota opcional: nunca es un paso obligatorio entre el toque y el
  // guardado. El guardado ya ocurre al tocar un nivel (ver abajo); esta
  // sección solo aparece despues, y sigue siendo opcional.
  html += homeExtraSectionHtml(today);

  // "¿Y ahora qué?" (step-14e): la frase del autor segun el nivel, con el
  // botón que lleva a Mi día. Nunca bloquea nada.
  html += homeDiaSectionHtml(today);

  html += '</div>';

  // Aviso diario (paso 17i): visible aquí, entre la tarjeta principal y
  // "Últimos 7 días" -- antes solo estaba en el pie de página, casi
  // invisible.
  html += homeAvisoCardHtml(getRecordatorioPrefs());

  html += '<a class="bento-card bento-card-wide bento-mini-chart" href="#/evolucion">';
  html += '<div class="bento-card-header-row"><p class="eyebrow">Últimos 7 días</p><span class="bento-card-chevron" aria-hidden="true">›</span></div>';
  html += '<h3>Tu evolución</h3>';
  if (entries.length >= 2) {
    html += '<canvas id="home-evolution-canvas"></canvas>';
  }
  if (entries.length < 3) {
    html += '<p>' + escapeHtml(apunta3DiasMensaje(entries.length)) + '</p>';
  } else if (!hasSeenResumen()) {
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

  html += '<p class="home-footer">Recibes esta app por tu suscripción a @compartir.para.sanar.' +
    (isInstalled ? '' : ' <a href="#/instalar">Cómo instalar</a>') + '</p>';

  document.getElementById('app-content').innerHTML = html;
  wireHomeInstallBanner();
  wireHomeBackupBanner();

  var homeAvisoSkipBtn = document.getElementById('home-aviso-skip-btn');
  if (homeAvisoSkipBtn) {
    homeAvisoSkipBtn.addEventListener('click', function () {
      ocultarAvisoInicio();
      var card = document.getElementById('home-aviso-card');
      if (card) { card.hidden = true; }
    });
  }

  if (entries.length >= 2) {
    var canvas = document.getElementById('home-evolution-canvas');
    var homeChartEntries = entries.slice(0, 7).reverse();
    drawEvolutionChart(canvas, homeChartEntries);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', evolutionChartAriaLabel(homeChartEntries));
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
      levelButtons.forEach(function (b) { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
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
  var html = '';
  ['pantalla1', 'pantalla2'].forEach(function (key, i) {
    var group = i === 0 ? 'quitan' : 'recargan';
    var pantalla = cfg[key];
    html += '<p class="exercise-label">' + escapeHtml(pantalla.pregunta) + '</p>';
    html += '<div class="ejercicio-e1-pantalla-body" id="ejercicio-e1-body-' + group + '">';
    html += ejercicioE1BodyHtml(group, saved, false);
    html += '</div>';
  });
  html += '<p class="confirmation" id="ejercicio-e1-final" aria-live="polite"' + (saved.recargan && saved.recargan.length ? '' : ' hidden') + '>' + escapeHtml(cfg.final) + '</p>';
  return html;
}

// Chips + fila de "+ Añadir" de UNA pantalla del Ejercicio 1. Igual que
// miDiaGroupBodyHtml (step-16, B6): se puede refrescar solo esto, sin tocar
// el resto de ejercicioE1Html, para que no salte al añadir algo nuevo.
// addFieldOpen: si el campo de añadir debe quedar abierto con un "Listo"
// para cerrarlo (justo después de añadir una cosa).
function ejercicioE1BodyHtml(group, saved, addFieldOpen) {
  var cfg = GUIDE_CONTENT.ejercicioE1;
  var pantalla = group === 'quitan' ? cfg.pantalla1 : cfg.pantalla2;
  var answerKey = group;
  var misCosas = getMisCosas();
  var items = pantalla.chips.concat(misCosas[group] || []);
  var html = '<div class="tag-chips ejercicio-e1-chips" data-answer-key="' + answerKey + '" data-mis-cosas-group="' + group + '">';
  items.forEach(function (item) {
    var isChecked = saved[answerKey] && saved[answerKey].indexOf(item) !== -1;
    html += '<button type="button" class="tag-chip ejercicio-e1-item' + (isChecked ? ' selected' : '') +
      '" data-item="' + escapeHtml(item) + '" aria-pressed="' + (isChecked ? 'true' : 'false') + '">' + escapeHtml(item) + '</button>';
  });
  html += '</div>';
  html += '<div class="mi-dia-add-row">';
  html += '<button type="button" class="btn btn-outline ejercicio-e1-add-toggle" data-mis-cosas-group="' + group + '"' + (addFieldOpen ? ' hidden' : '') + '>+ Añadir la mía</button>';
  html += '<div class="ejercicio-e1-add-fields" data-mis-cosas-group="' + group + '"' + (addFieldOpen ? '' : ' hidden') + '>';
  html += '<input type="text" class="exercise-input ejercicio-e1-add-input" data-mis-cosas-group="' + group + '" data-answer-key="' + answerKey + '" placeholder="Añadir la mía">';
  html += '<button type="button" class="btn btn-secondary ejercicio-e1-add-btn" data-mis-cosas-group="' + group + '" data-answer-key="' + answerKey + '">Añadir</button>';
  html += '<button type="button" class="btn btn-secondary ejercicio-e1-add-done" data-mis-cosas-group="' + group + '">Listo</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

// Conecta los chips y "+ Añadir" del Ejercicio 1 (ver ejercicioE1Html).
// Cada toque guarda al instante; el de la pantalla 2 ("recargan") también
// se refleja en las cosas elegidas hoy en Mi día (decisión A del plan).
function wireEjercicioE1(container) {
  container = container || document;
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
    btn.setAttribute('aria-pressed', nowSelected ? 'true' : 'false');
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

  container.querySelectorAll('.ejercicio-e1-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.ejercicio-e1-chips');
      toggleItem(wrap.getAttribute('data-answer-key'), wrap.getAttribute('data-mis-cosas-group'), btn.getAttribute('data-item'), btn);
    });
  });

  container.querySelectorAll('.ejercicio-e1-add-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-mis-cosas-group');
      var fields = document.querySelector('.ejercicio-e1-add-fields[data-mis-cosas-group="' + group + '"]');
      btn.hidden = true;
      fields.hidden = false;
      var input = fields.querySelector('.ejercicio-e1-add-input');
      if (input) input.focus();
    });
  });

  container.querySelectorAll('.ejercicio-e1-add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-mis-cosas-group');
      var answerKey = btn.getAttribute('data-answer-key');
      var input = document.querySelector('.ejercicio-e1-add-input[data-mis-cosas-group="' + group + '"]');
      var label = input ? input.value.trim() : '';
      if (!label) return;
      addMiCosa(group, label);
      var saved = getExerciseAnswers('ex-3-1') || { quitan: [], recargan: [] };
      var list = Array.isArray(saved[answerKey]) ? saved[answerKey].slice() : [];
      if (list.indexOf(label) === -1) list.push(label);
      saved[answerKey] = list;
      saveExerciseAnswers('ex-3-1', saved);
      if (group === 'recargan') {
        var chosen = getMiDiaForDate(today).chosen.slice();
        if (chosen.indexOf(label) === -1) chosen.push(label);
        setMiDiaChosen(today, chosen);
      }
      refreshEjercicioE1Body(group, true);
    });
  });

  container.querySelectorAll('.ejercicio-e1-add-done').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-mis-cosas-group');
      refreshEjercicioE1Body(group, false);
    });
  });
}

// Refresca solo los chips + fila de "+ Añadir" de una pantalla del
// Ejercicio 1 (step-16, B6: mismo cambio mínimo que refreshMiDiaGroupBody).
function refreshEjercicioE1Body(group, addFieldOpen) {
  var saved = getExerciseAnswers('ex-3-1') || { quitan: [], recargan: [] };
  var body = document.getElementById('ejercicio-e1-body-' + group);
  if (!body) return;
  body.innerHTML = ejercicioE1BodyHtml(group, saved, addFieldOpen);
  wireEjercicioE1(body);
  var finalMsg = document.getElementById('ejercicio-e1-final');
  if (finalMsg) finalMsg.hidden = !(saved.recargan && saved.recargan.length);
  if (addFieldOpen) {
    var input = body.querySelector('.ejercicio-e1-add-input');
    if (input) input.focus();
  }
}

// HTML del Ejercicio 2 ("Mi ritual mínimo"): un momento del día y hasta 3
// pasos tocados de la lista del autor. Sin límite forzado: la propia
// instrucción ("toca 3 pasos") ya guía cuántos elegir.
function ejercicioE2Html() {
  var cfg = GUIDE_CONTENT.ejercicioE2;
  var saved = getExerciseAnswers('ex-5-1') || { momento: '', pasos: [] };
  var html = '';
  html += '<p class="exercise-label">' + escapeHtml(cfg.intro1) + '</p>';
  html += '<div class="tag-chips" id="ejercicio-e2-momento">';
  ['Mañana', 'Tarde', 'Noche'].forEach(function (m) {
    var isSelectedMomento = saved.momento === m;
    html += '<button type="button" class="tag-chip ejercicio-e2-momento-btn' + (isSelectedMomento ? ' selected' : '') +
      '" data-momento="' + escapeHtml(m) + '" aria-pressed="' + (isSelectedMomento ? 'true' : 'false') + '">' + escapeHtml(m) + '</button>';
  });
  html += '</div>';
  html += '<p class="exercise-label">' + escapeHtml(cfg.intro2) + '</p>';
  html += '<div class="tag-chips" id="ejercicio-e2-pasos">';
  cfg.opciones.forEach(function (opt) {
    var isChecked = Array.isArray(saved.pasos) && saved.pasos.indexOf(opt) !== -1;
    html += '<button type="button" class="tag-chip ejercicio-e2-paso-btn' + (isChecked ? ' selected' : '') +
      '" data-paso="' + escapeHtml(opt) + '" aria-pressed="' + (isChecked ? 'true' : 'false') + '">' + escapeHtml(opt) + '</button>';
  });
  html += '</div>';
  html += '<p class="confirmation" id="ejercicio-e2-final" aria-live="polite"' + (saved.pasos && saved.pasos.length ? '' : ' hidden') + '>' + escapeHtml(cfg.final) + '</p>';
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
      document.querySelectorAll('.ejercicio-e2-momento-btn').forEach(function (b) { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      save(btn.getAttribute('data-momento'), saved.pasos || []);
    });
  });
  document.querySelectorAll('.ejercicio-e2-paso-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var saved = getExerciseAnswers('ex-5-1') || { momento: '', pasos: [] };
      var pasos = Array.isArray(saved.pasos) ? saved.pasos.slice() : [];
      var paso = btn.getAttribute('data-paso');
      var idx = pasos.indexOf(paso);
      if (idx === -1) { pasos.push(paso); btn.classList.add('selected'); btn.setAttribute('aria-pressed', 'true'); } else { pasos.splice(idx, 1); btn.classList.remove('selected'); btn.setAttribute('aria-pressed', 'false'); }
      save(saved.momento || '', pasos);
    });
  });
}

// HTML del Ejercicio 3 ("El filtro de las 3 preguntas"). No se guarda
// respuesta: es una herramienta para usar cada vez con una situación nueva.
function ejercicioE3Html() {
  var cfg = GUIDE_CONTENT.ejercicioE3;
  var html = '';
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
  html += '<p id="ejercicio-e3-todo-bien" class="confirmation" aria-live="polite" hidden>' + escapeHtml(cfg.todoBienMensaje) + '</p>';
  return html;
}

// Cada pregunta "dispara" con una respuesta distinta (step-14f, antes
// cualquier "No" disparaba por igual y la pregunta 2 quedaba al reves):
// P1 "No" -> mejor no; P2 "Sí" (puede esperar/delegarse/simplificarse) ->
// mejor no; P3 "No" -> mejor no.
var EJERCICIO_E3_DISPARA_CON = [false, true, false];

function wireEjercicioE3() {
  var respuestas = {};
  var resultado = document.getElementById('ejercicio-e3-resultado');
  var todoBien = document.getElementById('ejercicio-e3-todo-bien');

  function responder(index, valor, siBtn, noBtn) {
    respuestas[index] = valor;
    siBtn.classList.toggle('selected', valor === true);
    noBtn.classList.toggle('selected', valor === false);
    var answeredCount = Object.keys(respuestas).length;
    if (answeredCount < 3) { resultado.hidden = true; todoBien.hidden = true; return; }
    var algunDispara = Object.keys(respuestas).some(function (k) {
      return respuestas[k] === EJERCICIO_E3_DISPARA_CON[Number(k)];
    });
    resultado.hidden = !algunDispara;
    todoBien.hidden = algunDispara;
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

  // Paso 17j: enlace a Recordatorios con el mismo estilo de tarjeta que
  // los ejercicios de arriba -- aqui no se despliega en el sitio (no es un
  // "details"), lleva directamente a la pantalla de Recordatorios.
  html += '<a class="exercise-card" href="#/recordatorios">';
  html += '<h3>Recordatorios</h3>';
  html += '<p>Activa un aviso diario o pon una alarma en tu Reloj.</p>';
  html += '</a>';

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

  var html = '<a class="chapter-back-link" href="#/guia">‹ Guía</a>';
  html += '<p class="eyebrow">Capítulo ' + Number(id) + ' de ' + GUIDE_CONTENT.chapters.length + '</p>';
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
      html += renderTextBlock(stripBlankPrompts(exercise.instructions));
      var toolMatch = Object.keys(CHAPTER_EXERCISE_TOOL_LINKS).filter(function (prefix) {
        return exercise.title.indexOf(prefix) === 0;
      })[0];
      if (toolMatch) {
        html += '<p><a href="#/herramientas">Hazlo en Herramientas</a></p>';
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
  var html = '<a class="chapter-back-link" href="#/guia">‹ Guía</a>';
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

// Nivel que manda hoy en Mi día: el de hoy si ya se registró; si no, el
// límite por defecto "media" (step-16: nunca el nivel de otro día — ese
// registro puede no reflejar cómo está hoy, así que no debe fijar el
// límite de hoy).
function miDiaLevelForToday() {
  var today = getTodayEntry();
  return today ? today.level : 'media';
}

// HTML de un grupo de "Mis cosas" (Pesan / Ligeras / Me recargan): el
// <details> en sí, que envuelve el contenido que puede refrescarse solo
// (ver miDiaGroupBodyHtml) sin perder si estaba abierto o cerrado.
function miDiaGroupHtml(groupKey, chosen, misCosas, isOpen) {
  var group = GUIDE_CONTENT.miDia.grupos[groupKey];
  var html = '<details class="inline-details mi-dia-group" data-group="' + groupKey + '"' + (isOpen ? ' open' : '') + '>';
  html += '<summary>' + escapeHtml(group.label) + '</summary>';
  html += '<div class="mi-dia-group-body" id="mi-dia-group-body-' + groupKey + '">';
  html += miDiaGroupBodyHtml(groupKey, chosen, misCosas, false);
  html += '</div>';
  html += '</details>';
  return html;
}

// Chips tocables, el aviso de límite de ESE grupo (step-16, B1: ya no es
// compartido entre los tres grupos) y el campo "+ Añadir la mía". Se
// puede volver a pintar solo esto, sin tocar el <details> que lo envuelve
// (step-16, B6), así que no se pierde si estaba abierto o cerrado.
// addFieldOpen: si el campo de añadir debe aparecer ya abierto (justo
// después de añadir una cosa), con un botón "Listo" para cerrarlo.
function miDiaGroupBodyHtml(groupKey, chosen, misCosas, addFieldOpen) {
  var group = GUIDE_CONTENT.miDia.grupos[groupKey];
  var items = group.items.concat(misCosas[groupKey] || []);
  var html = '<div class="tag-chips" data-group="' + groupKey + '">';
  items.forEach(function (item) {
    var isChosen = chosen.indexOf(item) !== -1;
    html += '<button type="button" class="tag-chip mi-dia-item' + (isChosen ? ' selected' : '') +
      '" data-item="' + escapeHtml(item) + '" aria-pressed="' + (isChosen ? 'true' : 'false') + '">' + escapeHtml(item) + '</button>';
  });
  html += '</div>';
  html += '<p class="confirmation mi-dia-limit-warning" data-group="' + groupKey + '" aria-live="polite" hidden></p>';
  html += '<div class="mi-dia-add-row">';
  html += '<button type="button" class="btn btn-outline mi-dia-add-toggle" data-group="' + groupKey + '"' + (addFieldOpen ? ' hidden' : '') + '>+ Añadir la mía</button>';
  html += '<div class="mi-dia-add-fields" data-group="' + groupKey + '"' + (addFieldOpen ? '' : ' hidden') + '>';
  html += '<input type="text" class="exercise-input mi-dia-add-input" data-group="' + groupKey + '" placeholder="Añadir la mía">';
  html += '<button type="button" class="btn btn-secondary mi-dia-add-btn" data-group="' + groupKey + '">Añadir</button>';
  html += '<button type="button" class="btn btn-secondary mi-dia-add-done" data-group="' + groupKey + '">Listo</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

// HTML de "Cerrar el día": una casilla por cada cosa elegida hoy (todas
// opcionales) y el botón de cierre. Sin casillas si no se eligió nada, pero
// el botón sigue disponible: cerrar el día no depende de haber elegido algo.
function cerrarElDiaHtml(chosen, done) {
  var cfg = GUIDE_CONTENT.miDia.cerrarElDia;
  var html = '<h2>' + escapeHtml(cfg.titulo) + '</h2>';
  // step-14f: sin nada elegido todavia no hay nada que cerrar, asi que ni
  // la pregunta ni el boton aparecen hasta elegir al menos una cosa.
  if (!chosen.length) {
    return html;
  }
  html += '<p>' + escapeHtml(cfg.pregunta) + '</p>';
  html += '<div class="mi-dia-cerrar-list">';
  chosen.forEach(function (item) {
    var checked = done[item] === true ? ' checked' : '';
    html += '<label class="checklist-check"><input type="checkbox" class="mi-dia-done-check" data-item="' +
      escapeHtml(item) + '"' + checked + '> ' + escapeHtml(item) + '</label>';
  });
  html += '</div>';
  html += '<button type="button" class="btn" id="mi-dia-cerrar-btn">' + escapeHtml(cfg.titulo) + '</button>';
  html += '<p id="mi-dia-cerrar-msg" class="confirmation" aria-live="polite" hidden></p>';
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
  html += '<p id="mi-dia-recargan-msg" class="confirmation" aria-live="polite" hidden></p>';
  html += '<div id="mi-dia-cerrar-wrap">' + cerrarElDiaHtml(miDiaToday.chosen, miDiaToday.done) + '</div>';

  html += '<details class="inline-details" id="mi-dia-paso-section">';
  html += '<summary>Pequeño paso de hoy</summary>';
  html += '<div id="mi-dia-paso-content">' + renderPasoCardHtml(0) + '</div>';
  html += '</details>';
  html += '<p class="chapter-end-msg"><a href="#/herramientas">¿Dudas si meter algo más? Pruébalo aquí</a></p>';
  html += '<p class="chapter-end-msg"><a href="#/recordatorios">Poner un recordatorio en el móvil</a></p>';

  document.getElementById('app-content').innerHTML = html;
  wireMiDiaPaso(0);
  wireMiDiaGroups(level, MI_DIA_LIMITS[level]);
  wireMiDiaAddForms();
  wireMiDiaCerrar();
  var repetirBtn = document.getElementById('mi-dia-repetir-btn');
  if (repetirBtn) {
    repetirBtn.addEventListener('click', function () {
      // step-16, B7: si ya hay algo elegido hoy, pide confirmación antes
      // de reemplazarlo (en vez de machacarlo directamente).
      if (miDiaToday.chosen.length) {
        showRepetirConfirm(repetirBtn, today, yesterdayChosen);
        return;
      }
      setMiDiaChosen(today, yesterdayChosen.slice());
      renderMiDia();
    });
  }
}

// Confirmación en línea antes de "Repetir lo de ayer" cuando hoy ya hay
// algo elegido (step-16, B7): mismo patrón que la confirmación de borrar
// datos en Mis datos, para no sorprender con un reemplazo silencioso.
function showRepetirConfirm(repetirBtn, today, yesterdayChosen) {
  var existing = document.getElementById('mi-dia-repetir-confirm');
  if (existing) return;
  var box = document.createElement('div');
  box.id = 'mi-dia-repetir-confirm';
  box.className = 'callout';
  var text = document.createElement('p');
  text.textContent = 'Ya has elegido algo para hoy. ¿Quieres sustituirlo por lo de ayer?';
  box.appendChild(text);
  var row = document.createElement('div');
  row.className = 'confirm-buttons';
  var yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'btn btn-danger';
  yesBtn.textContent = 'Sí, sustituir';
  yesBtn.addEventListener('click', function () {
    setMiDiaChosen(today, yesterdayChosen.slice());
    renderMiDia();
  });
  var noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'btn btn-secondary';
  noBtn.textContent = 'Cancelar';
  noBtn.addEventListener('click', function () {
    box.remove();
  });
  row.appendChild(yesBtn);
  row.appendChild(noBtn);
  box.appendChild(row);
  repetirBtn.insertAdjacentElement('afterend', box);
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

// Campos "+ Añadir la mía" de cada grupo: añade a mis-cosas sin perder el
// estado abierto/cerrado del <details> (step-16, B6: solo se refresca el
// contenido de ese grupo, ver refreshMiDiaGroupBody). container acota la
// búsqueda de botones a un solo grupo cuando se vuelve a llamar tras un
// refresco; por defecto (primer pintado) es todo el documento.
function wireMiDiaAddForms(container) {
  container = container || document;

  container.querySelectorAll('.mi-dia-add-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      var fields = document.querySelector('.mi-dia-add-fields[data-group="' + group + '"]');
      btn.hidden = true;
      fields.hidden = false;
      var input = fields.querySelector('.mi-dia-add-input');
      if (input) input.focus();
    });
  });

  container.querySelectorAll('.mi-dia-add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      var input = document.querySelector('.mi-dia-add-input[data-group="' + group + '"]');
      var label = input ? input.value.trim() : '';
      if (!label) return;
      addMiCosa(group, label);
      refreshMiDiaGroupBody(group, true);
    });
  });

  container.querySelectorAll('.mi-dia-add-done').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      refreshMiDiaGroupBody(group, false);
    });
  });
}

// Vuelve a pintar solo los chips, el aviso de límite y la fila de
// "+ Añadir la mía" de UN grupo (step-16, B6): no toca el <details> que lo
// envuelve, así que conserva si estaba abierto o cerrado. addFieldOpen: si
// el campo de añadir debe quedar abierto (justo tras añadir una cosa, con
// un botón "Listo" para cerrarlo después).
function refreshMiDiaGroupBody(groupKey, addFieldOpen) {
  var level = miDiaLevelForToday();
  var miDiaToday = getMiDiaForDate(todayDateString());
  var misCosas = getMisCosas();
  var body = document.getElementById('mi-dia-group-body-' + groupKey);
  if (!body) return;
  body.innerHTML = miDiaGroupBodyHtml(groupKey, miDiaToday.chosen, misCosas, addFieldOpen);
  wireMiDiaGroups(level, MI_DIA_LIMITS[level], body);
  wireMiDiaAddForms(body);
  if (addFieldOpen) {
    var input = body.querySelector('.mi-dia-add-input');
    if (input) input.focus();
  }
}

// Grupos a los que se aplica el límite 3/2/1 (step-15): solo "Pesan" y
// "Ligeras" cuentan juntos contra el límite. "Me recargan" no tiene límite
// ni aviso de "suficiente" — elegir algo ahí siempre suma, nunca pesa.
var MI_DIA_GRUPOS_CON_LIMITE = ['pesan', 'ligeras'];

// Cuenta cuántas de las cosas elegidas hoy pertenecen a un grupo con
// límite (pesan o ligeras), incluyendo lo añadido a mano con "+ Añadir".
function contarEligidasConLimite(chosen, misCosas) {
  var itemsConLimite = [];
  MI_DIA_GRUPOS_CON_LIMITE.forEach(function (g) {
    var group = GUIDE_CONTENT.miDia.grupos[g];
    itemsConLimite = itemsConLimite.concat(group.items, misCosas[g] || []);
  });
  return chosen.filter(function (item) {
    return itemsConLimite.indexOf(item) !== -1;
  }).length;
}

// Toca una cosa: si ya estaba elegida, siempre se puede quitar. Si es de
// "Pesan" o "Ligeras" y ya se llegó al límite del nivel (solo esos dos
// grupos cuentan), muestra el aviso suave con "Añadir igualmente" en vez de
// añadirla directamente — nunca bloquea del todo. Si es de "Me recargan",
// se añade siempre al toque y muestra un mensaje positivo, sin límite.
// container acota la búsqueda de chips a un solo grupo cuando se vuelve a
// llamar tras refrescar ese grupo (step-16, B6); por defecto (primer
// pintado) es todo el documento.
function wireMiDiaGroups(level, limit, container) {
  container = container || document;
  var today = todayDateString();
  var recarganMsg = document.getElementById('mi-dia-recargan-msg');

  // step-16, B1: el aviso de límite ya no es un único elemento compartido,
  // es el de ESE grupo (dentro de su propio <details>).
  function warningForBtn(btn) {
    var groupEl = btn.closest('.mi-dia-group');
    return groupEl ? groupEl.querySelector('.mi-dia-limit-warning') : null;
  }

  function hideWarning(warning) {
    if (!warning) return;
    warning.hidden = true;
    warning.innerHTML = '';
  }

  function hideRecarganMsg() {
    recarganMsg.hidden = true;
    recarganMsg.textContent = '';
  }

  function selectItem(item, btn, warning) {
    var current = getMiDiaForDate(today).chosen.slice();
    if (current.indexOf(item) === -1) current.push(item);
    setMiDiaChosen(today, current);
    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
    hideWarning(warning);
    hideRecarganMsg();
    refreshCerrarElDia();
  }

  function showLimitWarning(item, btn, warning) {
    if (!warning) return;
    hideWarning(warning);
    var text = document.createElement('span');
    text.textContent = GUIDE_CONTENT.miDia.avisoLimite.replace('{n}', String(limit)) + ' ';
    var addAnyway = document.createElement('button');
    addAnyway.type = 'button';
    addAnyway.className = 'btn btn-secondary';
    addAnyway.textContent = 'Añadir igualmente';
    addAnyway.addEventListener('click', function () { selectItem(item, btn, warning); });
    warning.appendChild(text);
    warning.appendChild(addAnyway);
    warning.hidden = false;
    // Si el aviso no queda totalmente visible dentro del grupo abierto, un
    // scroll suave hasta él (step-16, B1).
    var rect = warning.getBoundingClientRect();
    var fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) {
      warning.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showRecarganMsg() {
    recarganMsg.textContent = GUIDE_CONTENT.miDia.mensajeRecargan;
    recarganMsg.hidden = false;
  }

  container.querySelectorAll('.mi-dia-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.getAttribute('data-item');
      var group = btn.closest('.tag-chips').getAttribute('data-group');
      var warning = warningForBtn(btn);
      if (btn.classList.contains('selected')) {
        var current = getMiDiaForDate(today).chosen.slice();
        var idx = current.indexOf(item);
        if (idx !== -1) current.splice(idx, 1);
        setMiDiaChosen(today, current);
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
        hideWarning(warning);
        hideRecarganMsg();
        refreshCerrarElDia();
        return;
      }
      if (group === 'recargan') {
        selectItem(item, btn, warning);
        showRecarganMsg();
        return;
      }
      var misCosas = getMisCosas();
      var chosenNow = getMiDiaForDate(today).chosen;
      if (contarEligidasConLimite(chosenNow, misCosas) >= limit) {
        showLimitWarning(item, btn, warning);
        return;
      }
      selectItem(item, btn, warning);
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
      '" data-level="' + level + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' + levelLabel(level) + '</button>';
  });
  html += '</div>';
  html += '<input type="hidden" id="log-level" value="' + escapeHtml(selectedLevel) + '">';
  html += '<label for="log-note" class="exercise-label">Nota (opcional)</label>';
  html += '<textarea id="log-note" class="field-textarea">' + escapeHtml(selectedNote) + '</textarea>';
  html += '<button type="submit" id="log-save">Guardar</button>';
  html += '<button type="button" class="bento-skip-link" id="log-skip-btn">Prefiero no registrar hoy</button>';
  html += '<div id="log-confirmation" class="callout" aria-live="polite" hidden><p class="confirmation">Guardado en tu móvil. Puedes editarlo cuando quieras.</p></div>';
  html += '<p id="log-skip-msg" class="confirmation" aria-live="polite" hidden>Vale, hoy no es necesario. Puedes registrar cuando quieras.</p>';
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
      buttons.forEach(function (b) { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
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
// Mensaje de "aun faltan dias" cuando hay menos de 3 registros, compartido
// por Inicio y Evolución (step-14f: antes decian cosas distintas).
function apunta3DiasMensaje(total) {
  var missing = 3 - total;
  return 'Apunta 3 días para ver tu evolución. Te falta' + (missing === 1 ? '' : 'n') + ' ' + missing + ' más.';
}

function buildEvolutionSummary(entries) {
  var total = entries.length;
  var lines = [];

  if (total < 3) {
    lines.push(apunta3DiasMensaje(total));
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
  var allEntries = getEnergyLog();

  // Se marca como "visto" al abrir esta vista, pero solo a partir de 3
  // registros (step-16, E1): es el mismo umbral en el que Inicio deja de
  // mostrar "Tu resumen está listo" (ver homeDiaSectionHtml/arriba). Si se
  // marcara antes, ese aviso en Inicio nunca llegaria a aparecer.
  if (allEntries.length >= 3) {
    markResumenSeen();
  }

  var html = '<p class="eyebrow">Últimos 14 días</p><h1>Evolución</h1>';

  if (allEntries.length < 2) {
    // Mismo mensaje que Inicio para 0 o 1 registros (step-16, E2): antes
    // decia algo distinto aqui ("Necesitas al menos 2 registros...").
    html += '<p>' + escapeHtml(apunta3DiasMensaje(allEntries.length)) + '</p>';
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
          '" data-level="' + level + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' + levelLabel(level) + '</button>';
      });
      html += '</div>';
      html += '<p class="exercise-label">Etiquetas (opcional)</p>';
      html += '<div class="tag-chips evolution-edit-tags">';
      LOG_TAGS.forEach(function (tag) {
        var isChecked = Array.isArray(entry.tags) && entry.tags.indexOf(tag) !== -1;
        html += '<button type="button" class="tag-chip' + (isChecked ? ' selected' : '') +
          '" data-tag="' + escapeHtml(tag) + '" aria-pressed="' + (isChecked ? 'true' : 'false') + '">' + escapeHtml(tag) + '</button>';
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
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', evolutionChartAriaLabel(chartEntries));

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
        editButtons.forEach(function (x) { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('selected');
        b.setAttribute('aria-pressed', 'true');
      });
    });

    var editTagsContainer = document.querySelector('.evolution-edit-tags');
    var editTagButtons = editTagsContainer ? editTagsContainer.querySelectorAll('.tag-chip') : [];
    editTagButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        var nowSelected = !b.classList.contains('selected');
        b.classList.toggle('selected');
        b.setAttribute('aria-pressed', nowSelected ? 'true' : 'false');
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
  html += '<div id="export-share-fallback" hidden></div>';
  html += '<p id="export-confirm" class="confirmation" aria-live="polite" hidden></p>';
  html += '<p id="export-error" class="confirmation" aria-live="polite" hidden></p>';
  html += '</div>';

  html += '<div class="card">';
  html += '<h2>Importar</h2>';
  html += '<div class="callout"><p>Si ya tienes un archivo de copia de seguridad (.json), puedes importarlo aquí. Esto sustituirá los registros que tengas ahora mismo en este móvil.</p></div>';
  html += '<label for="import-file" class="btn btn-secondary">Elegir archivo para importar</label>';
  html += '<input type="file" id="import-file" class="visually-hidden" accept="application/json,.json">';
  html += '<div id="import-error" class="callout" aria-live="polite" hidden></div>';
  html += '<div id="import-confirm" class="callout" aria-live="polite" hidden></div>';
  html += '<p id="import-success" class="confirmation" aria-live="polite" hidden>Importación completada.</p>';
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
  html += '<p id="delete-success" class="confirmation" aria-live="polite" hidden>Tus datos se han borrado.</p>';
  html += '</div>';

  html += '</div>';

  document.getElementById('app-content').innerHTML = html;

  document.getElementById('export-btn').addEventListener('click', function () {
    var exportConfirm = document.getElementById('export-confirm');
    var exportError = document.getElementById('export-error');
    var shareFallback = document.getElementById('export-share-fallback');
    exportConfirm.hidden = true;
    exportError.hidden = true;
    shareFallback.hidden = true;
    shareFallback.innerHTML = '';

    var filename = 'mi-energia-' + todayDateString() + '.json';
    var json;
    try {
      json = exportDataJSON();
    } catch (e) {
      exportError.textContent = 'No se ha podido preparar la exportación. Inténtalo de nuevo.';
      exportError.hidden = false;
      return;
    }

    // Muestra el JSON en un campo de solo lectura para copiar a mano:
    // alternativa cuando no se puede descargar ni compartir el archivo.
    function showCopyFallback() {
      var label = document.createElement('p');
      label.className = 'exercise-label';
      label.textContent = 'No se puede descargar el archivo aquí dentro. Copia este texto y guárdalo donde quieras:';
      var textarea = document.createElement('textarea');
      textarea.className = 'field-textarea';
      textarea.setAttribute('readonly', 'readonly');
      textarea.value = json;
      shareFallback.appendChild(label);
      shareFallback.appendChild(textarea);
      shareFallback.hidden = false;
      textarea.focus();
      textarea.select();
    }

    // Dentro de la app instalada en iPhone (standalone), WebKit bloquea la
    // descarga de un blob con <a download> (el mismo bug ya documentado
    // para el .ics de Recordatorios, WebKit 236943). Ahí se intenta
    // compartir el archivo con navigator.share, y si no está disponible,
    // se muestra el JSON para copiar a mano. Importante: esto no se ha
    // podido probar en un iPhone real — no hay forma de confirmar aquí si
    // el share entrega el archivo correctamente en ese contexto exacto.
    if (isIOSDevice() && isStandaloneDisplay()) {
      var blobForShare = new Blob([json], { type: 'application/json' });
      var file = (typeof File !== 'undefined') ? new File([blobForShare], filename, { type: 'application/json' }) : null;
      if (file && window.navigator.canShare && window.navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: filename }).then(function () {
          exportConfirm.textContent = 'Archivo compartido: ' + filename + '.';
          exportConfirm.hidden = false;
        }).catch(function () {
          // Puede ser que el usuario cancelara el share, no necesariamente
          // un fallo: se ofrece igualmente la alternativa de copiar.
          showCopyFallback();
        });
        return;
      }
      showCopyFallback();
      return;
    }

    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      exportConfirm.textContent = 'Descargado: ' + filename + '.';
      exportConfirm.hidden = false;
    } catch (e) {
      exportError.textContent = 'No se ha podido descargar el archivo. Inténtalo de nuevo.';
      exportError.hidden = false;
    }
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
  var isIOS = isIOSDevice();
  // Boton nativo de instalar (step-15): solo aparece si el navegador ha
  // disparado "beforeinstallprompt" (Chrome/Android y algunos de
  // escritorio; nunca en Safari/iOS). window.deferredInstallPrompt lo
  // guarda app.js al capturar ese evento.
  var hasNativePrompt = !isIOS && !!window.deferredInstallPrompt;

  var html = '<p class="eyebrow">Ábrela en Safari (iPhone) o en Chrome (Android), no desde otra app.</p>';
  html += '<h1>Instalar la app</h1>';
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
  if (hasNativePrompt) {
    html += '<p>O usa este botón directamente:</p>';
    html += '<button type="button" class="btn" id="install-native-btn">Instalar</button>';
  }
  html += '</details>';

  html += '<h2>¿Por qué instalar?</h2>';
  html += '<p>Safari y otros navegadores pueden borrar los datos de una pestaña normal cuando pasa tiempo sin usarla o cuando el teléfono necesita espacio. Si instalas la app como un icono aparte, tus registros quedan mucho más protegidos frente a ese borrado automático.</p>';
  html += '<p>Aun así, haz copias de seguridad de tus datos de vez en cuando desde <a href="#/mis-datos">Mis datos</a>, por si acaso.</p>';

  html += '<p class="signature">@compartir.para.sanar</p>';
  document.getElementById('app-content').innerHTML = html;

  var nativeBtn = document.getElementById('install-native-btn');
  if (nativeBtn) {
    nativeBtn.addEventListener('click', function () {
      if (!window.deferredInstallPrompt) return;
      window.deferredInstallPrompt.prompt();
      window.deferredInstallPrompt.userChoice.then(function () {
        window.deferredInstallPrompt = null;
        renderInstall();
      });
    });
  }
}

// Genera el texto de un archivo .ics con dos eventos diarios recurrentes
// (mañana y noche), con una alarma de aviso y un enlace de vuelta a la app
// en la descripción. Es un archivo local, generado en el propio navegador:
// no se envía a ningún sitio. Experimental (step-15): la fiabilidad de
// descargar y abrir un .ics varía mucho según teléfono y navegador.
function buildRecordatoriosICS(morning, night) {
  var today = todayDateString().replace(/-/g, '');
  var stamp = today + 'T000000Z';
  var appUrl = location.href.split('#')[0];

  function vevent(uid, time, summary) {
    var hhmm = time.replace(':', '') + '00';
    return [
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + stamp,
      'DTSTART:' + today + 'T' + hhmm,
      'RRULE:FREQ=DAILY',
      'SUMMARY:' + summary,
      'DESCRIPTION:' + appUrl,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + summary,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n');
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mi Energia//Recordatorios//ES',
    'CALSCALE:GREGORIAN',
    vevent('mi-energia-manana-' + today + '@local', morning, 'Registrar mi energía y elegir mi día'),
    vevent('mi-energia-noche-' + today + '@local', night, 'Cerrar el día'),
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

// Paso 17c: ya existe la conexión real con OneSignal, con el App ID real
// de la app "Mi Energía" (Web Push) que Ana creó en su dashboard. Sigue
// siendo 100% opt-in -- nada de esto corre hasta que la persona pulsa
// "Activar aviso". Ese botón carga el SDK, pide permiso y suscribe de
// verdad; "Desactivar" llama a optOut(). El App ID no es secreto -- va
// siempre en el código del cliente de cualquier app que use OneSignal.
var ONESIGNAL_APP_ID = '475231f5-c34f-4639-942f-e172c1966994';
var AVISO_ONESIGNAL_CONECTADO = true;

// Service worker dedicado de OneSignal (paso 17b): vive fuera del alcance
// del service worker principal de la app (./service-worker.js, que
// controla /mi-energia/ entero) para no chocar con su cache-first. La
// ruta coincide con push/onesignal/OneSignalSDKWorker.js en este mismo
// repo -- ver ese archivo, que solo reexporta el worker oficial de
// OneSignal, nada propio.
var ONESIGNAL_SW_PATH = 'push/onesignal/OneSignalSDKWorker.js';
var ONESIGNAL_SW_SCOPE = '/mi-energia/push/onesignal/';

// Inserta el <script> del SDK de OneSignal SOLO la primera vez que se
// llama a esta función -- es la única función de todo el proyecto que
// añade un <script src> externo, y solo se llama desde dentro del
// handler de "Activar aviso"/"Desactivar aviso" (nunca al cargar la app).
// Si el SDK ya está cargado en esta sesión, no vuelve a insertar nada.
function cargarOneSignalSDK() {
  return new Promise(function (resolve, reject) {
    if (window.OneSignal) {
      resolve();
      return;
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    var script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = function () { resolve(); };
    script.onerror = function () { reject(new Error('No se pudo cargar el SDK de OneSignal.')); };
    document.head.appendChild(script);
  });
}

// Carga (si falta) e inicializa OneSignal, y devuelve una promesa que se
// resuelve con el objeto OneSignal ya listo para pedir permiso / etiquetar
// / darse de baja. El service worker dedicado (ver arriba) solo se
// registra en este momento, no antes.
function inicializarOneSignal() {
  return cargarOneSignalSDK().then(function () {
    return new Promise(function (resolve) {
      window.OneSignalDeferred.push(function (OneSignal) {
        OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: ONESIGNAL_SW_PATH,
          serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE }
        }).then(function () {
          resolve(OneSignal);
        });
      });
    });
  });
}

// Paso 17f: pone un tiempo máximo a una promesa de red (carga del SDK,
// init, requestPermission...). Si no se resuelve ni rechaza en ese tiempo,
// esta promesa se rechaza con 'tiempo-agotado' -- así, si el navegador o
// la red se quedan colgados, la persona ve un mensaje tranquilo y el
// botón vuelve a su estado normal, en vez de quedarse bloqueado para
// siempre. Si la promesa original acaba resolviéndose más tarde, ya no
// hace nada (se ignora: la pantalla ya se repintó con el mensaje de
// tiempo agotado).
function conTiempoLimite(promesa, ms) {
  return new Promise(function (resolve, reject) {
    var vencido = false;
    var temporizador = setTimeout(function () {
      vencido = true;
      reject(new Error('tiempo-agotado'));
    }, ms);
    promesa.then(function (valor) {
      if (!vencido) {
        clearTimeout(temporizador);
        resolve(valor);
      }
    }, function (err) {
      if (!vencido) {
        clearTimeout(temporizador);
        reject(err);
      }
    });
  });
}

// HTML de la sección "Aviso diario (opcional)" de Recordatorios (paso 17).
// Va arriba de las alarmas manuales porque es la opción recomendada; las
// alarmas manuales siguen debajo como alternativa para quien no la active.
function avisoDiarioHtml(prefs) {
  // Paso 17h: la etiqueta principal es solo "Mañana"/"Tarde"/"Noche" --
  // la hora exacta va debajo, en texto más suave, para no competir con
  // los relojes de la alarma manual de más abajo. Los valores reales de
  // franja (f.id) y las horas de envío no cambian, solo cómo se muestran.
  var franjas = [
    { id: 'manana', principal: 'Mañana', hora: 'a partir de las 9:00' },
    { id: 'tarde', principal: 'Tarde', hora: 'a partir de las 18:00' },
    { id: 'noche', principal: 'Noche', hora: 'a partir de las 21:00' }
  ];

  var html = '<h2>Aviso diario (opcional)</h2>';
  html += '<p>Si quieres, la app puede avisarte una vez al día para que no se te olvide registrar tu energía. ' +
    'Es opcional y puedes desactivarlo cuando quieras.</p>';

  html += '<div class="callout"><p><strong>Qué sale de tu móvil si lo activas:</strong> solo lo mínimo que ' +
    'necesita el servicio que envía el aviso (sistema operativo, idioma, zona horaria, país aproximado, modelo ' +
    'de tu dispositivo y la franja que elijas abajo). <strong>Nunca se envían tus registros de energía, tus ' +
    'notas ni nada de lo que guardas en esta app.</strong> Puedes leer el detalle completo en ' +
    '<a href="#/privacidad">Privacidad</a>.</p></div>';

  html += '<fieldset class="aviso-franjas-fieldset">';
  html += '<legend class="exercise-label">¿Cuándo quieres el aviso?</legend>';
  html += '<ul class="aviso-franjas">';
  franjas.forEach(function (f) {
    var checked = prefs.franja === f.id ? ' checked' : '';
    html += '<li class="aviso-franja-row">';
    html += '<input type="radio" id="aviso-franja-' + f.id + '" name="aviso-franja" value="' + f.id + '"' + checked + '>';
    html += '<label for="aviso-franja-' + f.id + '" class="aviso-franja-label">';
    html += '<span class="aviso-franja-principal">' + escapeHtml(f.principal) + '</span>';
    html += '<span class="aviso-franja-hora">' + escapeHtml(f.hora) + '</span>';
    html += '</label>';
    html += '</li>';
  });
  html += '</ul>';
  html += '</fieldset>';

  // Paso 17f: mensaje breve y tranquilo para confirmar que, al cambiar de
  // franja con el aviso ya activado, se actualizó también en el servicio
  // (no solo aquí en el móvil). Vacío por defecto; wireAvisoDiario() le
  // pone texto solo cuando hace falta.
  html += '<p class="eyebrow" id="aviso-franja-confirmacion" aria-live="polite"></p>';

  if (prefs.activo) {
    html += '<p class="aviso-estado">Aviso activado para la franja elegida.</p>';
    html += '<button type="button" class="btn btn-secondary" id="aviso-desactivar-btn">Desactivar aviso</button>';
  } else {
    html += '<button type="button" class="btn" id="aviso-activar-btn">Activar aviso</button>';
  }

  if (!AVISO_ONESIGNAL_CONECTADO) {
    html += '<p class="eyebrow">Esta función todavía se está terminando: de momento guarda tu preferencia, pero los avisos todavía no se envían.</p>';
  }

  return html;
}

// Repinta solo la zona del "Aviso diario" (estado, botón, mensaje de
// franja) con las preferencias actuales, sin tocar el resto de la
// pantalla de Recordatorios -- en particular, sin tocar los selectores de
// hora de la alarma manual (paso 17g: antes, un renderRecordatorios()
// completo los hacía perder cualquier cambio sin guardar). Paso 17h:
// además, abre o cierra el desplegable "Prefiero una alarma en mi Reloj
// (alternativa)" según si el aviso quedó activo -- solo cambia su
// atributo "open", nunca su contenido, así que los selectores de hora de
// dentro siguen intactos.
function actualizarAvisoZona() {
  var zona = document.getElementById('aviso-diario-zona');
  if (!zona) { return; }
  var prefs = getRecordatorioPrefs();
  zona.innerHTML = avisoDiarioHtml(prefs);
  wireAvisoDiario();
  var alarmaAlt = document.getElementById('recordatorio-alarma-alt');
  if (alarmaAlt) { alarmaAlt.open = !prefs.activo; }
}

// Conecta los controles del "Aviso diario" (paso 17a): franja elegida y
// botón activar/desactivar. Todo lo que hace es leer/guardar la preferencia
// local vía storage.js y actualizar su propia zona de la pantalla -- no
// toca la red salvo al activar/desactivar de verdad.
function wireAvisoDiario() {
  var activarBtn = document.getElementById('aviso-activar-btn');
  var desactivarBtn = document.getElementById('aviso-desactivar-btn');

  function franjaElegida() {
    var checked = document.querySelector('input[name="aviso-franja"]:checked');
    return checked ? checked.value : 'manana';
  }

  document.querySelectorAll('input[name="aviso-franja"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var prefs = getRecordatorioPrefs();
      var nuevaFranja = franjaElegida();
      saveRecordatorioPrefs(nuevaFranja, prefs.activo);

      var confirmacionEl = document.getElementById('aviso-franja-confirmacion');
      // Paso 17f: si el aviso ya está activado, cambiar de franja también
      // debe avisar al servicio (si no, seguiría llegando el aviso a la
      // franja anterior). Un mensaje breve y tranquilo confirma que se
      // actualizó -- o, si falla, que al menos quedó guardado aquí.
      if (prefs.activo && AVISO_ONESIGNAL_CONECTADO) {
        if (confirmacionEl) { confirmacionEl.textContent = 'Actualizando la franja del aviso…'; }
        conTiempoLimite(
          inicializarOneSignal().then(function (OneSignal) {
            return OneSignal.User.addTag('franja', nuevaFranja);
          }),
          12000
        ).then(function () {
          if (confirmacionEl) { confirmacionEl.textContent = 'Franja del aviso actualizada.'; }
        }).catch(function () {
          if (confirmacionEl) {
            confirmacionEl.textContent = 'La franja se guardó en este móvil; se actualizará en el aviso en cuanto haya conexión.';
          }
        });
      }
    });
  });

  if (activarBtn) {
    activarBtn.addEventListener('click', function () {
      var franja = franjaElegida();
      if (!AVISO_ONESIGNAL_CONECTADO) {
        saveRecordatorioPrefs(franja, true);
        actualizarAvisoZona();
        return;
      }
      // El SDK se carga aquí, dentro del toque de la persona -- nunca
      // antes. Deshabilitamos el botón mientras se pide permiso para
      // evitar toques repetidos mientras el navegador muestra su diálogo.
      activarBtn.disabled = true;
      activarBtn.textContent = 'Activando…';
      // Paso 17f: la carga del SDK, el init y el requestPermission juntos
      // no pueden tardar más de 12 segundos -- si se quedan colgados (sin
      // red, o el navegador no muestra el diálogo de permiso), mejor un
      // mensaje tranquilo que un botón bloqueado para siempre.
      conTiempoLimite(inicializarOneSignal().then(function (OneSignal) {
        // En iPhone, Safari sin instalar (sin "Añadir a pantalla de
        // inicio") no soporta notificaciones push -- lo comprobamos antes
        // de pedir permiso para poder mostrar un mensaje claro en vez de
        // uno genérico de error.
        if (!OneSignal.Notifications.isPushSupported()) {
          throw new Error('no-soportado');
        }
        return OneSignal.Notifications.requestPermission().then(function () {
          if (!OneSignal.Notifications.permission) {
            throw new Error('permiso-denegado');
          }
          OneSignal.User.addTag('franja', franja);
          saveRecordatorioPrefs(franja, true);
          actualizarAvisoZona();
        }).catch(function (innerErr) {
          if (innerErr && innerErr.message === 'permiso-denegado') {
            throw innerErr;
          }
          // Algunos navegadores no soportados (ej. Safari de iPhone sin
          // instalar) no fallan en isPushSupported() sino aquí mismo, con
          // un error que menciona "support" en el mensaje.
          var texto = (innerErr && innerErr.message) ? String(innerErr.message).toLowerCase() : '';
          if (texto.indexOf('support') !== -1) {
            throw new Error('no-soportado');
          }
          throw innerErr;
        });
      }), 12000).catch(function (err) {
        activarBtn.disabled = false;
        activarBtn.textContent = 'Activar aviso';
        if (err && err.message === 'no-soportado') {
          alert('Para activar el aviso en iPhone, primero añade la app a tu pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde su icono.');
        } else if (err && err.message === 'permiso-denegado') {
          alert('No se activó el aviso porque no se concedió el permiso de notificaciones. Puedes intentarlo de nuevo, o revisar el permiso de notificaciones de esta app en los ajustes de tu navegador o de tu móvil. En iPhone: Ajustes → Notificaciones → Mi Energía.');
        } else if (err && err.message === 'tiempo-agotado') {
          alert('Esto está tardando más de lo esperado. Comprueba tu conexión e inténtalo de nuevo.');
        } else {
          alert('No se pudo activar el aviso. Comprueba tu conexión e inténtalo de nuevo.');
        }
      });
    });
  }
  if (desactivarBtn) {
    desactivarBtn.addEventListener('click', function () {
      var franja = franjaElegida();
      if (!AVISO_ONESIGNAL_CONECTADO) {
        saveRecordatorioPrefs(franja, false);
        actualizarAvisoZona();
        return;
      }
      desactivarBtn.disabled = true;
      inicializarOneSignal().then(function (OneSignal) {
        return OneSignal.User.PushSubscription.optOut();
      }).catch(function () {
        // Si optOut() falla (por ejemplo sin conexión), seguimos
        // guardando la preferencia local como desactivada: lo importante
        // es que la persona deje de ver el aviso como "activo" en esta
        // app. Si vuelve a pulsar Desactivar más adelante con conexión,
        // se reintenta el optOut() remoto.
      }).then(function () {
        saveRecordatorioPrefs(franja, false);
        actualizarAvisoZona();
      });
    });
  }
}

// Dos <select> sencillos (hora 0-23, minutos 00/15/30/45) para elegir una
// hora sin usar input type="time" -- ese input se salía de la pantalla en
// iPhone instalado y además algunos iOS lo muestran casi imposible de
// tocar. "hora" llega como "HH:MM"; si los minutos no son uno de los 4
// valores redondos, se ajusta al más cercano para que el select siempre
// tenga una opción marcada.
function horaSelectsHtml(idPrefix, hora, ariaHoraLabel, ariaMinutoLabel) {
  var partes = (hora || '09:00').split(':');
  var h = parseInt(partes[0], 10);
  var m = parseInt(partes[1], 10);
  if (isNaN(h) || h < 0 || h > 23) { h = 9; }
  var minutosValidos = [0, 15, 30, 45];
  if (minutosValidos.indexOf(m) === -1) {
    m = minutosValidos.reduce(function (masCercano, candidato) {
      return Math.abs(candidato - m) < Math.abs(masCercano - m) ? candidato : masCercano;
    }, 0);
  }

  var html = '<div class="recordatorio-hora-row">';
  html += '<select class="recordatorio-hora-select" id="' + idPrefix + '-h" aria-label="' + escapeHtml(ariaHoraLabel) + '">';
  for (var hh = 0; hh < 24; hh++) {
    var hhTexto = (hh < 10 ? '0' : '') + hh;
    html += '<option value="' + hhTexto + '"' + (hh === h ? ' selected' : '') + '>' + hhTexto + '</option>';
  }
  html += '</select>';
  html += '<span class="recordatorio-hora-separador" aria-hidden="true">:</span>';
  html += '<select class="recordatorio-hora-select" id="' + idPrefix + '-m" aria-label="' + escapeHtml(ariaMinutoLabel) + '">';
  minutosValidos.forEach(function (mm) {
    var mmTexto = (mm < 10 ? '0' : '') + mm;
    html += '<option value="' + mmTexto + '"' + (mm === m ? ' selected' : '') + '>' + mmTexto + '</option>';
  });
  html += '</select>';
  html += '</div>';
  return html;
}

// HTML de la pantalla de Recordatorios (step-15, ampliada en paso 17a,
// 17e, 17g y 17h). Las horas de las alarmas manuales ahora se recuerdan
// (paso 17g, ver getAlarmaManualHoras() en storage.js) -- "morning"/
// "night" llegan ya leídas de ahí, no hardcodeadas. Sigue sin copiarse
// aquí la hora del aviso diario -- son dos cosas distintas y no hay que
// mezclarlas sin que la persona lo pida claramente. Paso 17h: los
// selectores de hora y su explicación viven siempre dentro del
// desplegable "alternativa", para no mostrar dos juegos de horas a la
// vez junto a las opciones del aviso de arriba. El botón de .ics solo se
// muestra donde puede funcionar (Android y Safari normal); dentro de la
// app instalada en iPhone (standalone) se omite, porque WebKit bloquea
// esa descarga en modo standalone.
function recordatoriosHtml(morning, night, showIcsSection, isIOS, isStandalone, prefs) {
  var html = '<h1>Recordatorios</h1>';

  // Paso 17g: esta zona se repinta sola (ver actualizarAvisoZona()) al
  // activar/desactivar el aviso, para no tocar los selectores de hora de
  // la alarma manual de más abajo.
  html += '<div id="aviso-diario-zona">' + avisoDiarioHtml(prefs) + '</div>';

  // Paso 17h: el cuadro, los selectores y los pasos de la alarma manual
  // van todos dentro de este desplegable -- no se repiten las horas del
  // aviso, que ya se ven arriba junto a cada franja.
  var alarmaManualHtml = '<div class="callout"><p>Estos relojes solo rellenan los pasos de abajo para que no ' +
    'escribas la hora a mano. La alarma de verdad se crea en la app Reloj de tu móvil.</p></div>';

  alarmaManualHtml += '<div class="recordatorio-field">';
  alarmaManualHtml += '<p class="exercise-label">Por la mañana: registrar mi energía y elegir mi día</p>';
  alarmaManualHtml += horaSelectsHtml('recordatorio-manana-hora', morning, 'Hora de la alarma de la mañana', 'Minutos de la alarma de la mañana');
  alarmaManualHtml += '</div>';
  alarmaManualHtml += '<div class="recordatorio-field">';
  alarmaManualHtml += '<p class="exercise-label">Por la noche: cerrar el día</p>';
  alarmaManualHtml += horaSelectsHtml('recordatorio-noche-hora', night, 'Hora de la alarma de la noche', 'Minutos de la alarma de la noche');
  alarmaManualHtml += '</div>';

  alarmaManualHtml += '<p>Esta es la forma que funciona siempre, en cualquier teléfono: una alarma diaria normal, con un nombre que te recuerde qué tocaba.</p>';

  alarmaManualHtml += '<details class="platform-details"' + (isIOS ? ' open' : '') + '>';
  alarmaManualHtml += '<summary>En iPhone (con la app Reloj)</summary>';
  alarmaManualHtml += '<ol>';
  alarmaManualHtml += '<li>Abre la app Reloj y toca "Alarma".</li>';
  alarmaManualHtml += '<li>Toca el botón + y pon la hora en <span class="recordatorio-manana-texto">' + escapeHtml(morning) + '</span>.</li>';
  alarmaManualHtml += '<li>En "Repetir", marca los siete días (o toca "Todos los días" si tu iPhone lo muestra así).</li>';
  alarmaManualHtml += '<li>En "Etiqueta", escribe "Registrar mi energía y elegir mi día" y guarda.</li>';
  alarmaManualHtml += '<li>Repite los mismos pasos a las <span class="recordatorio-noche-texto">' + escapeHtml(night) +
    '</span>, con la etiqueta "Cerrar el día".</li>';
  alarmaManualHtml += '<li>Si tu móvil no muestra exactamente esto, busca lo que más se parezca: lo importante es que se repita cada día y tenga ese nombre.</li>';
  alarmaManualHtml += '</ol>';
  alarmaManualHtml += '</details>';

  alarmaManualHtml += '<details class="platform-details"' + (isIOS ? '' : ' open') + '>';
  alarmaManualHtml += '<summary>En Android (con la app Reloj)</summary>';
  alarmaManualHtml += '<ol>';
  alarmaManualHtml += '<li>Abre la app Reloj y toca el botón + para añadir una alarma.</li>';
  alarmaManualHtml += '<li>Pon la hora en <span class="recordatorio-manana-texto">' + escapeHtml(morning) + '</span>.</li>';
  alarmaManualHtml += '<li>Marca todos los días para que se repita (en algunos móviles hay una casilla "Repetir").</li>';
  alarmaManualHtml += '<li>En «Etiqueta» o «Nombre de alarma», escribe "Registrar mi energía y elegir mi día". Si tu móvil tiene botón Guardar, púlsalo.</li>';
  alarmaManualHtml += '<li>Repite los mismos pasos a las <span class="recordatorio-noche-texto">' + escapeHtml(night) +
    '</span>, con la etiqueta "Cerrar el día".</li>';
  alarmaManualHtml += '<li>Si tu móvil no muestra exactamente esto, busca lo que más se parezca: lo importante es que se repita cada día y tenga ese nombre.</li>';
  alarmaManualHtml += '</ol>';
  alarmaManualHtml += '</details>';

  // Paso 17e/17h: con el aviso ya activado, la alarma manual es una
  // alternativa secundaria -- se pliega para no repetir dos juegos de
  // horas a la vez. Sin aviso activado, se abre por defecto como antes.
  html += '<details class="platform-details" id="recordatorio-alarma-alt"' + (prefs.activo ? '' : ' open') + '>';
  html += '<summary>Prefiero una alarma en mi Reloj (alternativa)</summary>';
  html += alarmaManualHtml;
  html += '</details>';

  if (showIcsSection) {
    html += '<h2>Alternativa: archivo para el calendario (experimental)</h2>';
    html += '<p>En Android y en Safari (sin tener la app instalada) puedes probar a descargar un archivo que añade ' +
      'estos dos avisos a tu calendario. Es experimental: en algunos teléfonos puede que no funcione. Si no ' +
      'funciona, usa los pasos de la alarma de arriba.</p>';
    html += '<button type="button" class="btn btn-outline" id="recordatorio-ics-btn">Descargar recordatorio (.ics)</button>';
  } else if (isIOS && isStandalone) {
    html += '<p class="eyebrow">Dentro de la app instalada en iPhone no se puede descargar el archivo del calendario: usa los pasos de la alarma de arriba.</p>';
  }

  html += '<p class="signature">@compartir.para.sanar</p>';
  return html;
}

// Conecta los selectores de hora (paso 17e: dos <select> -- hora y
// minutos -- en vez de un input type="time"). Actualizan al instante el
// texto de las instrucciones, guardan la elección (paso 17g, ver
// saveAlarmaManualHoras() en storage.js) para que no se pierda al
// repintar la pantalla, y el botón de .ics los usa para generar el
// archivo en el momento.
function wireRecordatorios() {
  var mananaH = document.getElementById('recordatorio-manana-hora-h');
  var mananaM = document.getElementById('recordatorio-manana-hora-m');
  var nocheH = document.getElementById('recordatorio-noche-hora-h');
  var nocheM = document.getElementById('recordatorio-noche-hora-m');
  var morningTextEls = document.querySelectorAll('.recordatorio-manana-texto');
  var nightTextEls = document.querySelectorAll('.recordatorio-noche-texto');

  function morningValue() {
    return (mananaH.value || '09') + ':' + (mananaM.value || '00');
  }
  function nightValue() {
    return (nocheH.value || '21') + ':' + (nocheM.value || '00');
  }

  [mananaH, mananaM].forEach(function (sel) {
    sel.addEventListener('change', function () {
      var v = morningValue();
      morningTextEls.forEach(function (el) { el.textContent = v; });
      saveAlarmaManualHoras(morningValue(), nightValue());
    });
  });
  [nocheH, nocheM].forEach(function (sel) {
    sel.addEventListener('change', function () {
      var v = nightValue();
      nightTextEls.forEach(function (el) { el.textContent = v; });
      saveAlarmaManualHoras(morningValue(), nightValue());
    });
  });

  var icsBtn = document.getElementById('recordatorio-ics-btn');
  if (icsBtn) {
    icsBtn.addEventListener('click', function () {
      var morning = morningValue();
      var night = nightValue();
      var ics = buildRecordatoriosICS(morning, night);
      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'recordatorios-mi-energia.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }
}

function renderRecordatorios() {
  var isIOS = isIOSDevice();
  var standalone = isStandaloneDisplay();
  var showIcsSection = !(isIOS && standalone);
  var prefs = getRecordatorioPrefs();
  var horas = getAlarmaManualHoras();
  var html = recordatoriosHtml(horas.morning, horas.night, showIcsSection, isIOS, standalone, prefs);
  document.getElementById('app-content').innerHTML = html;
  wireRecordatorios();
  wireAvisoDiario();
}

function renderPrivacy() {
  var html = '<h1>Privacidad</h1>';
  html += '<div class="callout"><p>Todo se guarda solo en tu móvil. No sale nada de ahí, salvo que tú decidas ' +
    'activar el aviso diario opcional de <a href="#/recordatorios">Recordatorios</a>: en ese caso, el servicio ' +
    'que lo envía recibe los datos mínimos que necesita (lo explicamos más abajo).</p></div>';

  html += '<h2>Qué se guarda</h2>';
  html += '<p>Tus registros de energía y tus notas se guardan únicamente en este móvil, dentro del propio ' +
    'navegador (lo que se llama "almacenamiento local"). Nunca se copian a ningún servidor nuestro ni de ' +
    'terceros, y nunca se envían a internet -- ni siquiera si activas el aviso diario opcional, que solo manda ' +
    'lo que se explica en la sección "Aviso diario y OneSignal" más abajo.</p>';
  html += '<p>Los ejercicios de la guía ya no se escriben dentro de los capítulos: "Mis dos listas" y "Mi ritual mínimo" se hacen tocando desde Herramientas, y se guardan solo en este móvil igual que el resto de tus datos. Si respondiste a algún ejercicio en una versión anterior de la app, esa respuesta se conserva en este móvil y sigue incluida en la exportación, la importación y el borrado de datos.</p>';
  html += '<p>Las marcas de las checklists (por ejemplo, la checklist diaria del Capítulo 7 o del Toolkit) también se guardan solo en este móvil, con el mismo tratamiento que el resto de tus datos.</p>';
  html += '<p>Lo mismo ocurre con "Pequeño paso de hoy" (si hoy te ha pasado algo o no, dentro de Mi día): se guarda solo en este móvil, y se incluye igual en la exportación, la importación y el borrado de datos.</p>';
  html += '<p>Las etiquetas opcionales que añadas a un registro (por ejemplo "Dormí mal" o "Pude descansar") se guardan junto a ese registro, solo en este móvil, con el mismo tratamiento que el resto de tus datos.</p>';
  html += '<p>Lo mismo ocurre con lo que eliges cada día en Mi día, lo que marcas al cerrar el día, las cosas que añades tú misma a las listas y el capítulo de la guía por el que vas: se guarda solo en este móvil, y se incluye igual en la exportación, la importación y el borrado de datos.</p>';
  html += '<p>Tus preferencias de <a href="#/recordatorios">Recordatorios</a> -- si activaste el aviso diario, la franja que elegiste, y las horas que pusiste en los selectores de la alarma manual de tu Reloj -- también se guardan solo en este móvil, para que no tengas que volver a elegirlas cada vez. Lo mismo ocurre si tocas "Ahora no" en la tarjeta del aviso diario de Inicio: solo se guarda en este móvil que ya la cerraste, para no volver a mostrártela. Al ser preferencias de la interfaz y no datos de energía, no se incluyen en la exportación ni la importación de la copia de seguridad.</p>';

  html += '<h2>Qué no recogemos</h2>';
  html += '<p>No te pedimos nombre, correo ni ubicación para usar la app. No usamos herramientas de analítica ' +
    'ni medimos cómo usas la app. No hay ningún servicio externo conectado por defecto: la app funciona sin ' +
    'conexión a internet y no manda nada a ningún sitio -- salvo la única excepción del aviso diario opcional, ' +
    'que solo actúa si tú lo activas (ver la sección siguiente).</p>';

  html += '<!-- BORRADOR paso 17: pendiente de revisión de Ana y su asesor antes de publicar -->';
  html += '<h2>Aviso diario (opcional) y el servicio que lo envía</h2>';
  html += '<p><em>Esta sección es un borrador pendiente de revisión; todavía no es definitiva. Además, en el ' +
    'momento de escribir esto el aviso diario todavía no envía nada: la conexión real llega en una actualización ' +
    'posterior.</em></p>';
  html += '<p>Si activas el aviso diario en <a href="#/recordatorios">Recordatorios</a>, un servicio externo ' +
    'especializado en avisos (OneSignal) se encarga de enviártelo a la franja que elijas. Es opcional: si no lo ' +
    'activas, esta sección no te afecta y no se envía nada.</p>';
  html += '<p><strong>Qué recibe ese servicio:</strong> el sistema operativo y modelo de tu dispositivo, el ' +
    'idioma, la zona horaria, el país aproximado (a partir de tu conexión), el estado del permiso de ' +
    'notificaciones, un identificador técnico para poder enviarte el aviso, y la franja horaria que elijas ' +
    '(mañana, tarde o noche). <strong>Nunca</strong> tus registros de energía, tus notas, ni nada de lo demás ' +
    'que guarda esta app.</p>';
  html += '<p><strong>Para qué se usa:</strong> solo para mandarte el aviso diario que tú elegiste. No se usa ' +
    'para publicidad ni se vende a nadie.</p>';
  html += '<p><strong>Base legal:</strong> tu consentimiento explícito, al pulsar "Activar aviso". Puedes ' +
    'retirarlo cuando quieras pulsando "Desactivar aviso" en esa misma pantalla.</p>';
  html += '<p><strong>Dónde se procesan estos datos:</strong> OneSignal es una empresa con sede en EEUU. Para ' +
    'datos de personas en la Unión Europea, declara ampararse en cláusulas contractuales tipo de la UE y en el ' +
    'marco de privacidad de datos UE-EEUU. <em>(Pendiente de confirmar con OneSignal si esto aplica igual en el ' +
    'plan gratuito antes de publicar este texto como definitivo.)</em></p>';

  html += '<h2>El único enlace externo activo: la lista de correo</h2>';
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
