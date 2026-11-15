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

// Paso 20: tambien escapa comillas. Este texto se usa dentro de atributos
// (data-item="..."), y una cosa añadida a mano con comillas -- Leer "El
// Quijote" -- cortaba el atributo: el chip no se podia marcar y el texto
// salia recortado.
// Paso 25: version visible en Mis datos, para saber cual tiene cada
// persona cuando cuenta un problema. OJO: hay que subirla A LA VEZ que
// CACHE_VERSION en service-worker.js (son el mismo numero).
var APP_VERSION = '37';

// Paso 25: los dos unicos enlaces que salen de la app (se abren fuera, en
// el navegador; no cargan nada dentro de la app). El formulario de opinion
// es voluntario; la guia es la pagina de «Menos Fatiga, Más Vida».
var FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfv_VDeE2eWSexqUklMOUwEalciv6AtdsvSrEVk4m8sB6Klxg/viewform';
var GUIDE_URL = 'https://tinyurl.com/guia-compartir';

// Enlace que se abre fuera de la app (pestaña nueva, rel noopener). Un
// lector de pantalla lo avisa con un texto oculto a la vista.
function externalLinkHtml(url, text, cssClass) {
  return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer"' +
    (cssClass ? ' class="' + cssClass + '"' : '') + '>' + escapeHtml(text) +
    '<span class="visually-hidden"> (se abre fuera de la app)</span></a>';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Paso 20: titulo de la pestaña segun la pantalla (antes era siempre el
// mismo, asi que un lector de pantalla no anunciaba el cambio).
var ROUTE_TITLES = {
  '/guia': 'Guía',
  '/guia/toolkit': 'Tu kit de herramientas',
  '/guia/plan-21': 'Plan de 21 días',
  '/registro': 'Registro',
  '/pasos': 'Mi día',
  '/herramientas': 'Herramientas',
  '/evolucion': 'Evolución',
  '/mis-datos': 'Mis datos',
  '/instalar': 'Instalar la app',
  '/recordatorios': 'Recordatorios',
  '/privacidad': 'Privacidad',
  '/quien': 'Quién hay detrás'
};

function updateDocumentTitle(hash) {
  var name = ROUTE_TITLES[hash] || '';
  var chapterMatch = String(hash).match(/^\/guia\/(\d+)$/);
  if (chapterMatch) { name = 'Capítulo ' + chapterMatch[1]; }
  document.title = (name ? name + ' — ' : '') + 'Mi Energía';
}

// Paso 20: tras navegar, la pantalla nueva empieza arriba y el foco pasa
// al contenido, sin que el navegador haga su propio scroll al enfocar.
function focusContentAfterNavigation() {
  window.scrollTo(0, 0);
  var main = document.getElementById('app-content');
  if (main) {
    main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
  }
}

// Paso 23: "Saltar al contenido" apuntaba a #app-content, y como la app
// navega con el hash, eso llevaba a Inicio. Ahora mueve el foco al
// contenido de la pantalla actual sin cambiar de pantalla. Lo llama app.js
// una vez al arrancar.
function wireSkipLink() {
  var link = document.querySelector('.skip-link');
  var main = document.getElementById('app-content');
  if (!link || !main) { return; }
  link.addEventListener('click', function (e) {
    e.preventDefault();
    main.setAttribute('tabindex', '-1');
    main.focus();
  });
}

// Paso 21: aviso discreto de "hay una versión nueva", fuera de <main> para
// que no desaparezca al cambiar de pantalla. Lo llama app.js cuando el
// service worker nuevo toma el mando. Solo aparece una vez.
function showUpdateBanner() {
  if (document.getElementById('update-banner')) { return; }
  var main = document.getElementById('app-content');
  if (!main) { return; }
  var banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  var text = document.createElement('p');
  text.textContent = 'Hay una versión nueva de la app.';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Actualizar';
  btn.addEventListener('click', function () {
    location.reload();
  });
  banner.appendChild(text);
  banner.appendChild(btn);
  main.parentNode.insertBefore(banner, main);
}

// Paso 20: fecha (YYYY-MM-DD) en la que se pinto la pantalla actual, para
// saber si el dia ha cambiado mientras la app seguia abierta.
var renderedOnDate = null;

function markRenderDate() {
  renderedOnDate = todayDateString();
}

function hasDayChangedSinceRender() {
  return renderedOnDate !== null && renderedOnDate !== todayDateString();
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
// Paso 23: las tablas "para rellenar a mano" de la guía llegan como filas
// con celdas vacías separadas por rayas ("Lunes —  — ", " —  —  — "), que
// en pantalla se veían como rayas sueltas. Aquí se limpia cada fila solo
// para mostrarla (content.js no se toca): una fila sin ningún texto se
// omite (devuelve null) y de una fila con huecos se muestran solo las
// celdas con texto. Las filas completas se devuelven tal cual.
function cleanTemplateRow(text) {
  var cells = String(text).split('—').map(function (c) { return c.trim(); });
  if (cells.length < 2) return text;
  var filled = cells.filter(function (c) { return c !== ''; });
  if (!filled.length) return null;
  if (filled.length === cells.length) return text;
  return filled.join(' — ');
}

function renderTextBlock(text) {
  var lines = String(text).split('\n');
  var html = '';
  var listBuffer = [];

  function flushList() {
    var rows = listBuffer.map(cleanTemplateRow).filter(function (l) { return l !== null; });
    if (rows.length) {
      html += '<ul>' + rows.map(function (l) {
        return '<li>' + escapeHtml(l) + '</li>';
      }).join('') + '</ul>';
    }
    listBuffer = [];
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
  html += '<p class="eyebrow eyebrow-on-dark">¿Y ahora qué?</p>';
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

// Paso 19: hora fija de envío de cada franja (igual para todo el mundo,
// en la zona horaria de quien la recibe -- cron-job.org + OneSignal
// mandan cada franja siempre a esta hora; la persona ya no elige una
// hora propia). Un solo sitio para no repetir estos 3 valores en varias
// funciones de este archivo.
var RECORDATORIO_FRANJAS_HORAS = { manana: '9:00', tarde: '18:00', noche: '21:00' };

// Paso 17k/19: junta las franjas marcadas con su hora fija en una frase
// corta ("Mañana 9:00", "Mañana 9:00 · Noche 21:00"), para la línea de
// estado de Inicio y de Recordatorios. Con la lista vacía devuelve ''
// (no debería llegar a mostrarse: con 0 franjas el aviso nunca está
// activo, ver getRecordatorioPrefs() en storage.js).
function franjasConHoraLabel(franjas) {
  return (franjas || []).map(function (f) {
    return franjaPrincipalLabel(f) + ' ' + (RECORDATORIO_FRANJAS_HORAS[f] || '');
  }).join(' · ');
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
    html += '<p class="bento-aviso-status-text">Aviso activo · ' + escapeHtml(franjasConHoraLabel(prefs.franjas)) + '</p>';
    html += '<a class="bento-skip-link" href="#/recordatorios">Cambiar</a>';
    html += '</div>';
    return html;
  }
  if (hasOcultadoAvisoInicio()) {
    return '';
  }
  var html = '<div class="bento-card bento-card-wide bento-card-beige" id="home-aviso-card">';
  html += '<h3>Un aviso diario, si te ayuda</h3>';
  html += '<p>Por la mañana, por la tarde o por la noche. Tú eliges. Sin rachas ni culpa.</p>';
  html += '<a class="btn" href="#/recordatorios">Activar aviso</a>';
  html += '<button type="button" class="bento-skip-link" id="home-aviso-skip-btn">Ahora no</button>';
  html += '</div>';
  return html;
}

// Contenido de la tarjeta "Tu evolución" de Inicio. Extraido de renderHome
// (paso 20) para poder repintar solo esto justo despues de registrar: antes
// seguia diciendo "Te faltan 3 más" aunque acabaras de apuntar un dia.
// La etiqueta dice "registros", no "días": el grafico muestra los ultimos 7
// registros, que pueden abarcar mas de 7 dias si hay huecos.
function homeEvolutionCardInnerHtml(entries) {
  var html = '<div class="bento-card-header-row"><p class="eyebrow">Últimos registros</p><span class="bento-card-chevron" aria-hidden="true">›</span></div>';
  html += '<h3>Tu evolución</h3>';
  if (entries.length >= 2) {
    html += '<canvas id="home-evolution-canvas"></canvas>';
  }
  if (entries.length < 3) {
    html += '<p>' + escapeHtml(apunta3DiasMensaje(entries.length)) + '</p>';
  } else if (!hasSeenResumen()) {
    html += '<p class="evolution-ready-hint">Tu resumen está listo.</p>';
  }
  return html;
}

function drawHomeEvolutionChart(entries) {
  var canvas = document.getElementById('home-evolution-canvas');
  if (!canvas || entries.length < 2) return;
  var homeChartEntries = entries.slice(0, 7).reverse();
  drawEvolutionChart(canvas, homeChartEntries);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', evolutionChartAriaLabel(homeChartEntries));
}

// Tras tocar un nivel en Inicio (paso 20): repinta la tarjeta de evolucion
// con el registro nuevo y retira el aviso de "instala la app", que solo es
// para quien todavia no tiene ningun registro.
function refreshHomeAfterLog() {
  var entries = getEnergyLog();
  var card = document.getElementById('home-evolution-card');
  if (card) {
    card.innerHTML = homeEvolutionCardInnerHtml(entries);
    drawHomeEvolutionChart(entries);
  }
  var installBanner = document.getElementById('home-install-banner');
  if (installBanner) { installBanner.hidden = true; }
}

// Paso 25: aviso para iPhone/iPad cuando la app NO está instalada. Es lo
// primero que se ve en Inicio (y en la bienvenida), porque en iPhone la
// app instalada no comparte datos con Safari: quien registre en Safari y
// la instale después empieza de cero. Nunca aparece dentro de la app
// instalada. "Seguir en Safari" lo oculta para siempre en este navegador.
function shouldShowIosInstallNotice() {
  return isIOSDevice() && !isStandaloneDisplay() && !hasOcultadoAvisoInstalarIOS();
}

function iosInstallNoticeHtml() {
  var html = '<div class="callout ios-install-notice" id="ios-install-notice">';
  html += '<p class="eyebrow">Antes de empezar, en iPhone</p>';
  html += '<p>Instala la app antes de registrar. Si la instalas después, empieza vacía: lo que anotes en Safari no pasa a la app instalada.</p>';
  html += '<a class="btn" href="#/instalar">Cómo instalarla</a>';
  html += '<button type="button" class="bento-skip-link" id="ios-install-notice-skip">Prefiero seguir en Safari</button>';
  html += '</div>';
  return html;
}

function wireIosInstallNotice() {
  var skip = document.getElementById('ios-install-notice-skip');
  if (skip) {
    skip.addEventListener('click', function () {
      ocultarAvisoInstalarIOS();
      document.getElementById('ios-install-notice').hidden = true;
    });
  }
}

// Paso 25: bienvenida de una sola pantalla, solo la primera vez que se
// abre Inicio sin ningún dato. Se da por vista en cuanto se muestra, así
// que nunca sale dos veces (tampoco si la persona se va a otra pestaña sin
// tocar "Empezar").
function renderBienvenida() {
  var html = shouldShowIosInstallNotice() ? iosInstallNoticeHtml() : '';
  html += '<div class="home-seal"><img src="assets/logo_b-transparente.svg" alt="Sello compartir · para · sanar" width="160" height="160"></div>';
  html += '<p class="eyebrow">@compartir.para.sanar</p>';
  html += '<h1>Esto es Mi Energía</h1>';
  html += '<p>Un sitio sencillo para anotar cómo está tu energía cada día y ver tu propio ritmo con el tiempo.</p>';
  html += '<p>Lo que anotas se queda en tu móvil. Sin cuentas.</p>';
  html += '<p>Sin rachas ni puntos. Si un día no registras, no pasa nada.</p>';
  html += '<p><strong>Empieza tocando cómo estás hoy.</strong></p>';
  html += '<button type="button" class="btn" id="bienvenida-empezar">Empezar</button>';
  document.getElementById('app-content').innerHTML = html;
  wireIosInstallNotice();
  document.getElementById('bienvenida-empezar').addEventListener('click', function () {
    renderHome();
    window.scrollTo(0, 0);
  });
}

function renderHome() {
  var today = getTodayEntry();
  var entries = getEnergyLog();

  // Paso 25: bienvenida solo la primera vez y solo sin datos. Quien ya
  // usaba la app (tiene registros) no la ve nunca.
  if (!hasSeenBienvenida()) {
    markBienvenidaSeen();
    if (entries.length === 0) {
      renderBienvenida();
      return;
    }
  }

  // "Bienvenida de nuevo" (step-14d): si hace 3 dias o mas que no se
  // registra nada, un saludo sin contar dias ni reprochar. Desaparece en
  // cuanto se registra (aqui, porque today ya existiria; y al momento, al
  // ocultarla a mano en el click del nivel, ver mas abajo).
  var showWelcomeBack = !today && entries.length > 0 && daysSinceDate(entries[0].date) >= 3;
  var isInstalled = isStandaloneDisplay();

  // Paso 25: en iPhone sin instalar, el aviso de instalar va lo primero,
  // por encima del saludo (ver iosInstallNoticeHtml).
  var showIosNotice = shouldShowIosInstallNotice();
  var html = (showIosNotice ? iosInstallNoticeHtml() : '') + homeGreetingHtml(showWelcomeBack);

  // Aviso discreto de "instala la app" (step-15): solo en el primer uso
  // (todavía sin ningún registro) y solo si no está instalada. Se puede
  // cerrar; no vuelve a aparecer en esta sesión aunque sigas sin instalar.
  // En iPhone lo sustituye el aviso de arriba (paso 25), que dice más.
  if (!isInstalled && !isIOSDevice() && entries.length === 0 && !installBannerDismissed) {
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
      '" data-level="' + level + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' + levelLabelHtml(level) + '</button>';
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

  html += '<a class="bento-card bento-card-wide bento-mini-chart" id="home-evolution-card" href="#/evolucion">';
  html += homeEvolutionCardInnerHtml(entries);
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
  // Paso 25: al final de Inicio, texto sencillo y discreto -- quién hay
  // detrás y la guía completa (esta se abre fuera de la app).
  html += '<p class="home-footer home-footer-links"><a href="#/quien">Quién hay detrás</a> ' +
    externalLinkHtml(GUIDE_URL, 'Menos Fatiga, Más Vida: la guía completa') + '</p>';

  document.getElementById('app-content').innerHTML = html;
  wireIosInstallNotice();
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

  drawHomeEvolutionChart(entries);

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
      var saved = saveEntry({
        date: todayDateString(),
        level: level,
        note: existing ? existing.note : '',
        tags: existing && Array.isArray(existing.tags) ? existing.tags : []
      });
      skipMsg.hidden = true;
      if (!saved) {
        // Paso 23: si el móvil no deja guardar (sin espacio, por ejemplo),
        // se dice claramente en vez de mostrar "Guardado".
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
        logConfirm.textContent = 'No se ha podido guardar. Inténtalo otra vez.';
        logConfirm.hidden = false;
        return;
      }
      if (welcomeBack) welcomeBack.hidden = true;
      logConfirm.textContent = 'Guardado.';
      logConfirm.hidden = false;
      extraSection.hidden = false;
      diaSection.hidden = false;
      diaFrase.textContent = GUIDE_CONTENT.miDiaFrases[level];
      refreshHomeAfterLog();
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

// Paso 23: lista de las cosas añadidas a mano en un grupo, cada una con su
// botón "Quitar" (por ejemplo, para corregir una errata). Se muestra dentro
// del campo "+ Añadir la mía", solo cuando está abierto. btnClass distingue
// el botón de Mi día del del Ejercicio 1 (cada pantalla conecta el suyo).
function misCosasQuitarHtml(group, propias, btnClass) {
  if (!propias || !propias.length) return '';
  var html = '<p class="exercise-label mis-cosas-titulo">Las que añadiste tú</p>';
  html += '<ul class="mis-cosas-list">';
  propias.forEach(function (item) {
    html += '<li><span>' + escapeHtml(item) + '</span>';
    html += '<button type="button" class="btn btn-secondary ' + btnClass + '" data-group="' + group +
      '" data-item="' + escapeHtml(item) + '" aria-label="Quitar ' + escapeHtml(item) + '">Quitar</button></li>';
  });
  html += '</ul>';
  return html;
}

// Quita una cosa añadida a mano de todos los sitios donde aparece: la
// lista propia, lo elegido hoy en Mi día y lo marcado en el Ejercicio 1.
// Los días anteriores no se tocan (lo que se hizo, hecho está).
function quitarMiCosaDeTodo(group, label) {
  removeMiCosa(group, label);
  var today = todayDateString();
  var chosen = getMiDiaForDate(today).chosen.filter(function (c) { return c !== label; });
  setMiDiaChosen(today, chosen);
  var e1 = getExerciseAnswers('ex-3-1');
  if (e1 && Array.isArray(e1[group])) {
    e1[group] = e1[group].filter(function (c) { return c !== label; });
    saveExerciseAnswers('ex-3-1', e1);
  }
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
  html += misCosasQuitarHtml(group, misCosas[group], 'ejercicio-e1-quitar');
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

  container.querySelectorAll('.ejercicio-e1-quitar').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      quitarMiCosaDeTodo(group, btn.getAttribute('data-item'));
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
// Paso 23: una opción del ritual cambió de texto ("sentado/a" -> forma
// neutra). Quien ya la tuviera elegida la conserva: al leer lo guardado se
// traduce el texto antiguo al nuevo (y queda guardado así en el siguiente
// toque).
var EJERCICIO_E2_RENOMBRADOS = {
  'Café tranquilo, sentado/a, 5 min antes del móvil': 'Café tranquilo, 5 min sin prisa antes del móvil'
};

function ejercicioE2Guardado() {
  var saved = getExerciseAnswers('ex-5-1') || { momento: '', pasos: [] };
  var pasos = Array.isArray(saved.pasos) ? saved.pasos.map(function (p) {
    return EJERCICIO_E2_RENOMBRADOS[p] || p;
  }) : [];
  return { momento: saved.momento || '', pasos: pasos };
}

function ejercicioE2Html() {
  var cfg = GUIDE_CONTENT.ejercicioE2;
  var saved = ejercicioE2Guardado();
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
      var saved = ejercicioE2Guardado();
      document.querySelectorAll('.ejercicio-e2-momento-btn').forEach(function (b) { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      save(btn.getAttribute('data-momento'), saved.pasos || []);
    });
  });
  document.querySelectorAll('.ejercicio-e2-paso-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var saved = ejercicioE2Guardado();
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
    html += '<button type="button" class="btn btn-secondary ejercicio-e3-si" data-index="' + i + '" aria-pressed="false">Sí</button>';
    html += '<button type="button" class="btn btn-secondary ejercicio-e3-no" data-index="' + i + '" aria-pressed="false">No</button>';
    html += '</div>';
  });
  html += '<div id="ejercicio-e3-resultado" aria-live="polite" hidden>';
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
    // Paso 23: el estado también se dice a los lectores de pantalla.
    siBtn.setAttribute('aria-pressed', valor === true ? 'true' : 'false');
    noBtn.setAttribute('aria-pressed', valor === false ? 'true' : 'false');
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
      var row = cleanTemplateRow(item);
      if (row !== null) { html += '<li>' + escapeHtml(row) + '</li>'; }
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
  html += misCosasQuitarHtml(groupKey, misCosas[groupKey], 'mi-dia-quitar');
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

  container.querySelectorAll('.mi-dia-quitar').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      quitarMiCosaDeTodo(group, btn.getAttribute('data-item'));
      refreshMiDiaGroupBody(group, true);
      refreshCerrarElDia();
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
    // Paso 23: el texto ya empieza por "Objetivo de la semana:" y la
    // etiqueta de arriba dice lo mismo -- se quita del texto al mostrarlo.
    var objetivo = String(week.objective).replace(/^Objetivo de la semana:\s*/, '');
    objetivo = objetivo.charAt(0).toUpperCase() + objetivo.slice(1);
    html += '<div class="callout"><p class="eyebrow">Objetivo de la semana</p><p>' + escapeHtml(objetivo) + '</p></div>';
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
  if (level === 'alta') return 'Alta';
  if (level === 'media') return 'Media';
  if (level === 'baja') return 'Baja';
  return level;
}

// Paso 24: indicador de nivel dibujado con CSS (sin emojis): un circulo
// por nivel que recuerda al semaforo de la guia, en tonos suaves de la
// paleta y con relleno distinto -- lleno (alta), medio (media), vacio
// (baja) -- para que el nivel no dependa solo del color. Es decorativo
// (aria-hidden): la etiqueta de texto va siempre al lado, y un lector de
// pantalla lee solo la palabra ("Alta").
function levelLabelHtml(level) {
  var known = level === 'alta' || level === 'media' || level === 'baja';
  var html = known ? '<span class="level-indicator level-indicator-' + level + '" aria-hidden="true"></span>' : '';
  html += '<span class="level-text">' + escapeHtml(levelLabel(level)) + '</span>';
  return html;
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
      '" data-level="' + level + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' + levelLabelHtml(level) + '</button>';
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
        levelLabelHtml(entry.level) + '</span> ' +
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
  // Paso 20: antes decia "Tu mejor día", pero solo es el ultimo dia en
  // alta -- se dice tal cual, sin comparar unos dias con otros.
  if (bestDay) {
    lines.push('Tu último día con energía alta fue el ' + formatShortDate(bestDay.date) + '.');
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
    // Paso 20: "últimos 7 días" (es lo que se cuenta, no la semana de
    // calendario) y singular cuando toca ("1 día alto", no "1 días altos").
    lines.push('En los últimos 7 días: ' +
      weekCounts.alta + (weekCounts.alta === 1 ? ' día alto, ' : ' días altos, ') +
      weekCounts.media + (weekCounts.media === 1 ? ' medio y ' : ' medios y ') +
      weekCounts.baja + (weekCounts.baja === 1 ? ' bajo.' : ' bajos.'));
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
          tagLine = 'Parece que los días con la etiqueta "' + tag + '" tu energía fue más baja.';
        } else if (avgWith > avgWithout) {
          tagLine = 'Parece que los días con la etiqueta "' + tag + '" tu energía fue más alta.';
        }
        if (tagLine) break;
      }
    }
    // Paso 20: antes decia siempre "Todavía son pocos días...", tambien
    // con muchos dias registrados. Lo que falta no son dias sino
    // etiquetas, asi que se dice eso (o que aun no se ve nada claro).
    var hayEtiquetas = entries.some(function (e) {
      return Array.isArray(e.tags) && e.tags.length > 0;
    });
    lines.push(tagLine || (hayEtiquetas ?
      'Con tus etiquetas todavía no se ve nada claro. No pasa nada.' :
      'Si quieres, toca un día del historial y añade una etiqueta. Con el tiempo verás si algo se repite.'));
  }

  return lines;
}

var LOG_WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Paso 23: días de los últimos 30 (de ayer hacia atrás) que no tienen
// registro, para "Añadir un día que se te pasó". Nunca incluye hoy (eso se
// hace en Inicio) ni fechas futuras, ni días que ya tienen registro (esos
// se editan tocándolos en el historial).
function evolutionMissingDays(entries) {
  var have = {};
  entries.forEach(function (e) { have[e.date] = true; });
  var parts = todayDateString().split('-').map(Number);
  var days = [];
  for (var i = 1; i <= 30; i++) {
    var d = new Date(parts[0], parts[1] - 1, parts[2] - i);
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!have[iso]) {
      days.push({
        date: iso,
        label: (i === 1 ? 'Ayer, ' : '') + LOG_WEEKDAY_NAMES[d.getDay()] + ' ' + formatDisplayDate(iso)
      });
    }
  }
  return days;
}

