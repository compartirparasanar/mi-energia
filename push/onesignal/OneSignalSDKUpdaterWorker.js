// push/onesignal/OneSignalSDKUpdaterWorker.js
// Paso 17c. Archivo "Updater" que el panel de OneSignal exige nombrar por
// separado (campo "Updater filename" en Settings -> Push & In-App -> Web),
// aunque el SDK v16 ya usa un único archivo unificado del lado de
// OneSignal. Sin este archivo, el navegador recibiría un 404 al buscarlo.
// Misma única línea que OneSignalSDKWorker.js -- no cachea nada de esta
// app ni contiene lógica propia.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
