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
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js').catch(function () {
      // Sin service worker la app sigue funcionando online con normalidad;
      // solo se pierde el cacheo para uso sin conexion.
    });
  });
}
