// push/onesignal/OneSignalSDKWorker.js
// Paso 17b/17c. Service worker DEDICADO de OneSignal: vive fuera del
// alcance de ./service-worker.js (que controla /mi-energia/ entero con su
// propia estrategia cache-first), para no interferir con él. No cachea
// nada de esta app ni contiene lógica propia -- solo reexporta el archivo
// unificado del SDK de OneSignal (paso 17c: corregido -- v16 usa
// OneSignalSDK.sw.js, no OneSignalSDKWorker.js, como importScripts).
//
// Este archivo solo se registra cuando la persona pulsa "Activar aviso"
// en Recordatorios (ver inicializarOneSignal() en js/views.js). Si nunca
// lo activa, el navegador nunca descarga ni registra este archivo.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
