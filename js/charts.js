(function (global) {
  "use strict";

  const COLORS = {
    price: "#0F172A",
    priceAreaTop: "rgba(15, 23, 42, 0.10)",
    priceAreaBottom: "rgba(15, 23, 42, 0.00)",
    sma20: "#2563EB",
    sma50: "#D97706",
    rsi: "#0F766E",
    buyZone: "rgba(16, 185, 129, 0.10)",
    sellZone: "rgba(220, 38, 38, 0.09)",
    buyLine: "#059669",
    sellLine: "#DC2626",
    grid: "#E6EAF0",
    axisText: "#64748B",
    crosshair: "rgba(15, 23, 42, 0.28)",
  };

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width));
    const height = Math.max(120, Math.floor(rect.height));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function formatShortDate(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return `${Number(parts[2])}.${Number(parts[1])}.`;
  }

  function sliceSeries(series, windowDays) {
    const total = series.dates.length;
    if (!windowDays || windowDays <= 0 || windowDays >= total) {
      return {
        dates: series.dates,
        closes: series.closes,
        sma20: series.sma20,
        sma50: series.sma50,
        rsi: series.rsi,
      };
    }
    const start = Math.max(0, total - windowDays);
    return {
      dates: series.dates.slice(start),
      closes: series.closes.slice(start),
      sma20: series.sma20.slice(start),
      sma50: series.sma50.slice(start),
      rsi: series.rsi.slice(start),
    };
  }

  function drawLine(ctx, values, xAt, yAt, color, lineWidth = 2, dash = []) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash);

    let started = false;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) {
        started = false;
        continue;
      }
      const x = xAt(i);
      const y = yAt(v);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderPriceChart(canvas, sliced, currency, hoverIndex) {
    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const n = sliced.closes.length;
    if (n < 2) return null;

    const pad = { top: 14, right: 16, bottom: 28, left: 64 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const allVals = [];
    for (let i = 0; i < n; i++) {
      if (sliced.closes[i] != null) allVals.push(sliced.closes[i]);
      if (sliced.sma20[i] != null) allVals.push(sliced.sma20[i]);
      if (sliced.sma50[i] != null) allVals.push(sliced.sma50[i]);
    }
    let minV = Math.min(...allVals);
    let maxV = Math.max(...allVals);
    if (minV === maxV) {
      minV *= 0.98;
      maxV *= 1.02;
    }
    const margin = (maxV - minV) * 0.08;
    minV -= margin;
    maxV += margin;

    const xAt = (i) => pad.left + (i / (n - 1)) * plotW;
    const yAt = (v) => pad.top + ((maxV - v) / (maxV - minV)) * plotH;

    // Horizontální mřížka a popisky Y
    const ticks = 4;
    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let t = 0; t <= ticks; t++) {
      const ratio = t / ticks;
      const val = maxV - ratio * (maxV - minV);
      const y = pad.top + ratio * plotH;
      ctx.beginPath();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.axisText;
      const label = val >= 1000 ? val.toFixed(0) : val.toFixed(2);
      ctx.fillText(label, pad.left - 8, y);
    }

    // Popisky X (datumy)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xTickCount = Math.min(5, n);
    for (let t = 0; t < xTickCount; t++) {
      const idx = Math.round((t / (xTickCount - 1)) * (n - 1));
      ctx.fillStyle = COLORS.axisText;
      ctx.fillText(formatShortDate(sliced.dates[idx]), xAt(idx), height - pad.bottom + 8);
    }

    // Plocha pod cenovou křivkou
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, COLORS.priceAreaTop);
    grad.addColorStop(1, COLORS.priceAreaBottom);

    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(sliced.closes[0]));
    for (let i = 1; i < n; i++) {
      ctx.lineTo(xAt(i), yAt(sliced.closes[i]));
    }
    ctx.lineTo(xAt(n - 1), pad.top + plotH);
    ctx.lineTo(xAt(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Křivky SMA 50, SMA 20 a cena
    drawLine(ctx, sliced.sma50, xAt, yAt, COLORS.sma50, 1.75);
    drawLine(ctx, sliced.sma20, xAt, yAt, COLORS.sma20, 1.75);
    drawLine(ctx, sliced.closes, xAt, yAt, COLORS.price, 2.1);

    // Crosshair při najetí myší
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n) {
      const hx = xAt(hoverIndex);
      const hy = yAt(sliced.closes[hoverIndex]);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + plotH);
      ctx.stroke();
      ctx.restore();

      const drawDot = (val, color) => {
        if (val == null) return;
        ctx.beginPath();
        ctx.arc(hx, yAt(val), 4, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      };

      drawDot(sliced.sma50[hoverIndex], COLORS.sma50);
      drawDot(sliced.sma20[hoverIndex], COLORS.sma20);
      drawDot(sliced.closes[hoverIndex], COLORS.price);

      // Zvýrazněný bod ceny
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.price;
      ctx.fill();
    }

    return { pad, plotW, n };
  }

  function renderRsiChart(canvas, sliced, buyThreshold, sellThreshold, hoverIndex) {
    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const n = sliced.rsi.length;
    if (n < 2) return null;

    const pad = { top: 12, right: 16, bottom: 24, left: 64 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const xAt = (i) => pad.left + (i / (n - 1)) * plotW;
    const yAt = (v) => pad.top + ((100 - v) / 100) * plotH;

    // Pásma překoupenosti (> sellThreshold) a přeprodanosti (< buyThreshold)
    ctx.fillStyle = COLORS.sellZone;
    ctx.fillRect(pad.left, yAt(100), plotW, yAt(sellThreshold) - yAt(100));

    ctx.fillStyle = COLORS.buyZone;
    ctx.fillRect(pad.left, yAt(buyThreshold), plotW, yAt(0) - yAt(buyThreshold));

    // Horizontální úrovně 0, buyThreshold, 50, sellThreshold, 100
    const levels = [
      { val: 100, color: COLORS.grid, dash: [] },
      { val: sellThreshold, color: COLORS.sellLine, dash: [4, 4] },
      { val: 50, color: COLORS.grid, dash: [2, 3] },
      { val: buyThreshold, color: COLORS.buyLine, dash: [4, 4] },
      { val: 0, color: COLORS.grid, dash: [] },
    ];

    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (const lvl of levels) {
      const y = yAt(lvl.val);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = lvl.color;
      ctx.lineWidth = lvl.val === buyThreshold || lvl.val === sellThreshold ? 1.25 : 1;
      ctx.setLineDash(lvl.dash);
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle =
        lvl.val === sellThreshold
          ? COLORS.sellLine
          : lvl.val === buyThreshold
          ? COLORS.buyLine
          : COLORS.axisText;
      ctx.fillText(String(lvl.val), pad.left - 8, y);
    }

    // Popisky X
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xTickCount = Math.min(5, n);
    for (let t = 0; t < xTickCount; t++) {
      const idx = Math.round((t / (xTickCount - 1)) * (n - 1));
      ctx.fillStyle = COLORS.axisText;
      ctx.fillText(formatShortDate(sliced.dates[idx]), xAt(idx), height - pad.bottom + 6);
    }

    // Křivka RSI
    drawLine(ctx, sliced.rsi, xAt, yAt, COLORS.rsi, 2);

    // Crosshair
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n) {
      const hx = xAt(hoverIndex);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + plotH);
      ctx.stroke();
      ctx.restore();

      const val = sliced.rsi[hoverIndex];
      if (val != null) {
        const dotColor =
          val < buyThreshold
            ? COLORS.buyLine
            : val > sellThreshold
            ? COLORS.sellLine
            : COLORS.rsi;
        ctx.beginPath();
        ctx.arc(hx, yAt(val), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      }
    }

    return { pad, plotW, n };
  }

  /**
   * Připojí interaktivní vykreslování páru grafů (Cena+SMA a RSI) se synchronizovaným kurzorem.
   */
  function createChartController({ priceCanvas, rsiCanvas, tooltipEl }) {
    let currentAnalysis = null;
    let currentOptions = { windowDays: 63, buyThreshold: 30, sellThreshold: 70 };
    let sliced = null;
    let hoverIndex = null;
    let lastMeta = null;

    function updateTooltip(idx) {
      if (!tooltipEl || !currentAnalysis || !sliced || idx === null || idx < 0 || idx >= sliced.dates.length) {
        if (tooltipEl) tooltipEl.hidden = true;
        return;
      }
      const { formatPrice, formatNumber } = global.AkcieIndicators;
      const date = sliced.dates[idx];
      const close = sliced.closes[idx];
      const sma20 = sliced.sma20[idx];
      const sma50 = sliced.sma50[idx];
      const rsi = sliced.rsi[idx];

      tooltipEl.hidden = false;
      tooltipEl.innerHTML = `
        <span class="tooltip-date">${date}</span>
        <span>Cena: <strong>${formatPrice(close, currentAnalysis.currency)}</strong></span>
        <span>SMA 20: <strong class="c-sma20">${sma20 != null ? formatPrice(sma20, currentAnalysis.currency) : "—"}</strong></span>
        <span>SMA 50: <strong class="c-sma50">${sma50 != null ? formatPrice(sma50, currentAnalysis.currency) : "—"}</strong></span>
        <span>RSI(14): <strong class="c-rsi">${rsi != null ? formatNumber(rsi, 1) : "—"}</strong></span>
      `;
    }

    function draw() {
      if (!currentAnalysis || !currentAnalysis.hasData) return;
      sliced = sliceSeries(currentAnalysis.series, currentOptions.windowDays);
      lastMeta = renderPriceChart(
        priceCanvas,
        sliced,
        currentAnalysis.currency,
        hoverIndex
      );
      renderRsiChart(
        rsiCanvas,
        sliced,
        currentOptions.buyThreshold,
        currentOptions.sellThreshold,
        hoverIndex
      );
      updateTooltip(hoverIndex);
    }

    function indexFromPointer(canvas, clientX) {
      if (!lastMeta) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const rel = (x - lastMeta.pad.left) / lastMeta.plotW;
      const clamped = Math.max(0, Math.min(1, rel));
      return Math.round(clamped * (lastMeta.n - 1));
    }

    function bindCanvas(canvas) {
      canvas.addEventListener("mousemove", (e) => {
        const idx = indexFromPointer(canvas, e.clientX);
        if (idx !== hoverIndex) {
          hoverIndex = idx;
          draw();
        }
      });
      canvas.addEventListener("mouseleave", () => {
        hoverIndex = null;
        draw();
      });
      canvas.addEventListener(
        "touchmove",
        (e) => {
          if (!e.touches.length) return;
          const idx = indexFromPointer(canvas, e.touches[0].clientX);
          if (idx !== hoverIndex) {
            hoverIndex = idx;
            draw();
          }
        },
        { passive: true }
      );
      canvas.addEventListener("touchend", () => {
        hoverIndex = null;
        draw();
      });
    }

    bindCanvas(priceCanvas);
    bindCanvas(rsiCanvas);

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 80);
    });

    return {
      render(analysis, options) {
        currentAnalysis = analysis;
        currentOptions = { ...currentOptions, ...options };
        hoverIndex = null;
        draw();
      },
      redraw: draw,
    };
  }

  global.AkcieCharts = {
    createChartController,
  };
})(window);