// Desplegable "Añadir un día que se te pasó" de Evolución (paso 23): un
// selector con los días sin registro y los tres niveles. Se usa una lista
// de días en vez de un calendario nativo porque así no se puede elegir una
// fecha futura ni repetir un día, y porque los campos de fecha/hora nativos
// ya dieron problemas de ancho en el iPhone instalado (ver paso 17e).
function evolutionAddDayHtml(entries) {
  var days = evolutionMissingDays(entries);
  if (!days.length) return '';
  var html = '<details class="inline-details evolution-add-day" id="evolution-add-day">';
  html += '<summary>Añadir un día que se te pasó</summary>';
  html += '<label for="evolution-add-date" class="exercise-label">¿Qué día?</label>';
  html += '<select id="evolution-add-date" class="recordatorio-hora-select evolution-add-select">';
  days.forEach(function (day) {
    var label = day.label.charAt(0).toUpperCase() + day.label.slice(1);
    html += '<option value="' + day.date + '">' + escapeHtml(label) + '</option>';
  });
  html += '</select>';
  html += '<p class="exercise-label">¿Cómo estuvo tu energía?</p>';
  html += '<div class="level-buttons evolution-add-levels">';
  ['alta', 'media', 'baja'].forEach(function (level) {
    html += '<button type="button" class="level-btn" data-level="' + level + '" aria-pressed="false">' + levelLabelHtml(level) + '</button>';
  });
  html += '</div>';
  html += '<button type="button" class="btn" id="evolution-add-save">Guardar día</button>';
  html += '<p id="evolution-add-msg" class="confirmation" aria-live="polite" hidden></p>';
  html += '</details>';
  html += '<p id="evolution-add-confirm" class="confirmation" aria-live="polite" hidden>Día añadido.</p>';
  return html;
}

