(function (global) {
  "use strict";

  const DEMO_SPECS = [
    { symbol: "AAPL", name: "Apple Inc.", currency: "USD", sector: "Technologie", seed: 101, start: 212, drift: 0.0005, vol: 0.011, mode: "hold_up" },
    { symbol: "MSFT", name: "Microsoft Corp.", currency: "USD", sector: "Technologie", seed: 102, start: 418, drift: 0.0004, vol: 0.010, mode: "hold_up" },
    { symbol: "NVDA", name: "NVIDIA Corp.", currency: "USD", sector: "Polovodiče", seed: 203, start: 118, drift: 0.0014, vol: 0.017, mode: "sell" },
    { symbol: "GOOGL", name: "Alphabet Inc.", currency: "USD", sector: "Technologie", seed: 104, start: 168, drift: 0.0003, vol: 0.012, mode: "hold_down" },
    { symbol: "AMZN", name: "Amazon.com Inc.", currency: "USD", sector: "E-commerce", seed: 205, start: 186, drift: 0.0009, vol: 0.013, mode: "sell" },
    { symbol: "META", name: "Meta Platforms Inc.", currency: "USD", sector: "Technologie", seed: 206, start: 520, drift: 0.0010, vol: 0.014, mode: "sell" },
    { symbol: "TSLA", name: "Tesla Inc.", currency: "USD", sector: "Automobilový průmysl", seed: 207, start: 258, drift: -0.0004, vol: 0.020, mode: "buy" },
    { symbol: "INTC", name: "Intel Corp.", currency: "USD", sector: "Polovodiče", seed: 208, start: 31.5, drift: -0.0006, vol: 0.016, mode: "buy" },
    { symbol: "KO", name: "The Coca-Cola Co.", currency: "USD", sector: "Spotřební zboží", seed: 109, start: 64, drift: 0.0002, vol: 0.007, mode: "hold_up" },
    { symbol: "JNJ", name: "Johnson & Johnson", currency: "USD", sector: "Zdravotnictví", seed: 210, start: 158, drift: -0.0002, vol: 0.009, mode: "buy" },
    { symbol: "CEZ.PR", name: "ČEZ, a. s.", currency: "CZK", sector: "Energetika", seed: 111, start: 910, drift: 0.0005, vol: 0.009, mode: "hold_up" },
    { symbol: "KOMB.PR", name: "Komerční banka, a. s.", currency: "CZK", sector: "Finance", seed: 112, start: 785, drift: 0.0006, vol: 0.010, mode: "hold_down" },
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    const u1 = Math.max(1e-7, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function hashSymbol(symbol) {
    let h = 2166136261;
    for (let i = 0; i < symbol.length; i++) {
      h ^= symbol.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function generateTradingDates(count = 130) {
    const dates = [];
    const cur = new Date();
    cur.setHours(12, 0, 0, 0);
    while (dates.length < count) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
      }
      cur.setDate(cur.getDate() - 1);
    }
    dates.reverse();
    return dates;
  }

  function generateSeries(spec, dates) {
    const rng = mulberry32(spec.seed);
    const n = dates.length;
    const history = [];
    let price = spec.start;

    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const wave = Math.sin(i / 12 + spec.seed) * spec.vol * 0.4;
        let step = spec.drift + wave + gaussian(rng) * spec.vol;
        if (i >= n - 14) {
          if (spec.mode === "buy") {
            step = -Math.abs(spec.vol) * 0.72 + gaussian(rng) * spec.vol * 0.45;
          } else if (spec.mode === "sell") {
            step = Math.abs(spec.vol) * 0.72 + gaussian(rng) * spec.vol * 0.45;
          } else if (spec.mode === "hold_up") {
            step = 0.001 + gaussian(rng) * spec.vol * 0.7;
          } else if (spec.mode === "hold_down") {
            step = -0.001 + gaussian(rng) * spec.vol * 0.7;
          }
        }
        price = Math.max(1, price * (1 + step));
      }
      history.push({
        date: dates[i],
        close: Math.round(price * 100) / 100,
      });
    }
    return history;
  }

  function buildDemoDataset() {
    const dates = generateTradingDates(130);
    const tickers = {};
    for (const spec of DEMO_SPECS) {
      tickers[spec.symbol] = {
        symbol: spec.symbol,
        name: spec.name,
        currency: spec.currency,
        sector: spec.sector,
        isSimulated: true,
        history: generateSeries(spec, dates),
      };
    }
    return {
      updatedAt: new Date().toISOString(),
      source: "Ukázková demo data (lokální záložní režim)",
      tickers,
    };
  }

  /**
   * Vygeneruje deterministickou ukázkovou řadu pro libovolný vlastní ticker v demo režimu.
   */
  function buildSyntheticTicker(symbol) {
    const clean = symbol.toUpperCase().trim();
    const seed = hashSymbol(clean);
    const modes = ["buy", "sell", "hold_up", "hold_down"];
    const mode = modes[seed % modes.length];
    const start = 35 + (seed % 320);
    const currency = clean.endsWith(".PR") ? "CZK" : clean.endsWith(".DE") ? "EUR" : "USD";
    const dates = generateTradingDates(130);

    return {
      symbol: clean,
      name: `${clean} (ukázková simulace)`,
      currency,
      sector: "Vlastní ticker",
      isSimulated: true,
      history: generateSeries(
        { seed, start, drift: 0.0003, vol: 0.014, mode },
        dates
      ),
    };
  }

  global.AkcieDemoData = {
    buildDemoDataset,
    buildSyntheticTicker,
  };
})(window);
