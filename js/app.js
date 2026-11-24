(function () {
  "use strict";

  const STORAGE_WATCHLIST_KEY = "akcie_watchlist_v1";
  const STORAGE_SETTINGS_KEY = "akcie_settings_v1";

  const DEFAULT_WATCHLIST = [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "META",
    "TSLA",
    "INTC",
    "JNJ",
    "CEZ.PR",
    "KOMB.PR",
  ];

  const DEFAULT_SETTINGS = {
    periodDays: 21,
    buyThreshold: 30,
    sellThreshold: 70,
  };

  const state = {
    mode: "json", // "json" | "demo"
    jsonAvailable: false,
    jsonDataset: null,
    demoDataset: null,
    watchlist: [],
    selectedSymbol: null,
    signalFilter: "ALL",
    searchQuery: "",
    settings: { ...DEFAULT_SETTINGS },
  };

  // DOM odkazy
  const els = {
    sourceBadge: document.getElementById("data-source-badge"),
    updatedAt: document.getElementById("data-updated-at"),
    btnToggleDemo: document.getElementById("btn-toggle-demo"),
    fallbackBanner: document.getElementById("fallback-banner"),
    fallbackTitle: document.getElementById("fallback-banner-title"),
    fallbackDesc: document.getElementById("fallback-banner-desc"),
    btnRetryJson: document.getElementById("btn-retry-json"),

    statTotal: document.getElementById("stat-total"),
    statBuy: document.getElementById("stat-buy"),
    statSell: document.getElementById("stat-sell"),
    statHold: document.getElementById("stat-hold"),

    addForm: document.getElementById("add-ticker-form"),
    tickerInput: document.getElementById("ticker-input"),
    datalist: document.getElementById("available-tickers-list"),
    searchInput: document.getElementById("search-input"),
    btnResetWatchlist: document.getElementById("btn-reset-watchlist"),
    formFeedback: document.getElementById("form-feedback"),

    filterButtons: Array.from(document.querySelectorAll(".filter-pill")),
    periodSelect: document.getElementById("period-select"),
    rsiBuyInput: document.getElementById("rsi-buy-input"),
    rsiSellInput: document.getElementById("rsi-sell-input"),

    visibleCountLabel: document.getElementById("visible-count-label"),
    watchlistContainer: document.getElementById("watchlist-container"),
    emptyState: document.getElementById("empty-state"),

    detailPane: document.getElementById("detail-pane"),
    detailPlaceholder: document.getElementById("detail-placeholder"),
    detailContent: document.getElementById("detail-content"),
    detailSymbol: document.getElementById("detail-symbol"),
    detailSignalBadge: document.getElementById("detail-signal-badge"),
    detailSimBadge: document.getElementById("detail-sim-badge"),
    detailName: document.getElementById("detail-name"),
    detailPrice: document.getElementById("detail-price"),
    detailChange: document.getElementById("detail-change"),
    detailReason: document.getElementById("detail-reason"),
    kpiRsi: document.getElementById("kpi-rsi"),
    kpiSma20: document.getElementById("kpi-sma20"),
    kpiSma50: document.getElementById("kpi-sma50"),
    kpiDate: document.getElementById("kpi-date"),
    detailNoData: document.getElementById("detail-no-data"),
    btnSwitchDemoInline: document.getElementById("btn-switch-demo-inline"),
    chartsWrapper: document.getElementById("charts-wrapper"),
    chartTooltip: document.getElementById("chart-tooltip"),
    priceCanvas: document.getElementById("price-chart"),
    rsiCanvas: document.getElementById("rsi-chart"),
    legendBuyTh: document.getElementById("legend-buy-th"),
    legendSellTh: document.getElementById("legend-sell-th"),
  };

  let chartController = null;
  let feedbackTimer = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function loadWatchlist() {
    try {
      const raw = localStorage.getItem(STORAGE_WATCHLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .map((s) => String(s).trim().toUpperCase())
            .filter(Boolean);
        }
      }
    } catch {
      // Ignorovat chyby localStorage (např. anonymní režim)
    }
    return [...DEFAULT_WATCHLIST];
  }

  function saveWatchlist() {
    try {
      localStorage.setItem(STORAGE_WATCHLIST_KEY, JSON.stringify(state.watchlist));
    } catch {
      // Ignorovat
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          periodDays: Number.isFinite(Number(parsed.periodDays))
            ? Number(parsed.periodDays)
            : DEFAULT_SETTINGS.periodDays,
          buyThreshold: clamp(Number(parsed.buyThreshold) || 30, 5, 45),
          sellThreshold: clamp(Number(parsed.sellThreshold) || 70, 55, 95),
        };
      }
    } catch {
      // Ignorovat
    }
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(state.settings));
    } catch {
      // Ignorovat
    }
  }

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function showFeedback(message, type = "ok") {
    clearTimeout(feedbackTimer);
    els.formFeedback.textContent = message;
    els.formFeedback.className = `form-feedback ${type === "error" ? "is-error" : "is-ok"}`;
    els.formFeedback.hidden = false;
    feedbackTimer = setTimeout(() => {
      els.formFeedback.hidden = true;
    }, 4500);
  }

  function getActiveDataset() {
    return state.mode === "json" && state.jsonDataset
      ? state.jsonDataset
      : state.demoDataset;
  }

  function getTickerRawData(symbol) {
    const dataset = getActiveDataset();
    if (dataset && dataset.tickers && dataset.tickers[symbol]) {
      return dataset.tickers[symbol];
    }
    if (state.mode === "demo") {
      const synthetic = window.AkcieDemoData.buildSyntheticTicker(symbol);
      state.demoDataset.tickers[symbol] = synthetic;
      return synthetic;
    }
    return {
      symbol,
      name: `${symbol} (není v market-data.json)`,
      currency: symbol.endsWith(".PR") ? "CZK" : "USD",
      sector: "Chybí data",
      history: [],
    };
  }

  function signalClass(signal) {
    if (signal === "KOUPIT") return "signal-koupit";
    if (signal === "PRODAT") return "signal-prodat";
    return "signal-drzet";
  }

  function changeClass(val) {
    if (val === null || val === undefined || Math.abs(val) < 0.005) return "is-flat";
    return val > 0 ? "is-pos" : "is-neg";
  }

  function formatUpdatedAt(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    return `Aktualizováno: ${d.toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function populateDatalist() {
    const dataset = getActiveDataset();
    const tickers = dataset?.tickers ? Object.values(dataset.tickers) : [];
    els.datalist.innerHTML = tickers
      .map(
        (t) =>
          `<option value="${escapeHtml(t.symbol)}">${escapeHtml(t.name)}</option>`
      )
      .join("");
  }

  function updateHeaderStatus() {
    const dataset = getActiveDataset();
    if (state.mode === "json" && state.jsonAvailable) {
      els.sourceBadge.textContent = "Data: data/market-data.json";
      els.sourceBadge.className = "source-pill is-live";
      els.btnToggleDemo.textContent = "Přepnout na demo data";
      els.fallbackBanner.hidden = true;
    } else {
      els.sourceBadge.textContent = "Režim: Ukázková demo data";
      els.sourceBadge.className = "source-pill is-demo";
      els.btnToggleDemo.textContent = state.jsonAvailable
        ? "Přepnout na market-data.json"
        : "Zkusit načíst market-data.json";
    }
    els.updatedAt.textContent = formatUpdatedAt(dataset?.updatedAt);
  }

  function computeAnalyses() {
    return state.watchlist.map((symbol) => {
      const raw = getTickerRawData(symbol);
      return window.AkcieIndicators.analyzeTicker(raw, state.settings);
    });
  }

  function renderAll() {
    updateHeaderStatus();
    populateDatalist();

    const analyses = computeAnalyses();

    // Souhrnné počty (vždy ze všech sledovaných tickerů)
    const counts = { ALL: analyses.length, KOUPIT: 0, PRODAT: 0, DRŽET: 0 };
    for (const a of analyses) {
      if (counts[a.signal] !== undefined) counts[a.signal]++;
    }

    els.statTotal.textContent = String(counts.ALL);
    els.statBuy.textContent = String(counts.KOUPIT);
    els.statSell.textContent = String(counts.PRODAT);
    els.statHold.textContent = String(counts.DRŽET);

    for (const btn of els.filterButtons) {
      const key = btn.dataset.signal;
      const countEl = btn.querySelector("[data-count]");
      if (countEl && counts[key] !== undefined) {
        countEl.textContent = String(counts[key]);
      }
      btn.classList.toggle("is-active", key === state.signalFilter);
    }

    // Filtrování podle signálu a vyhledávání
    const q = state.searchQuery.trim().toLowerCase();
    const filtered = analyses.filter((item) => {
      if (state.signalFilter !== "ALL" && item.signal !== state.signalFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.symbol} ${item.name} ${item.sector}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    els.visibleCountLabel.textContent = `Zobrazeno ${filtered.length} z ${analyses.length}`;

    // Výběr aktivního tickeru
    if (
      !state.selectedSymbol ||
      !state.watchlist.includes(state.selectedSymbol)
    ) {
      state.selectedSymbol = filtered[0]?.symbol || analyses[0]?.symbol || null;
    }

    renderWatchlist(filtered);

    const selectedAnalysis =
      analyses.find((a) => a.symbol === state.selectedSymbol) || null;
    renderDetail(selectedAnalysis);
  }

  function renderWatchlist(items) {
    const { formatPrice, formatPercent, formatNumber } = window.AkcieIndicators;

    if (items.length === 0) {
      els.watchlistContainer.innerHTML = "";
      els.emptyState.hidden = false;
      return;
    }

    els.emptyState.hidden = true;
    els.watchlistContainer.innerHTML = items
      .map((item) => {
        const isSelected = item.symbol === state.selectedSymbol;
        const rsiText = item.rsi !== null ? formatNumber(item.rsi, 1) : "—";
        const sma20Text =
          item.sma20 !== null ? formatPrice(item.sma20, item.currency) : "—";
        const sma50Text =
          item.sma50 !== null ? formatPrice(item.sma50, item.currency) : "—";

        return `
          <article
            class="ticker-row ${isSelected ? "is-selected" : ""}"
            role="listitem"
            tabindex="0"
            data-symbol="${escapeHtml(item.symbol)}"
            aria-selected="${isSelected ? "true" : "false"}"
          >
            <div class="ticker-row-top">
              <div class="ticker-identity">
                <div class="ticker-symbol-line">
                  <span class="ticker-symbol mono">${escapeHtml(item.symbol)}</span>
                  <span class="signal-badge ${signalClass(item.signal)}">${escapeHtml(item.signal)}</span>
                  ${item.isSimulated ? '<span class="sim-badge">Demo</span>' : ""}
                </div>
                <div class="ticker-name">${escapeHtml(item.name)}</div>
              </div>

              <div class="ticker-right">
                <div class="ticker-price-col">
                  <div class="ticker-price mono">${formatPrice(item.latestPrice, item.currency)}</div>
                  <div class="ticker-change mono ${changeClass(item.percentChange)}">${formatPercent(item.percentChange)}</div>
                </div>
                <button
                  type="button"
                  class="btn-remove"
                  data-remove="${escapeHtml(item.symbol)}"
                  title="Odebrat ${escapeHtml(item.symbol)} ze seznamu"
                  aria-label="Odebrat ${escapeHtml(item.symbol)}"
                >&times;</button>
              </div>
            </div>

            <div class="ticker-metrics mono">
              <span>RSI(14): <strong>${rsiText}</strong></span>
              <span>SMA 20: <strong>${sma20Text}</strong></span>
              <span>SMA 50: <strong>${sma50Text}</strong></span>
            </div>

            <p class="ticker-reason">${escapeHtml(item.reason)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderDetail(analysis) {
    if (!analysis) {
      els.detailPlaceholder.hidden = false;
      els.detailContent.hidden = true;
      return;
    }

    const { formatPrice, formatPercent, formatNumber } = window.AkcieIndicators;

    els.detailPlaceholder.hidden = true;
    els.detailContent.hidden = false;

    els.detailSymbol.textContent = analysis.symbol;
    els.detailSignalBadge.textContent = analysis.signal;
    els.detailSignalBadge.className = `signal-badge ${signalClass(analysis.signal)}`;
    els.detailSimBadge.hidden = !analysis.isSimulated;
    els.detailName.textContent = `${analysis.name} · ${analysis.sector}`;

    els.detailPrice.textContent = formatPrice(
      analysis.latestPrice,
      analysis.currency
    );
    els.detailChange.textContent = `${formatPercent(analysis.percentChange)} (${periodLabel(
      state.settings.periodDays
    )})`;
    els.detailChange.className = `detail-change mono ${changeClass(
      analysis.percentChange
    )}`;

    els.detailReason.textContent = analysis.reason;
    els.kpiRsi.textContent =
      analysis.rsi !== null ? formatNumber(analysis.rsi, 1) : "—";
    els.kpiSma20.textContent =
      analysis.sma20 !== null
        ? formatPrice(analysis.sma20, analysis.currency)
        : "—";
    els.kpiSma50.textContent =
      analysis.sma50 !== null
        ? formatPrice(analysis.sma50, analysis.currency)
        : "—";
    els.kpiDate.textContent = analysis.latestDate || "—";

    els.legendBuyTh.textContent = String(state.settings.buyThreshold);
    els.legendSellTh.textContent = String(state.settings.sellThreshold);

    if (!analysis.hasData) {
      els.detailNoData.hidden = false;
      els.chartsWrapper.hidden = true;
      return;
    }

    els.detailNoData.hidden = true;
    els.chartsWrapper.hidden = false;

    const chartWindowDays =
      state.settings.periodDays > 0
        ? Math.max(state.settings.periodDays, 30)
        : 0;

    chartController.render(analysis, {
      windowDays: chartWindowDays,
      buyThreshold: state.settings.buyThreshold,
      sellThreshold: state.settings.sellThreshold,
    });
  }

  function periodLabel(days) {
    if (days === 5) return "5D";
    if (days === 21) return "1M";
    if (days === 63) return "3M";
    if (days === 126) return "6M";
    return "vše";
  }

  async function tryLoadMarketJson() {
    try {
      const response = await fetch("data/market-data.json", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data || typeof data.tickers !== "object") {
        throw new Error("Neplatná struktura souboru market-data.json");
      }
      state.jsonDataset = data;
      state.jsonAvailable = true;
      state.mode = "json";
      els.fallbackBanner.hidden = true;
      return true;
    } catch (err) {
      state.jsonAvailable = false;
      state.mode = "demo";
      els.fallbackTitle.textContent =
        "Soubor data/market-data.json se nepodařilo načíst — aktivní jsou ukázková demo data.";
      els.fallbackDesc.textContent =
        window.location.protocol === "file:"
          ? "Prohlížeč blokuje načítání JSON přes protokol file://. Na GitHub Pages nebo lokálním HTTP serveru se soubor načte automaticky."
          : `Důvod: ${err.message}. Aplikace běží v záložním demo režimu.`;
      els.fallbackBanner.hidden = false;
      return false;
    }
  }

  function addTicker(rawSymbol) {
    const clean = rawSymbol.trim().toUpperCase();
    if (!clean) {
      showFeedback("Zadejte prosím symbol tickeru (např. AAPL nebo CEZ.PR).", "error");
      return;
    }
    if (!/^[A-Z0-9.\-^]{1,14}$/.test(clean)) {
      showFeedback("Neplatný formát tickeru. Použijte písmena, čísla, tečku nebo pomlčku.", "error");
      return;
    }
    if (state.watchlist.includes(clean)) {
      state.selectedSymbol = clean;
      renderAll();
      showFeedback(`Ticker ${clean} už je v seznamu — vybrán pro zobrazení.`, "ok");
      return;
    }

    state.watchlist.unshift(clean);
    state.selectedSymbol = clean;
    saveWatchlist();
    renderAll();

    const hasReal = Boolean(
      state.mode === "json" && state.jsonDataset?.tickers?.[clean]
    );
    if (state.mode === "json" && !hasReal) {
      showFeedback(
        `Ticker ${clean} přidán. Zatím není v data/market-data.json — můžete přepnout do demo režimu.`,
        "ok"
      );
    } else {
      showFeedback(`Ticker ${clean} byl přidán do seznamu a uložen.`, "ok");
    }
  }

  function removeTicker(symbol) {
    state.watchlist = state.watchlist.filter((s) => s !== symbol);
    if (state.selectedSymbol === symbol) {
      state.selectedSymbol = state.watchlist[0] || null;
    }
    saveWatchlist();
    renderAll();
    showFeedback(`Ticker ${symbol} byl odebrán ze seznamu.`, "ok");
  }

  function bindEvents() {
    els.addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addTicker(els.tickerInput.value);
      els.tickerInput.value = "";
    });

    els.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderAll();
    });

    els.btnResetWatchlist.addEventListener("click", () => {
      state.watchlist = [...DEFAULT_WATCHLIST];
      state.signalFilter = "ALL";
      state.searchQuery = "";
      els.searchInput.value = "";
      state.selectedSymbol = state.watchlist[0];
      saveWatchlist();
      renderAll();
      showFeedback("Výchozí seznam tickerů byl obnoven.", "ok");
    });

    for (const btn of els.filterButtons) {
      btn.addEventListener("click", () => {
        state.signalFilter = btn.dataset.signal;
        renderAll();
      });
    }

    els.periodSelect.addEventListener("change", (e) => {
      state.settings.periodDays = Number(e.target.value);
      saveSettings();
      renderAll();
    });

    const handleRsiChange = () => {
      const buy = clamp(Number(els.rsiBuyInput.value) || 30, 5, 45);
      const sell = clamp(Number(els.rsiSellInput.value) || 70, 55, 95);
      state.settings.buyThreshold = buy;
      state.settings.sellThreshold = sell;
      els.rsiBuyInput.value = String(buy);
      els.rsiSellInput.value = String(sell);
      saveSettings();
      renderAll();
    };

    els.rsiBuyInput.addEventListener("change", handleRsiChange);
    els.rsiSellInput.addEventListener("change", handleRsiChange);

    els.watchlistContainer.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove]");
      if (removeBtn) {
        e.stopPropagation();
        removeTicker(removeBtn.dataset.remove);
        return;
      }

      const row = e.target.closest(".ticker-row");
      if (row) {
        state.selectedSymbol = row.dataset.symbol;
        renderAll();
        if (window.innerWidth <= 980) {
          els.detailPane.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });

    els.watchlistContainer.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target.closest(".ticker-row");
      if (row && !e.target.closest("[data-remove]")) {
        e.preventDefault();
        state.selectedSymbol = row.dataset.symbol;
        renderAll();
      }
    });

    els.btnToggleDemo.addEventListener("click", async () => {
      if (state.mode === "json") {
        state.mode = "demo";
        renderAll();
      } else if (state.jsonAvailable) {
        state.mode = "json";
        renderAll();
      } else {
        await tryLoadMarketJson();
        renderAll();
      }
    });

    els.btnRetryJson.addEventListener("click", async () => {
      await tryLoadMarketJson();
      renderAll();
    });

    els.btnSwitchDemoInline.addEventListener("click", () => {
      state.mode = "demo";
      renderAll();
    });
  }

  async function init() {
    state.demoDataset = window.AkcieDemoData.buildDemoDataset();
    state.watchlist = loadWatchlist();
    state.settings = loadSettings();

    els.periodSelect.value = String(state.settings.periodDays);
    els.rsiBuyInput.value = String(state.settings.buyThreshold);
    els.rsiSellInput.value = String(state.settings.sellThreshold);

    chartController = window.AkcieCharts.createChartController({
      priceCanvas: els.priceCanvas,
      rsiCanvas: els.rsiCanvas,
      tooltipEl: els.chartTooltip,
    });

    bindEvents();
    await tryLoadMarketJson();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