function wireEvolutionAddDay() {
  var saveBtn = document.getElementById('evolution-add-save');
  if (!saveBtn) return;
  var levels = document.querySelectorAll('.evolution-add-levels .level-btn');
  var msg = document.getElementById('evolution-add-msg');
  levels.forEach(function (b) {
    b.addEventListener('click', function () {
      levels.forEach(function (x) { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('selected');
      b.setAttribute('aria-pressed', 'true');
      msg.hidden = true;
    });
  });
  saveBtn.addEventListener('click', function () {
    var selected = document.querySelector('.evolution-add-levels .level-btn.selected');
    var date = document.getElementById('evolution-add-date').value;
    if (!selected) {
      msg.textContent = 'Toca un nivel para guardar ese día.';
      msg.hidden = false;
      return;
    }
    // Por si la app se quedó abierta y la fecha elegida ya no es pasada.
    var ok = date < todayDateString() &&
      saveEntry({ date: date, level: selected.getAttribute('data-level'), note: '', tags: [] });
    if (!ok) {
      msg.textContent = 'No se ha podido guardar. Inténtalo otra vez.';
      msg.hidden = false;
      return;
    }
    renderEvolution(null);
    var confirm = document.getElementById('evolution-add-confirm');
    if (confirm) { confirm.hidden = false; }
  });
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

  var html = '<p class="eyebrow">Últimos registros</p><h1>Evolución</h1>';

  if (allEntries.length < 2) {
    // Mismo mensaje que Inicio para 0 o 1 registros (step-16, E2): antes
    // decia algo distinto aqui ("Necesitas al menos 2 registros...").
    html += '<p>' + escapeHtml(apunta3DiasMensaje(allEntries.length)) + '</p>';
    html += evolutionAddDayHtml(allEntries);
    document.getElementById('app-content').innerHTML = html;
    wireEvolutionAddDay();
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
  html += evolutionAddDayHtml(allEntries);
  html += '<ul class="log-list">';
  allEntries.forEach(function (entry) {
    var isEditing = editingDate === entry.date;
    html += '<li>';
    html += '<button type="button" class="evolution-entry-btn" data-date="' + escapeHtml(entry.date) +
      '" aria-expanded="' + (isEditing ? 'true' : 'false') + '">' +
      '<span class="badge ' + levelBadgeClass(entry.level) + '">' + levelLabelHtml(entry.level) + '</span> ' +
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
          '" data-level="' + level + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' + levelLabelHtml(level) + '</button>';
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

  wireEvolutionAddDay();

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
  html += '<p>Esto elimina para siempre todos tus registros de energía guardados en este móvil. No se puede deshacer. Si tienes el aviso diario activado, también se desactiva.</p>';
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

  // Paso 25: opinión voluntaria (se abre fuera de la app), quién hay
  // detrás y la versión, para saber cuál tiene cada persona.
  html += '<h2>Tu opinión</h2>';
  html += '<p>La app está en pruebas. Si te apetece, cuéntame qué te sirve y qué no. Es anónimo.</p>';
  html += externalLinkHtml(FEEDBACK_URL, 'Cuéntame qué tal', 'btn btn-outline');
  html += '<p class="chapter-end-msg"><a href="#/quien">Quién hay detrás</a></p>';
  html += '<p class="app-version">Versión ' + escapeHtml(APP_VERSION) + '</p>';

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
        }).catch(function (err) {
          // Paso 21: si la persona cerró el menú de compartir (AbortError)
          // no es un fallo -- no se muestra nada. Solo ante un error real
          // se ofrece la alternativa de copiar el texto.
          if (err && err.name === 'AbortError') { return; }
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
      // Paso 21: se libera un poco después, no al instante -- Safari puede
      // no haber empezado todavía la descarga y se quedaba sin archivo.
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      exportConfirm.textContent = 'Listo: ' + filename + '. Búscalo en tus descargas.';
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

    // Paso 23: un solo sitio para el mensaje de "este archivo no sirve",
    // también si el archivo no se puede leer o es demasiado grande para
    // ser una copia de esta app (una copia de años ocupa menos de 1 MB).
    function showImportError(texto) {
      var errorText = document.createElement('p');
      errorText.textContent = texto;
      importError.appendChild(errorText);
      importError.hidden = false;
      fileInput.value = '';
    }

    if (file.size > 5 * 1024 * 1024) {
      showImportError('Este archivo es demasiado grande para ser una copia de Mi Energía. No se ha importado nada. Tus datos siguen como estaban.');
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () {
      showImportError('No se ha podido leer el archivo. No se ha importado nada. Tus datos siguen como estaban.');
    };
    reader.onload = function () {
      var parsedData = parseBackupJSON(String(reader.result));
      if (!parsedData) {
        showImportError('Este archivo no es una copia de seguridad de Mi Energía, o está dañado. No se ha importado nada. Tus datos siguen como estaban.');
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
    var confirmBtn = document.getElementById('delete-confirm-btn');
    var avisoActivo = getRecordatorioPrefs().activo && AVISO_ONESIGNAL_CONECTADO;

    function terminar(mensaje) {
      renderMyData();
      var successEl = document.getElementById('delete-success');
      if (successEl) {
        successEl.textContent = mensaje;
        successEl.hidden = false;
      }
    }

    deleteAllData();
    if (!avisoActivo) {
      terminar('Tus datos se han borrado.');
      return;
    }
    // Paso 21: si el aviso diario estaba activo, borrar los datos también
    // lo da de baja en el servicio (antes seguía llegando el aviso). Solo
    // se carga el SDK en este caso, es decir, para quien ya lo activó.
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Borrando…';
    darDeBajaAvisoRemoto().then(function () {
      saveRecordatorioPrefs([], false);
      terminar('Tus datos se han borrado y el aviso diario está desactivado.');
    }, function () {
      // Sin conexión no se puede dar de baja: el aviso se deja como activo
      // aquí para poder desactivarlo luego desde Recordatorios.
      terminar('Tus datos se han borrado. El aviso diario no se pudo desactivar ahora: hazlo en Recordatorios cuando tengas conexión.');
    });
  });
}

// Paso 21: baja completa del aviso diario en el servicio (quita las
// etiquetas de franja y da de baja la suscripción), con tiempo máximo.
// La usa "Borrar todos mis datos". Las etiquetas son las mismas que
// gestiona wireAvisoDiario(); aquí solo se quitan.
function darDeBajaAvisoRemoto() {
  return conTiempoLimite(inicializarOneSignal().then(function (OneSignal) {
    RECORDATORIO_FRANJAS.forEach(function (f) {
      OneSignal.User.removeTag('aviso_' + f);
    });
    OneSignal.User.removeTag('franja');
    return OneSignal.User.PushSubscription.optOut();
  }), 12000);
}

// Paso 18: desplegable cerrado por defecto con las 5 capturas de un
// sistema (iPhone o Android), en orden, dentro de las instrucciones
// escritas de #/instalar. Las imágenes viven en img/instalar/ y NO están
// en PRECACHE_URLS del service worker -- se descargan y se cachean solo
// si la persona abre este desplegable (ver service-worker.js, estrategia
// cache-first normal para lo que no está precacheado).
function instalarCapturasHtml(prefix, altos) {
  var html = '<details class="inline-details instalar-capturas-details">';
  html += '<summary>Ver con imágenes</summary>';
  html += '<div class="instalar-capturas">';
  altos.forEach(function (alt, i) {
    var paso = i + 1;
    html += '<figure class="instalar-captura">';
    html += '<img src="img/instalar/' + prefix + '-' + paso + '.jpg" alt="' + escapeHtml(alt) + '" loading="lazy">';
    html += '<figcaption>Paso ' + paso + '</figcaption>';
    html += '</figure>';
  });
  html += '</div>';
  html += '</details>';
  return html;
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
  html += instalarCapturasHtml('iphone', [
    'Pantalla de la app abierta en Safari, con el icono Compartir señalado en la barra de abajo.',
    'Menú Compartir de Safari desplegado, con la opción "Compartir" arriba.',
    'Menú de Safari con la opción "Añadir a pantalla de inicio" rodeada.',
    'Cuadro "Añadir a pantalla de inicio" con el nombre de la app y el botón "Añadir" señalado.',
    'Icono de Mi Energía ya instalado en la pantalla de inicio del iPhone.'
  ]);
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
  html += instalarCapturasHtml('android', [
    'Pantalla de la app abierta en Chrome, con el menú de tres puntos señalado arriba a la derecha.',
    'Menú de Chrome desplegado, con la opción "Instalar y crear acceso directo" rodeada.',
    'Cuadro "Instalar y crear acceso directo" con la opción "Instalar" señalada.',
    'Cuadro de confirmación "Instalar aplicación" con el botón "Instalar" señalado.',
    'Icono de Mi Energía ya instalado en la pantalla de inicio del móvil Android.'
  ]);
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
// Paso 21: OneSignal.init() solo se puede llamar UNA vez por sesión. Antes
// se llamaba en cada acción (activar, cambiar franja, desactivar), y la
// segunda llamada podía no resolverse nunca: por ejemplo, cambiar una
// franja y luego pulsar "Desactivar aviso" dejaba el botón bloqueado. Ahora
// se guarda la promesa de la primera inicialización y se reutiliza. Si
// falla (sin conexión), se olvida para poder reintentar.
var oneSignalListoPromesa = null;

function inicializarOneSignal() {
  if (oneSignalListoPromesa) {
    return oneSignalListoPromesa;
  }
  oneSignalListoPromesa = cargarOneSignalSDK().then(function () {
    return new Promise(function (resolve, reject) {
      window.OneSignalDeferred.push(function (OneSignal) {
        OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: ONESIGNAL_SW_PATH,
          serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE }
        }).then(function () {
          resolve(OneSignal);
        }, reject);
      });
    });
  });
  oneSignalListoPromesa.catch(function () {
    oneSignalListoPromesa = null;
  });
  return oneSignalListoPromesa;
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
  // franja (f.id) no cambian, solo cómo se muestran. Paso 17k: de radio
  // (una sola franja) a casilla (varias a la vez). Paso 19: la hora de
  // cada franja es fija (RECORDATORIO_FRANJAS_HORAS) -- ya no es un
  // rango ("a partir de las...") sino la hora exacta a la que llega el
  // aviso, igual para todo el mundo en su propia zona horaria.
  var franjas = [
    { id: 'manana', principal: 'Mañana', hora: RECORDATORIO_FRANJAS_HORAS.manana },
    { id: 'tarde', principal: 'Tarde', hora: RECORDATORIO_FRANJAS_HORAS.tarde },
    { id: 'noche', principal: 'Noche', hora: RECORDATORIO_FRANJAS_HORAS.noche }
  ];

  var html = '<h2>Aviso diario (opcional)</h2>';
  html += '<p>Un aviso para que no se te olvide registrar tu energía. Puedes desactivarlo cuando quieras.</p>';

  // Paso 23: pantalla más corta. Lo esencial se queda a la vista en una
  // frase; el detalle completo (el mismo texto de antes, sin cambios) va
  // en un desplegable justo debajo.
  html += '<p><strong>Si lo activas, de tu móvil solo sale lo mínimo para enviarte el aviso. Nunca tus ' +
    'registros ni tus notas.</strong></p>';
  html += '<details class="inline-details">';
  html += '<summary>Ver qué sale exactamente</summary>';
  html += '<p><strong>Qué sale de tu móvil si lo activas:</strong> solo lo mínimo que ' +
    'necesita el servicio que envía el aviso (sistema operativo, idioma, zona horaria, país aproximado, modelo ' +
    'de tu dispositivo y las franjas que elijas abajo). <strong>Nunca se envían tus registros de energía, tus ' +
    'notas ni nada de lo que guardas en esta app.</strong> Puedes leer el detalle completo en ' +
    '<a href="#/privacidad">Privacidad</a>.</p>';
  html += '</details>';

  html += '<fieldset class="aviso-franjas-fieldset">';
  html += '<legend class="exercise-label">¿Cuándo quieres tu aviso diario? Puedes elegir más de uno.</legend>';
  html += '<ul class="aviso-franjas">';
  franjas.forEach(function (f) {
    var checked = prefs.franjas.indexOf(f.id) !== -1 ? ' checked' : '';
    html += '<li class="aviso-franja-row">';
    html += '<input type="checkbox" id="aviso-franja-' + f.id + '" name="aviso-franja" value="' + f.id + '"' + checked + '>';
    html += '<label for="aviso-franja-' + f.id + '" class="aviso-franja-label">';
    html += '<span class="aviso-franja-principal">' + escapeHtml(f.principal) + '</span>';
    html += '<span class="aviso-franja-hora">' + escapeHtml(f.hora) + '</span>';
    html += '</label>';
    html += '</li>';
  });
  html += '</ul>';
  html += '</fieldset>';
  // Paso 19: aclara que la hora de cada franja es fija (no se elige),
  // y que llega según la zona horaria del propio móvil.
  html += '<p class="eyebrow">Recibirás el aviso a esa hora, en tu zona horaria.</p>';

  // Paso 17f: mensaje breve y tranquilo para confirmar que, al cambiar de
  // franjas con el aviso ya activado, se actualizó también en el servicio
  // (no solo aquí en el móvil). Paso 17k: el mismo sitio sirve también
  // para el mensaje sereno de "elige al menos una franja" / "aviso
  // desactivado al desmarcar todas". Vacío por defecto; wireAvisoDiario()
  // le pone texto solo cuando hace falta.
  html += '<p class="eyebrow" id="aviso-franja-confirmacion" aria-live="polite"></p>';

  if (prefs.activo) {
    html += '<p class="aviso-estado">Aviso activado · ' + escapeHtml(franjasConHoraLabel(prefs.franjas)) + '.</p>';
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
function actualizarAvisoZona(mensaje) {
  var zona = document.getElementById('aviso-diario-zona');
  if (!zona) { return; }
  var prefs = getRecordatorioPrefs();
  zona.innerHTML = avisoDiarioHtml(prefs);
  wireAvisoDiario();
  // Paso 17k: un mensaje sereno opcional que sobrevive al repintado de
  // arriba (por ejemplo, al desactivarse solo el aviso porque se
  // desmarcaron todas las franjas).
  if (mensaje) {
    var confirmacionEl = document.getElementById('aviso-franja-confirmacion');
    if (confirmacionEl) { confirmacionEl.textContent = mensaje; }
  }
}

// Conecta los controles del "Aviso diario" (paso 17a; paso 17k: varias
// franjas a la vez con casillas, no una sola con radio) y el botón
// activar/desactivar. Todo lo que hace es leer/guardar la preferencia
// local vía storage.js y actualizar su propia zona de la pantalla -- no
// toca la red salvo al activar/desactivar/cambiar franjas de verdad.
function wireAvisoDiario() {
  var activarBtn = document.getElementById('aviso-activar-btn');
  var desactivarBtn = document.getElementById('aviso-desactivar-btn');

  // Franjas actualmente marcadas en las casillas, en el orden fijo
  // manana/tarde/noche (el mismo en que se dibujan).
  function franjasElegidas() {
    var marcadas = [];
    document.querySelectorAll('input[name="aviso-franja"]:checked').forEach(function (checkbox) {
      marcadas.push(checkbox.value);
    });
    return marcadas;
  }

  // Paso 17k: sincroniza las etiquetas de OneSignal con las franjas
  // marcadas ahora mismo -- una etiqueta por franja ("aviso_manana",
  // "aviso_tarde", "aviso_noche"), y de paso quita la etiqueta antigua de
  // una sola franja ("franja") que ya no se usa.
  function sincronizarEtiquetasFranjas(OneSignal, franjasActivas) {
    RECORDATORIO_FRANJAS.forEach(function (f) {
      if (franjasActivas.indexOf(f) !== -1) {
        OneSignal.User.addTag('aviso_' + f, '1');
      } else {
        OneSignal.User.removeTag('aviso_' + f);
      }
    });
    OneSignal.User.removeTag('franja');
  }

  document.querySelectorAll('input[name="aviso-franja"]').forEach(function (checkbox) {
    checkbox.addEventListener('change', function () {
      var prefs = getRecordatorioPrefs();
      var nuevasFranjas = franjasElegidas();

      // Paso 17k: si el aviso ya estaba activo y se desmarcó la última
      // franja, no tiene sentido dejarlo "activo" sin ninguna -- se
      // desactiva solo, con un mensaje sereno (sin alerta ni bloqueo).
      if (prefs.activo && nuevasFranjas.length === 0) {
        if (!AVISO_ONESIGNAL_CONECTADO) {
          saveRecordatorioPrefs([], false);
          actualizarAvisoZona('Aviso desactivado: no quedó ninguna franja marcada. Marca una cuando quieras volver a activarlo.');
          return;
        }
        conTiempoLimite(
          inicializarOneSignal().then(function (OneSignal) {
            sincronizarEtiquetasFranjas(OneSignal, []);
            return OneSignal.User.PushSubscription.optOut();
          }),
          12000
        ).catch(function () {
          // Si falla la baja remota (por ejemplo sin conexión), igualmente
          // queda desactivado aquí -- lo importante es que no se muestre
          // como "activo" sin ninguna franja marcada.
        }).then(function () {
          saveRecordatorioPrefs([], false);
          actualizarAvisoZona('Aviso desactivado: no quedó ninguna franja marcada. Marca una cuando quieras volver a activarlo.');
        });
        return;
      }

      saveRecordatorioPrefs(nuevasFranjas, prefs.activo);

      // Paso 17f/17k: si el aviso ya está activado, cambiar las franjas
      // también debe avisar al servicio (si no, seguiría llegando el
      // aviso a las franjas anteriores). Repintamos ya la zona (la línea
      // "Aviso activado · ..." debe reflejar las franjas nuevas al
      // instante, no solo cuando se pulsa Activar/Desactivar) y un
      // mensaje breve y tranquilo confirma además que se actualizó en el
      // servicio -- o, si falla, que al menos quedó guardado aquí.
      if (prefs.activo && AVISO_ONESIGNAL_CONECTADO) {
        actualizarAvisoZona('Actualizando el aviso…');
        conTiempoLimite(
          inicializarOneSignal().then(function (OneSignal) {
            sincronizarEtiquetasFranjas(OneSignal, nuevasFranjas);
          }),
          12000
        ).then(function () {
          var elActualizado = document.getElementById('aviso-franja-confirmacion');
          if (elActualizado) { elActualizado.textContent = 'Aviso actualizado.'; }
        }).catch(function () {
          var elFallo = document.getElementById('aviso-franja-confirmacion');
          if (elFallo) {
            elFallo.textContent = 'Se guardó en este móvil; se actualizará en el aviso en cuanto haya conexión.';
          }
        });
      } else if (prefs.activo) {
        actualizarAvisoZona();
      }
    });
  });

  if (activarBtn) {
    activarBtn.addEventListener('click', function () {
      var franjas = franjasElegidas();
      var confirmacionEl = document.getElementById('aviso-franja-confirmacion');

      // Paso 17k: hace falta al menos una franja marcada para activar --
      // un mensaje sereno en vez de una alerta, sin tocar la red.
      if (franjas.length === 0) {
        if (confirmacionEl) {
          confirmacionEl.textContent = 'Elige al menos una franja (mañana, tarde o noche) para activar el aviso.';
        }
        return;
      }

      if (!AVISO_ONESIGNAL_CONECTADO) {
        saveRecordatorioPrefs(franjas, true);
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
          sincronizarEtiquetasFranjas(OneSignal, franjas);
          saveRecordatorioPrefs(franjas, true);
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
      var franjas = franjasElegidas();
      if (!AVISO_ONESIGNAL_CONECTADO) {
        saveRecordatorioPrefs(franjas, false);
        actualizarAvisoZona();
        return;
      }
      desactivarBtn.disabled = true;
      // Paso 21: con tiempo máximo, igual que al activar -- así el botón
      // nunca se queda bloqueado si el servicio no responde.
      conTiempoLimite(inicializarOneSignal().then(function (OneSignal) {
        sincronizarEtiquetasFranjas(OneSignal, []);
        return OneSignal.User.PushSubscription.optOut();
      }), 12000).catch(function () {
        // Si optOut() falla (por ejemplo sin conexión), seguimos
        // guardando la preferencia local como desactivada: lo importante
        // es que la persona deje de ver el aviso como "activo" en esta
        // app. Si vuelve a pulsar Desactivar más adelante con conexión,
        // se reintenta el optOut() remoto.
      }).then(function () {
        saveRecordatorioPrefs(franjas, false);
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
// vez junto a las opciones del aviso de arriba. Paso 23: se quitó el
// archivo de calendario (.ics), que era experimental, y el desplegable de
// la alarma queda siempre plegado para acortar la pantalla.
function recordatoriosHtml(morning, night, isIOS, prefs) {
  var html = '<h1>Recordatorios</h1>';

  // Paso 17g: esta zona se repinta sola (ver actualizarAvisoZona()) al
  // activar/desactivar el aviso, para no tocar los selectores de hora de
  // la alarma manual de más abajo.
  html += '<div id="aviso-diario-zona">' + avisoDiarioHtml(prefs) + '</div>';

  // Paso 17h: el cuadro, los selectores y los pasos de la alarma manual
  // van todos dentro de este desplegable -- no se repiten las horas del
  // aviso, que ya se ven arriba junto a cada franja.
  var alarmaManualHtml = '<p>Elige tus horas y sigue los pasos. La alarma se crea en la app Reloj de tu móvil.</p>';

  alarmaManualHtml += '<div class="recordatorio-field">';
  alarmaManualHtml += '<p class="exercise-label">Por la mañana: registrar mi energía y elegir mi día</p>';
  alarmaManualHtml += horaSelectsHtml('recordatorio-manana-hora', morning, 'Hora de la alarma de la mañana', 'Minutos de la alarma de la mañana');
  alarmaManualHtml += '</div>';
  alarmaManualHtml += '<div class="recordatorio-field">';
  alarmaManualHtml += '<p class="exercise-label">Por la noche: cerrar el día</p>';
  alarmaManualHtml += horaSelectsHtml('recordatorio-noche-hora', night, 'Hora de la alarma de la noche', 'Minutos de la alarma de la noche');
  alarmaManualHtml += '</div>';

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
  // Paso 23: siempre plegado (antes se abría solo si el aviso no estaba
  // activo, y la pantalla ocupaba casi cinco pantallas de alto).
  html += '<details class="platform-details" id="recordatorio-alarma-alt">';
  html += '<summary>Prefiero una alarma en mi Reloj</summary>';
  html += alarmaManualHtml;
  html += '</details>';

  html += '<p class="signature">@compartir.para.sanar</p>';
  return html;
}

// Conecta los selectores de hora (paso 17e: dos <select> -- hora y
// minutos -- en vez de un input type="time"). Actualizan al instante el
// texto de las instrucciones, guardan la elección (paso 17g, ver
// saveAlarmaManualHoras() en storage.js) para que no se pierda al
// repintar la pantalla.
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
}

function renderRecordatorios() {
  var isIOS = isIOSDevice();
  var prefs = getRecordatorioPrefs();
  var horas = getAlarmaManualHoras();
  var html = recordatoriosHtml(horas.morning, horas.night, isIOS, prefs);
  document.getElementById('app-content').innerHTML = html;
  wireRecordatorios();
  wireAvisoDiario();
}

// Paso 25: "Quién hay detrás". Texto de Ana, tal cual lo escribió.
function renderAbout() {
  var html = '<h1>Quién hay detrás</h1>';
  html += '<p><strong>Hola, soy Ana.</strong></p>';
  html += '<p>Soy la creadora de @compartir.para.sanar. Vivo con una enfermedad crónica y sé lo que es planificar el día según la energía que tienes, no la que te gustaría tener.</p>';
  html += '<p>Hice esta app para acompañar la guía «Menos Fatiga, Más Vida»: un sitio sencillo, sin cuentas ni presión, donde anotar cómo estás y ver tu propio ritmo con el tiempo.</p>';
  html += '<p>Está en pruebas y tu opinión me ayuda mucho.</p>';
  html += externalLinkHtml(FEEDBACK_URL, 'Cuéntame qué tal', 'btn');
  html += externalLinkHtml(GUIDE_URL, 'Conocer la guía', 'btn btn-outline');
  html += '<p class="signature">@compartir.para.sanar</p>';
  document.getElementById('app-content').innerHTML = html;
}

// Paso 25: texto definitivo de Privacidad, escrito por Ana (sustituye al
// borrador del paso 17). El responsable y el contacto son los mismos que
// ya figuraban. No cambies este texto sin que Ana lo pida.
function renderPrivacy() {
  var html = '<h1>Privacidad</h1>';
  html += '<p>Mi Energía es un complemento gratuito de la guía «Menos Fatiga, Más Vida». Te explico en pocas líneas qué pasa con tus datos.</p>';
  html += '<p><strong>Tus registros se quedan en tu móvil:</strong> lo que anotas (tu nivel de energía, notas, etiquetas, lo que haces cada día) se guarda solo en tu dispositivo. No tengo cuentas, no hay servidor propio y no puedo verlo ni recuperarlo. Si borras los datos del navegador o desinstalas la app, se pierden. Por eso puedes exportar una copia en <a href="#/mis-datos">«Mis datos»</a>.</p>';
  html += '<p><strong>No hay rastreo:</strong> no uso analítica, anuncios ni cookies de seguimiento. Las fuentes y el resto de archivos van incluidos en la app.</p>';
  html += '<p><strong>Aviso diario (opcional):</strong> solo si lo activas tú, usamos OneSignal para enviarte una notificación a la hora que corresponde a la franja que elijas (mañana 9:00, tarde 18:00 o noche 21:00, en tu zona horaria). Para eso OneSignal recibe un identificador de tu navegador o móvil y la franja elegida. No recibe tus registros de energía. También recibe datos técnicos de tu dispositivo: sistema operativo, modelo, idioma, zona horaria y país aproximado. Puedes desactivarlo cuando quieras en <a href="#/recordatorios">«Recordatorios»</a>, y si borras tus datos desde «Mis datos» también se da de baja.</p>';
  html += '<p><strong>Alojamiento:</strong> la app está alojada en GitHub Pages. Como en cualquier web, el servidor puede registrar tu dirección IP al cargarla.</p>';
  html += '<p><strong>Opinión voluntaria:</strong> el enlace «Cuéntame qué tal» abre un formulario de Google fuera de la app. Es voluntario y anónimo; no te pido nombre ni correo.</p>';
  html += '<p><strong>Esto no es un servicio médico:</strong> la app no diagnostica ni trata ninguna enfermedad ni sustituye a tu equipo médico.</p>';
  html += '<p><strong>Tus derechos y contacto:</strong> para cualquier duda sobre tus datos o para pedir que se elimine tu suscripción al aviso: compartir.para.sanar@outlook.com.</p>';
  html += '<p><strong>Responsable:</strong> Ana España.</p>';
  html += '<p class="signature">@compartir.para.sanar</p>';
  document.getElementById('app-content').innerHTML = html;
}
