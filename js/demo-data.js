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
    { symbol: "AMD", name: "Advanced Micro Devices", currency: "USD", sector: "Polovodiče", seed: 213, start: 148, drift: -0.0003, vol: 0.019, mode: "buy" },
    { symbol: "INTC", name: "Intel Corp.", currency: "USD", sector: "Polovodiče", seed: 208, start: 31.5, drift: -0.0006, vol: 0.016, mode: "buy" },
    { symbol: "NFLX", name: "Netflix Inc.", currency: "USD", sector: "Média a streaming", seed: 214, start: 680, drift: 0.0010, vol: 0.014, mode: "sell" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", currency: "USD", sector: "Finance", seed: 215, start: 208, drift: 0.0006, vol: 0.009, mode: "hold_up" },
    { symbol: "V", name: "Visa Inc.", currency: "USD", sector: "Finance", seed: 216, start: 275, drift: 0.0004, vol: 0.008, mode: "hold_up" },
    { symbol: "BRK-B", name: "Berkshire Hathaway B", currency: "USD", sector: "Konglomerát", seed: 217, start: 430, drift: 0.0004, vol: 0.007, mode: "hold_up" },
    { symbol: "JNJ", name: "Johnson & Johnson", currency: "USD", sector: "Zdravotnictví", seed: 210, start: 158, drift: -0.0002, vol: 0.009, mode: "buy" },
    { symbol: "UNH", name: "UnitedHealth Group", currency: "USD", sector: "Zdravotnictví", seed: 218, start: 540, drift: -0.0003, vol: 0.011, mode: "buy" },
    { symbol: "KO", name: "The Coca-Cola Co.", currency: "USD", sector: "Spotřební zboží", seed: 109, start: 64, drift: 0.0002, vol: 0.007, mode: "hold_up" },
    { symbol: "WMT", name: "Walmart Inc.", currency: "USD", sector: "Maloobchod", seed: 219, start: 74, drift: 0.0008, vol: 0.008, mode: "sell" },
    { symbol: "XOM", name: "Exxon Mobil Corp.", currency: "USD", sector: "Energetika", seed: 220, start: 114, drift: -0.0002, vol: 0.011, mode: "hold_down" },
    { symbol: "CEZ.PR", name: "ČEZ, a. s.", currency: "CZK", sector: "Energetika", seed: 111, start: 910, drift: 0.0005, vol: 0.009, mode: "hold_up" },
    { symbol: "KOMB.PR", name: "Komerční banka, a. s.", currency: "CZK", sector: "Finance", seed: 112, start: 785, drift: 0.0006, vol: 0.010, mode: "hold_down" },
    { symbol: "MONET.PR", name: "MONETA Money Bank", currency: "CZK", sector: "Finance", seed: 221, start: 112, drift: 0.0005, vol: 0.008, mode: "hold_up" },
    { symbol: "ASML", name: "ASML Holding N.V.", currency: "USD", sector: "Polovodiče (EU)", seed: 222, start: 820, drift: -0.0005, vol: 0.016, mode: "buy" },
    { symbol: "SAP", name: "SAP SE", currency: "USD", sector: "Technologie (EU)", seed: 223, start: 210, drift: 0.0008, vol: 0.011, mode: "hold_up" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", currency: "USD", sector: "Indexové ETF (USA)", seed: 224, start: 560, drift: 0.0005, vol: 0.007, mode: "hold_up" },
    { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100)", currency: "USD", sector: "Indexové ETF (Tech)", seed: 225, start: 480, drift: 0.0007, vol: 0.009, mode: "hold_up" },
  ];

  const DEMO_NEWS = [
    {
      title: "Americké indexy S&P 500 a Nasdaq vyčkávají na další makrodata a výsledkovou sezónu",
      link: "https://finance.yahoo.com/",
      publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      source: "Demo přehled",
    },
    {
      title: "Polovodičový sektor vykazuje vysokou rozkolísanost — investoři rozlišují lídry v AI a tradiční výrobce",
      link: "https://finance.yahoo.com/sectors/technology/",
      publishedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      source: "Demo přehled",
    },
    {
      title: "Pražská burza: energetické a bankovní tituly (ČEZ, KB, Moneta) zůstávají pod drobnohledem dividendových investorů",
      link: "https://www.patria.cz/",
      publishedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      source: "Demo přehled",
    },
    {
      title: "Defenzivní sektory a zdravotnictví po nedávném oslabení lákají opatrnější investory",
      link: "https://finance.yahoo.com/sectors/healthcare/",
      publishedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      source: "Demo přehled",
    },
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
        news: [],
      };
    }
    return {
      updatedAt: new Date().toISOString(),
      source: "Ukázková demo data (25 titulů — lokální záložní režim)",
      marketNews: DEMO_NEWS,
      tickers,
    };
  }

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
      news: [],
    };
  }

  global.AkcieDemoData = {
    buildDemoDataset,
    buildSyntheticTicker,
  };
})(window);
