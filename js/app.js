// js/app.js
// Inicializacion, router hash-based, registro del service worker.
// Este archivo solo invoca las funciones de vista definidas en views.js;
// no modifica el DOM directamente.

// Prompt nativo de instalar (step-15): Chrome/Android (y algunos de
// escritorio) disparan "beforeinstallprompt" cuando la app es instalable.
// Se guarda aqui, en window, para que renderInstall() en views.js pueda
// usarlo sin que este archivo toque el DOM. Nunca se dispara en
// Safari/iOS: ahi solo existen los pasos escritos de #/instalar.
window.deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  if (location.hash.replace(/^#/, '') === '/instalar') {
    renderInstall();
  }
});

window.addEventListener('appinstalled', function () {
  window.deferredInstallPrompt = null;
});

function router() {
  var hash = location.hash.replace(/^#/, '');
  var guiaChapterMatch = hash.match(/^\/guia\/(\d+)$/);

  if (hash === '' || hash === '/') {
    renderHome();
  } else if (guiaChapterMatch) {
    renderChapter(Number(guiaChapterMatch[1]));
  } else {
    switch (hash) {
      case '/guia':
        renderGuideIndex();
        break;
      case '/guia/toolkit':
        renderToolkit();
        break;
      case '/guia/plan-21':
        renderActionPlan();
        break;
      case '/registro':
        renderLog();
        break;
      case '/pasos':
        renderMiDia();
        break;
      case '/herramientas':
        renderEjercicios();
        break;
      case '/evolucion':
        renderEvolution();
        break;
      case '/mis-datos':
        renderMyData();
        break;
      case '/instalar':
        renderInstall();
        break;
      case '/recordatorios':
        renderRecordatorios();
        break;
      case '/privacidad':
        renderPrivacy();
        break;
      default:
        renderHome();
    }
  }

  // Resalta la pestana activa del menu inferior fijo; vive en views.js
  // porque es manipulacion de DOM, pero no decide que vista renderizar.
  setActiveNavTab(hash);

  // Paso 20: titulo de la pestaña segun la pantalla, y fecha en la que se
  // pinto (para detectar el cambio de dia, ver mas abajo). Ambas cosas
  // viven en views.js; aqui solo se invocan.
  updateDocumentTitle(hash);
  markRenderDate();
}

// Paso 20: al cambiar de pantalla, la nueva empieza arriba y el foco pasa
// al contenido (antes "Siguiente" abria el capitulo ya bajado hasta el
// final, y un lector de pantalla no se enteraba del cambio). Solo en
// navegacion real, no en la primera carga.
window.addEventListener('hashchange', function () {
  router();
  focusContentAfterNavigation();
});
window.addEventListener('DOMContentLoaded', function () {
  router();
  wireSkipLink();
});

// Paso 20: en el movil la app instalada se "despierta" sin recargar. Si
// mientras tanto cambio el dia, se repinta la pantalla actual para que
// "hoy" sea de verdad hoy (antes Inicio seguia mostrando el nivel de ayer
// como si fuera el de hoy, y Mi dia guardaba en la fecha de ayer).
function repaintIfDayChanged() {
  if (document.visibilityState === 'visible' && hasDayChangedSinceRender()) {
    router();
  }
}
document.addEventListener('visibilitychange', repaintIfDayChanged);
window.addEventListener('pageshow', repaintIfDayChanged);
window.addEventListener('focus', repaintIfDayChanged);

if ('serviceWorker' in navigator) {
  // Paso 21: si al cargar ya habia un service worker al mando y luego
  // cambia, es que ha llegado una version nueva (en la primera instalacion
  // no habia ninguno, y ahi no se avisa). Los archivos nuevos solo se usan
  // al recargar, asi que se ofrece un aviso discreto -- nunca se recarga
  // sola, para no perder una nota a medio escribir.
  var hadControllerAtLoad = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (hadControllerAtLoad) {
      showUpdateBanner();
    }
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js').catch(function () {
      // Sin service worker la app sigue funcionando online con normalidad;
      // solo se pierde el cacheo para uso sin conexion.
    });
  });

  // Paso 21: la app instalada en el movil casi nunca se recarga, asi que
  // no llegaba a enterarse de que habia version nueva. Ahora lo comprueba
  // cada vez que vuelve a primer plano.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') { return; }
    navigator.serviceWorker.getRegistration().then(function (registration) {
      if (registration) { return registration.update(); }
    }).catch(function () {
      // Sin conexion no hay nada que comprobar; se reintenta la proxima vez.
    });
  });
}
