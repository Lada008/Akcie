(function () {
  "use strict";

  const STORAGE_WATCHLIST_KEY = "akcie_watchlist_v1";
  const STORAGE_SETTINGS_KEY = "akcie_settings_v1";

  const DEFAULT_WATCHLIST = [
    "VWCE.DE",
    "SXR8.DE",
    "EUNL.DE",
    "SPY",
    "QQQ",
    "GLD",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "META",
    "TSLA",
    "AMD",
    "INTC",
    "JPM",
    "JNJ",
    "ASML",
    "CEZ.PR",
    "KOMB.PR",
    "MONET.PR",
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
    assetTypeFilter: "ALL", // "ALL" | "STOCK" | "ETF"
    signalFilter: "ALL",
    searchQuery: "",
    assistantProfile: "vyvazeny",
    assistantQuestion: "Co dnes koupit?",
    settings: { ...DEFAULT_SETTINGS },
  };

  // DOM odkazy
  const els = {
    sourceBadge: document.getElementById("data-source-badge"),
    updatedAt: document.getElementById("data-updated-at"),
    btnToggleHelp: document.getElementById("btn-toggle-help"),
    btnCloseHelp: document.getElementById("btn-close-help"),
    helpPanel: document.getElementById("help-panel"),
    btnToggleDemo: document.getElementById("btn-toggle-demo"),
    fallbackBanner: document.getElementById("fallback-banner"),
    fallbackTitle: document.getElementById("fallback-banner-title"),
    fallbackDesc: document.getElementById("fallback-banner-desc"),
    btnRetryJson: document.getElementById("btn-retry-json"),

    statTotal: document.getElementById("stat-total"),
    statBuy: document.getElementById("stat-buy"),
    statSell: document.getElementById("stat-sell"),
    statHold: document.getElementById("stat-hold"),

    profileButtons: Array.from(document.querySelectorAll(".profile-pill")),
    promptChips: Array.from(document.querySelectorAll(".prompt-chip")),
    assistantForm: document.getElementById("assistant-form"),
    assistantInput: document.getElementById("assistant-input"),
    assistantReplyTitle: document.getElementById("assistant-reply-title"),
    assistantReplyBody: document.getElementById("assistant-reply-body"),
    assistantPicks: document.getElementById("assistant-picks"),

    addForm: document.getElementById("add-ticker-form"),
    tickerInput: document.getElementById("ticker-input"),
    datalist: document.getElementById("available-tickers-list"),
    searchInput: document.getElementById("search-input"),
    btnLoadAllTickers: document.getElementById("btn-load-all-tickers"),
    btnResetWatchlist: document.getElementById("btn-reset-watchlist"),
    formFeedback: document.getElementById("form-feedback"),

    typeButtons: Array.from(document.querySelectorAll(".type-pill")),
    filterButtons: Array.from(document.querySelectorAll(".filter-pill")),
    periodSelect: document.getElementById("period-select"),
    btnToggleAdvanced: document.getElementById("btn-toggle-advanced"),
    advancedSettings: document.getElementById("advanced-settings"),
    btnResetRsi: document.getElementById("btn-reset-rsi"),
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
    kpiRsiHint: document.getElementById("kpi-rsi-hint"),
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

    detailOutlookBox: document.getElementById("detail-outlook-box"),
    outlookShort: document.getElementById("outlook-short"),
    outlookMedium: document.getElementById("outlook-medium"),
    outlookVol: document.getElementById("outlook-vol"),
    outlookRange: document.getElementById("outlook-range"),
    detailNewsBox: document.getElementById("detail-news-box"),
    detailNewsList: document.getElementById("detail-news-list"),

    marketMoodBadge: document.getElementById("market-mood-badge"),
    marketSpy: document.getElementById("market-spy"),
    marketQqq: document.getElementById("market-qqq"),
    marketUptrend: document.getElementById("market-uptrend"),
    marketAvgRsi: document.getElementById("market-avgrsi"),
    marketForecastText: document.getElementById("market-forecast-text"),
    marketNewsList: document.getElementById("market-news-list"),
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

    for (const btn of els.typeButtons) {
      btn.classList.toggle("is-active", btn.dataset.assetType === state.assetTypeFilter);
    }

    if (els.btnLoadAllTickers) {
      const ds = getActiveDataset();
      const totalAvail = ds?.tickers ? Object.keys(ds.tickers).length : 0;
      if (totalAvail > 0) {
        els.btnLoadAllTickers.textContent = `Načíst vše (${totalAvail})`;
      }
    }

    // Filtrování podle typu (Akcie/ETF), signálu a vyhledávání
    const q = state.searchQuery.trim().toLowerCase();
    const filtered = analyses.filter((item) => {
      if (
        state.assetTypeFilter !== "ALL" &&
        item.assetType !== state.assetTypeFilter
      ) {
        return false;
      }
      if (state.signalFilter !== "ALL" && item.signal !== state.signalFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.symbol} ${item.name} ${item.sector} ${item.assetType}`.toLowerCase();
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
    renderMarketIntel();
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
                  ${item.assetType === "ETF" ? '<span class="etf-badge">ETF</span>' : ""}
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
    if (els.kpiRsiHint) {
      if (analysis.rsi === null) {
        els.kpiRsiHint.textContent = "chybí data";
      } else if (analysis.rsi < state.settings.buyThreshold) {
        els.kpiRsiHint.textContent = "přeprodáno (KOUPIT)";
      } else if (analysis.rsi > state.settings.sellThreshold) {
        els.kpiRsiHint.textContent = "překoupeno (PRODAT)";
      } else {
        els.kpiRsiHint.textContent = "klidné pásmo";
      }
    }
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
      if (els.detailOutlookBox) els.detailOutlookBox.hidden = true;
      if (els.detailNewsBox) els.detailNewsBox.hidden = true;
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

    // Orientační technická prognóza v detailu akcie
    if (els.detailOutlookBox && analysis.outlook) {
      els.detailOutlookBox.hidden = false;
      els.outlookShort.textContent = analysis.outlook.shortTerm;
      els.outlookMedium.textContent = analysis.outlook.mediumTerm;
      els.outlookVol.textContent = analysis.outlook.volatilityLabel;
      const sup = formatPrice(analysis.outlook.support20, analysis.currency);
      const res = formatPrice(analysis.outlook.resistance20, analysis.currency);
      els.outlookRange.textContent = `${sup} – ${res}`;
    }

    // Zprávy k vybrané akcii
    if (els.detailNewsBox && els.detailNewsList) {
      if (analysis.news && analysis.news.length > 0) {
        els.detailNewsBox.hidden = false;
        renderNewsList(els.detailNewsList, analysis.news);
      } else {
        els.detailNewsBox.hidden = true;
      }
    }
  }

  function formatNewsDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderNewsList(listEl, items) {
    if (!listEl) return;
    if (!Array.isArray(items) || items.length === 0) {
      listEl.innerHTML =
        '<li class="news-item"><span class="news-meta">Zatím nejsou k dispozici žádné zprávy. Spusťte denní aktualizaci dat přes GitHub Actions.</span></li>';
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const safeTitle = escapeHtml(item.title || "");
        const safeLink = escapeHtml(item.link || "#");
        const safeSource = escapeHtml(item.source || "Zprávy");
        const dateStr = formatNewsDate(item.publishedAt);
        return `
          <li class="news-item">
            <a class="news-link" href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
            <div class="news-meta">
              <span>${safeSource}</span>
              ${dateStr ? `<span>· ${escapeHtml(dateStr)}</span>` : ""}
            </div>
          </li>
        `;
      })
      .join("");
  }

  function renderMarketIntel() {
    if (!els.marketForecastText) return;
    const { analyzeTicker, summarizeMarket, formatPercent, formatNumber } =
      window.AkcieIndicators;
    const dataset = getActiveDataset();
    const allRaw = dataset?.tickers ? Object.values(dataset.tickers) : [];
    const allAnalyses = allRaw.map((raw) => analyzeTicker(raw, state.settings));
    const summary = summarizeMarket(allAnalyses);

    els.marketMoodBadge.textContent = summary.mood;
    els.marketMoodBadge.className = `mood-badge ${summary.moodClass}`;

    if (summary.spy) {
      els.marketSpy.textContent = `${formatPercent(summary.spy.percentChange)} (${periodLabel(state.settings.periodDays)})`;
      els.marketSpy.className = `mono ${changeClass(summary.spy.percentChange)}`;
    } else {
      els.marketSpy.textContent = "—";
      els.marketSpy.className = "mono";
    }

    if (summary.qqq) {
      els.marketQqq.textContent = `${formatPercent(summary.qqq.percentChange)} (${periodLabel(state.settings.periodDays)})`;
      els.marketQqq.className = `mono ${changeClass(summary.qqq.percentChange)}`;
    } else {
      els.marketQqq.textContent = "—";
      els.marketQqq.className = "mono";
    }

    els.marketUptrend.textContent = `${summary.uptrendPct} %`;
    els.marketAvgRsi.textContent =
      summary.avgRsi !== null ? formatNumber(summary.avgRsi, 1) : "—";
    els.marketForecastText.textContent = summary.forecastText;

    const news = Array.isArray(dataset?.marketNews) ? dataset.marketNews : [];
    renderNewsList(els.marketNewsList, news);
    renderAssistant(allAnalyses, summary);
  }

  function renderAssistant(allAnalyses, marketSummary) {
    if (!els.assistantReplyTitle || !window.AkcieAssistant) return;

    for (const btn of els.profileButtons) {
      btn.classList.toggle("is-active", btn.dataset.profile === state.assistantProfile);
    }

    const selectedAnalysis =
      allAnalyses.find((a) => a.symbol === state.selectedSymbol) || null;

    const reply = window.AkcieAssistant.answerQuestion(state.assistantQuestion, {
      allAnalyses,
      selectedAnalysis,
      marketSummary,
      profile: state.assistantProfile,
      settings: state.settings,
    });

    els.assistantReplyTitle.textContent = reply.title;
    els.assistantReplyBody.innerHTML = (reply.paragraphs || [])
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    if (!reply.picks || reply.picks.length === 0) {
      els.assistantPicks.innerHTML = "";
      els.assistantPicks.hidden = true;
      return;
    }

    els.assistantPicks.hidden = false;
    els.assistantPicks.innerHTML = reply.picks
      .map(
        (pick) => `
        <button type="button" class="pick-card" data-pick-symbol="${escapeHtml(pick.symbol)}">
          <div class="pick-card-top">
            <span class="pick-symbol mono">${escapeHtml(pick.symbol)} · ${escapeHtml(pick.name)}</span>
            <span class="signal-badge ${signalClass(pick.signal)}">${escapeHtml(pick.signal)}</span>
          </div>
          <div class="pick-meta mono">${escapeHtml(pick.meta)}</div>
          <div class="pick-note">${escapeHtml(pick.note)}</div>
        </button>
      `
      )
      .join("");
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

    if (els.btnLoadAllTickers) {
      els.btnLoadAllTickers.addEventListener("click", () => {
        const dataset = getActiveDataset();
        const allSymbols = dataset?.tickers ? Object.keys(dataset.tickers) : [];
        if (allSymbols.length === 0) return;
        const merged = Array.from(new Set([...state.watchlist, ...allSymbols]));
        state.watchlist = merged;
        state.signalFilter = "ALL";
        state.searchQuery = "";
        els.searchInput.value = "";
        saveWatchlist();
        renderAll();
        showFeedback(`Načteno všech ${allSymbols.length} dostupných akcií a ETF.`, "ok");
      });
    }

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

    for (const btn of els.typeButtons) {
      btn.addEventListener("click", () => {
        state.assetTypeFilter = btn.dataset.assetType || "ALL";
        renderAll();
      });
    }

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

    if (els.btnToggleHelp && els.helpPanel) {
      const setHelpOpen = (open) => {
        els.helpPanel.hidden = !open;
        els.btnToggleHelp.setAttribute("aria-expanded", String(open));
        els.btnToggleHelp.textContent = open ? "Skrýt nápovědu" : "? Nápověda";
      };

      els.btnToggleHelp.addEventListener("click", () => {
        setHelpOpen(els.helpPanel.hidden);
      });

      if (els.btnCloseHelp) {
        els.btnCloseHelp.addEventListener("click", () => setHelpOpen(false));
      }
    }

    if (els.btnToggleAdvanced && els.advancedSettings) {
      els.btnToggleAdvanced.addEventListener("click", () => {
        const open = els.advancedSettings.hidden;
        els.advancedSettings.hidden = !open;
        els.btnToggleAdvanced.setAttribute("aria-expanded", String(open));
        els.btnToggleAdvanced.textContent = open
          ? "Skrýt hranice RSI"
          : "Upravit hranice RSI";
      });
    }

    if (els.btnResetRsi) {
      els.btnResetRsi.addEventListener("click", () => {
        state.settings.buyThreshold = DEFAULT_SETTINGS.buyThreshold;
        state.settings.sellThreshold = DEFAULT_SETTINGS.sellThreshold;
        els.rsiBuyInput.value = String(DEFAULT_SETTINGS.buyThreshold);
        els.rsiSellInput.value = String(DEFAULT_SETTINGS.sellThreshold);
        saveSettings();
        renderAll();
        showFeedback("Hranice RSI byly vráceny na výchozích 30 / 70.", "ok");
      });
    }

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

    // Analytický asistent
    for (const btn of els.profileButtons) {
      btn.addEventListener("click", () => {
        state.assistantProfile = btn.dataset.profile;
        state.assistantQuestion = "Co dnes koupit?";
        renderAll();
      });
    }

    for (const chip of els.promptChips) {
      chip.addEventListener("click", () => {
        state.assistantQuestion = chip.dataset.prompt || "Co dnes koupit?";
        if (els.assistantInput) els.assistantInput.value = "";
        renderAll();
      });
    }

    if (els.assistantForm) {
      els.assistantForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = (els.assistantInput?.value || "").trim();
        if (!q) return;
        state.assistantQuestion = q;
        renderAll();
      });
    }

    if (els.assistantPicks) {
      els.assistantPicks.addEventListener("click", (e) => {
        const card = e.target.closest("[data-pick-symbol]");
        if (!card) return;
        const sym = card.dataset.pickSymbol;
        if (!sym) return;
        if (!state.watchlist.includes(sym)) {
          state.watchlist.unshift(sym);
          saveWatchlist();
        }
        state.signalFilter = "ALL";
        state.searchQuery = "";
        els.searchInput.value = "";
        state.selectedSymbol = sym;
        renderAll();
        els.detailPane.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
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
