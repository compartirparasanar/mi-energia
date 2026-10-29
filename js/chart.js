// js/chart.js
// Dibuja el grafico de evolucion de energia en un <canvas>. No accede a
// localStorage ni modifica el DOM fuera del propio elemento canvas recibido.
// Los 3 colores de nivel son la unica fuente de verdad para estos colores
// en todo el proyecto (coinciden con --color-success/warning/danger de
// css/styles.css, que a su vez vienen del diseno real de la guia).

var CHART_COLORS = {
  alta: '#7CB341',
  media: '#FFCC32',
  baja: '#F44236'
};

var CHART_LEVEL_ORDER = ['baja', 'media', 'alta'];
var CHART_LEVEL_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };

function chartShortDate(dateStr) {
  var parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + '/' + parts[1];
}

function chartLevelY(level, paddingTop, plotHeight) {
  var idx = CHART_LEVEL_ORDER.indexOf(level);
  if (idx < 0) idx = 0;
  var steps = CHART_LEVEL_ORDER.length - 1;
  return paddingTop + plotHeight - (idx / steps) * plotHeight;
}

function drawEvolutionChart(canvasElement, entries) {
  var ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  var cssWidth = canvasElement.clientWidth || 328;
  var cssHeight = canvasElement.clientHeight || 220;
  canvasElement.width = cssWidth * ratio;
  canvasElement.height = cssHeight * ratio;

  var ctx = canvasElement.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);

  var width = cssWidth;
  var height = cssHeight;
  var paddingLeft = 52;
  var paddingRight = 16;
  var paddingTop = 20;
  var paddingBottom = 32;
  var plotWidth = width - paddingLeft - paddingRight;
  var plotHeight = height - paddingTop - paddingBottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Lineas guia + etiquetas del eje Y (los 3 niveles)
  ctx.strokeStyle = 'rgba(68, 55, 40, 0.15)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#443728';
  ctx.font = '13px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  CHART_LEVEL_ORDER.forEach(function (level) {
    var y = chartLevelY(level, paddingTop, plotHeight);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, Math.round(y) + 0.5);
    ctx.lineTo(width - paddingRight, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillText(CHART_LEVEL_LABELS[level], paddingLeft - 10, y);
  });

  if (!entries || entries.length < 2) {
    return;
  }

  var n = entries.length;
  var stepX = n > 1 ? plotWidth / (n - 1) : 0;

  // Linea que conecta los puntos de un dia con el siguiente (terracota
  // oscuro, el color del diseno nuevo). Los puntos individuales se pintan
  // despues con el color del nivel, para no perder esa informacion.
  ctx.strokeStyle = 'rgba(169, 85, 58, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  entries.forEach(function (entry, i) {
    var x = paddingLeft + stepX * i;
    var y = chartLevelY(entry.level, paddingTop, plotHeight);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Puntos coloreados por nivel, con borde oscuro para que el amarillo
  // tambien se distinga bien sobre fondo blanco
  var labelEvery = Math.max(1, Math.ceil(n / 7));
  entries.forEach(function (entry, i) {
    var x = paddingLeft + stepX * i;
    var y = chartLevelY(entry.level, paddingTop, plotHeight);

    var isLast = i === n - 1;
    ctx.beginPath();
    ctx.arc(x, y, isLast ? 7.5 : 6, 0, Math.PI * 2);
    ctx.fillStyle = CHART_COLORS[entry.level] || '#443728';
    ctx.fill();
    ctx.strokeStyle = isLast ? '#A9553A' : '#6B4F3A';
    ctx.lineWidth = isLast ? 2.5 : 1.5;
    ctx.stroke();

    if (i === 0 || i === n - 1 || i % labelEvery === 0) {
      ctx.fillStyle = '#443728';
      ctx.font = '11px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(chartShortDate(entry.date), x, paddingTop + plotHeight + 8);
    }
  });
}
