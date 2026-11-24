(function (global) {
  "use strict";

  const PROFILE_LABELS = {
    opatrny: "Opatrný (nižší výkyvy, stabilní trend)",
    vyvazeny: "Vyvážený (trend + rozumné RSI)",
    dynamicky: "Dynamický (přeprodané akcie s vyšším rizikem)",
  };

  function normalizeText(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function findMentionedTicker(query, allAnalyses) {
    const norm = normalizeText(query);
    if (!norm) return null;

    // 1. Přesná shoda symbolu (např. "AAPL", "CEZ.PR", "SPY")
    const tokens = norm.split(/[^a-z0-9.-]+/).filter(Boolean);
    for (const a of allAnalyses) {
      const symNorm = normalizeText(a.symbol);
      const symBase = symNorm.split(".")[0];
      if (tokens.includes(symNorm) || (symBase.length >= 2 && tokens.includes(symBase))) {
        return a;
      }
    }

    // 2. Shoda podle názvu firmy (např. "apple", "cez", "komercni", "moneta", "nvidia")
    for (const a of allAnalyses) {
      const nameNorm = normalizeText(a.name);
      const firstWord = nameNorm.split(/[\s,]+/)[0];
      if (firstWord && firstWord.length >= 3 && norm.includes(firstWord)) {
        return a;
      }
    }

    // 3. Běžné české aliasy
    if (norm.includes("s&p") || norm.includes("sp500") || norm.includes("sp 500")) {
      return allAnalyses.find((a) => a.symbol === "SPY") || null;
    }
    if (norm.includes("nasdaq")) {
      return allAnalyses.find((a) => a.symbol === "QQQ") || null;
    }

    return null;
  }

  function scoreForProfile(a, profile, settings) {
    if (!a.hasData || a.rsi === null) return -999;
    const vol = a.outlook?.dailyVolPct ?? 1.5;
    const above20 = a.sma20 !== null && a.latestPrice >= a.sma20;
    const above50 = a.sma50 !== null && a.latestPrice >= a.sma50;
    const isEtf = a.assetType === "ETF";

    if (profile === "opatrny") {
      let s = 50;
      s -= vol * 18; // výrazně preferuje nižší kolísavost
      if (isEtf) s += 14;
      if (above50) s += 12;
      if (above20) s += 6;
      if (a.rsi > settings.sellThreshold) s -= 22;
      if (a.rsi >= 35 && a.rsi <= 62) s += 8;
      return s;
    }

    if (profile === "dynamicky") {
      let s = 100 - a.rsi; // čím nižší RSI, tím výše
      if (a.signal === "KOUPIT") s += 25;
      if (above50) s += 6; // bonus pokud dlouhodobý trend není úplně zlomený
      return s;
    }

    // vyvazeny
    let s = 60;
    if (a.signal === "KOUPIT") s += 16;
    else if (a.rsi >= 30 && a.rsi <= 55) s += 12;
    else if (a.signal === "PRODAT") s -= 25;
    if (above50) s += 12;
    if (above20) s += 6;
    s -= vol * 6;
    return s;
  }

  function formatCandidateLine(a, reasonExtra) {
    const { formatPrice, formatNumber, formatPercent } = global.AkcieIndicators;
    return {
      symbol: a.symbol,
      name: a.name,
      signal: a.signal,
      meta: `${formatPrice(a.latestPrice, a.currency)} · RSI ${formatNumber(a.rsi, 1)} · ${formatPercent(a.percentChange)}`,
      note: reasonExtra || a.reason,
    };
  }

  function replyForRecommendations(ctx) {
    const { allAnalyses, profile, settings } = ctx;
    const valid = allAnalyses.filter((a) => a.hasData && a.rsi !== null);
    if (valid.length === 0) {
      return {
        title: "Nedostatek dat pro výběr",
        paragraphs: ["Zatím nejsou načtena historická data pro vyhodnocení akcií."],
        picks: [],
      };
    }

    const sorted = [...valid].sort(
      (a, b) => scoreForProfile(b, profile, settings) - scoreForProfile(a, profile, settings)
    );
    const top = sorted.slice(0, 4);

    let intro = "";
    if (profile === "opatrny") {
      intro =
        "Pro opatrnější styl jsem vybral tituly s nižší kolísavostí, rozumným RSI (mimo přehřáté pásmo) a stabilnějším trendem:";
    } else if (profile === "dynamicky") {
      intro =
        "Pro dynamičtější styl jsem vybral nejvíce přeprodané tituly (nejnižší RSI), kde se často sleduje možný technický odraz. Pozor: u klesajících akcií je vyšší riziko dalšího poklesu!";
    } else {
      intro =
        "Pro vyvážený styl jsem vybral tituly s nejlepší kombinací technického trendu (SMA 20/50) a nepřehřátého RSI:";
    }

    const picks = top.map((a) => {
      const trend = a.outlook?.mediumTerm || "";
      const vol = a.outlook?.volatilityLabel || "";
      return formatCandidateLine(a, `${trend} · Kolísavost: ${vol}. ${a.reason}`);
    });

    return {
      title: `Orientační výběr — profil: ${PROFILE_LABELS[profile]}`,
      paragraphs: [
        intro,
        "Kliknutím na libovolný titul níže si rovnou otevřete jeho graf a detail. Jde pouze o technický výběr z historických dat — obchodování je vždy na vaše vlastní riziko.",
      ],
      picks,
    };
  }

  function replyForOverbought(ctx) {
    const { allAnalyses, settings } = ctx;
    const valid = allAnalyses
      .filter((a) => a.hasData && a.rsi !== null)
      .sort((a, b) => b.rsi - a.rsi);

    const overbought = valid.filter((a) => a.rsi > settings.sellThreshold);
    const list = (overbought.length > 0 ? overbought : valid.slice(0, 3)).slice(0, 4);

    const intro =
      overbought.length > 0
        ? `Následující tituly mají RSI nad nastavenou hranicí ${settings.sellThreshold} (signál PRODAT — po rychlém růstu roste riziko krátkodobého ochlazení):`
        : `Žádný titul teď nemá RSI nad hranicí ${settings.sellThreshold}. Nejblíže překoupenému pásmu jsou tyto akcie:`;

    return {
      title: "Přehřáté akcie / kandidáti k opatrnosti",
      paragraphs: [
        intro,
        "Vysoké RSI neznamená, že akcie musí okamžitě spadnout, ale u nových nákupů se vyplatí zvýšená opatrnost.",
      ],
      picks: list.map((a) => formatCandidateLine(a, a.reason)),
    };
  }

  function replyForCalm(ctx) {
    const { allAnalyses, settings } = ctx;
    const valid = allAnalyses
      .filter((a) => a.hasData && a.rsi !== null && a.rsi <= settings.sellThreshold)
      .sort((a, b) => (a.outlook?.dailyVolPct ?? 9) - (b.outlook?.dailyVolPct ?? 9));

    const top = valid.slice(0, 4);
    return {
      title: "Klidnější tituly s nižší kolísavostí",
      paragraphs: [
        "Tyto tituly vykazují v posledních 20 dnech nejmenší denní výkyvy a nejsou v přehřátém pásmu (vhodnější pro začátečníky, kteří nechtějí prudké skoky ceny):",
      ],
      picks: top.map((a) =>
        formatCandidateLine(
          a,
          `Kolísavost: ${a.outlook?.volatilityLabel || "—"} · ${a.outlook?.mediumTerm || ""}`
        )
      ),
    };
  }

  function replyForMarket(ctx) {
    const { marketSummary, allAnalyses } = ctx;
    const { formatPercent, formatNumber } = global.AkcieIndicators;

    const spyTxt = marketSummary.spy
      ? `S&P 500 (SPY): ${formatPercent(marketSummary.spy.percentChange)}`
      : "S&P 500: nedostupné";
    const qqqTxt = marketSummary.qqq
      ? `Nasdaq-100 (QQQ): ${formatPercent(marketSummary.qqq.percentChange)}`
      : "Nasdaq-100: nedostupné";

    const buys = allAnalyses.filter((a) => a.hasData && a.signal === "KOUPIT").length;
    const sells = allAnalyses.filter((a) => a.hasData && a.signal === "PRODAT").length;

    return {
      title: `Stav trhu: ${marketSummary.mood}`,
      paragraphs: [
        marketSummary.forecastText,
        `Hlavní indexy: ${spyTxt} | ${qqqTxt}. Průměrné RSI napříč sledovanými tituly je ${formatNumber(marketSummary.avgRsi, 1)} (${buys}× KOUPIT, ${sells}× PRODAT).`,
      ],
      picks: [marketSummary.spy, marketSummary.qqq]
        .filter(Boolean)
        .map((a) => formatCandidateLine(a, a.outlook?.shortTerm)),
    };
  }

  function replyForSingleTicker(a, settings) {
    const { formatPrice, formatNumber, formatPercent } = global.AkcieIndicators;
    if (!a.hasData) {
      return {
        title: `Hodnocení: ${a.symbol}`,
        paragraphs: [
          `Pro ${a.symbol} zatím chybí historická data v aktuálním datasetu. Přepněte do demo režimu nebo přidejte ticker do scripts/update_data.py.`,
        ],
        picks: [],
      };
    }

    const sup = formatPrice(a.outlook?.support20, a.currency);
    const res = formatPrice(a.outlook?.resistance20, a.currency);

    let checklist = "";
    if (a.signal === "KOUPIT") {
      checklist =
        "Před případným nákupem si ověřte, proč cena klesla (např. ve zprávách k firmě), abyste nekupovali firmu v zásadních problémech.";
    } else if (a.signal === "PRODAT") {
      checklist =
        "Akcie je v překoupeném pásmu — pokud ji vlastníte, můžete zvážit částečnou ochranu zisku; u nového nákupu hrozí horší načasování.";
    } else {
      checklist =
        "Technické ukazatele nehlásí žádný extrém. Většina investorů v takové situaci vyčkává nebo nakupuje postupně po menších částkách.";
    }

    return {
      title: `Hodnocení: ${a.symbol} — ${a.name} (${a.signal})`,
      paragraphs: [
        `Aktuální cena je ${formatPrice(a.latestPrice, a.currency)} (změna za zvolené období: ${formatPercent(a.percentChange)}). ${a.reason}`,
        `Výhled: ${a.outlook?.shortTerm || "—"} Střednědobý trend: ${a.outlook?.mediumTerm || "—"}. Kolísavost: ${a.outlook?.volatilityLabel || "—"}. 20denní rozsah ceny: ${sup} – ${res}.`,
        `Na co myslet: ${checklist} (Hranice RSI: ${settings.buyThreshold}/${settings.sellThreshold}. Obchodování je vždy na vlastní riziko.)`,
      ],
      picks: [formatCandidateLine(a, `Kliknutím zobrazíte detail a graf pro ${a.symbol}.`)],
    };
  }

  function replyForEducation() {
    return {
      title: "Jak číst signály bez stresu",
      paragraphs: [
        "1) RSI (14 dnů) měří, zda akcie v posledních dvou týdnech hodně spadla (pod 30 = KOUPIT), nebo prudce vyrostla (nad 70 = PRODAT). Mezi 30 a 70 je klidné pásmo (DRŽET).",
        "2) SMA 20 a SMA 50 jsou klouzavé průměry za měsíc a za 2,5 měsíce. Když je cena nad oběma, akcie dlouhodoběji spíše roste.",
        "3) Nikdy se nerozhodujte jen podle jednoho čísla — vždy se podívejte i na zprávy o firmě a investujte jen peníze, které si můžete dovolit riskovat.",
      ],
      picks: [],
    };
  }

  function replyForEtfs(ctx) {
    const { allAnalyses, profile, settings } = ctx;
    const etfs = allAnalyses
      .filter((a) => a.hasData && a.rsi !== null && a.assetType === "ETF")
      .sort((a, b) => scoreForProfile(b, profile, settings) - scoreForProfile(a, profile, settings));

    if (etfs.length === 0) {
      return {
        title: "ETF zatím nejsou načtená",
        paragraphs: [
          "V aktuálním datasetu nebyla nalezena žádná ETF. Zkuste kliknout na „Načíst vše“ nebo vyčkejte na aktualizaci dat.",
        ],
        picks: [],
      };
    }

    const top = etfs.slice(0, 5);
    return {
      title: `Přehled ETF podle stylu: ${PROFILE_LABELS[profile]}`,
      paragraphs: [
        "ETF rozkládají riziko mezi stovky až tisíce firem (případně zlato či dluhopisy), takže bývají pro začátečníky klidnější než jednotlivé akcie. Pro české investory jsou oblíbená hlavně evropská UCITS ETF v eurech (VWCE.DE, SXR8.DE, EUNL.DE).",
        "Kliknutím na libovolné ETF níže zobrazíte jeho graf a technické ukazatele (obchodování je vždy na vlastní riziko):",
      ],
      picks: top.map((a) =>
        formatCandidateLine(a, `${a.sector} · ${a.outlook?.mediumTerm || ""}`)
      ),
    };
  }

  function answerQuestion(question, ctx) {
    const norm = normalizeText(question);

    // 1. Zmíněný konkrétní ticker nebo "vybranou akcii"
    if (norm.includes("vybran") || norm.includes("tuto akcii") || norm.includes("tuhle")) {
      if (ctx.selectedAnalysis) {
        return replyForSingleTicker(ctx.selectedAnalysis, ctx.settings);
      }
    }
    const mentioned = findMentionedTicker(question, ctx.allAnalyses);
    if (mentioned) {
      return replyForSingleTicker(mentioned, ctx.settings);
    }

    // 2. Záměry v češtině
    if (
      norm.includes("etf") ||
      norm.includes("index") ||
      norm.includes("zlato") ||
      norm.includes("dluhopis") ||
      norm.includes("svet")
    ) {
      return replyForEtfs(ctx);
    }

    if (
      norm.includes("prodat") ||
      norm.includes("prehrat") ||
      norm.includes("drah") ||
      norm.includes("korek")
    ) {
      return replyForOverbought(ctx);
    }

    if (
      norm.includes("klidn") ||
      norm.includes("bezpec") ||
      norm.includes("stabil") ||
      norm.includes("nizk") ||
      norm.includes("opatrn")
    ) {
      return replyForCalm(ctx);
    }

    if (
      norm.includes("trh") ||
      norm.includes("stav") ||
      norm.includes("vyvoj") ||
      norm.includes("prognoz") ||
      norm.includes("vyhled") ||
      norm.includes("nalad")
    ) {
      return replyForMarket(ctx);
    }

    if (
      norm.includes("jak funguje") ||
      norm.includes("co je rsi") ||
      norm.includes("co je sma") ||
      norm.includes("vysvetl") ||
      norm.includes("napoved")
    ) {
      return replyForEducation();
    }

    if (
      norm.includes("koupit") ||
      norm.includes("doporuc") ||
      norm.includes("nejzajimav") ||
      norm.includes("tip") ||
      norm.includes("vyber") ||
      norm.includes("kam invest") ||
      norm.includes("co dnes")
    ) {
      return replyForRecommendations(ctx);
    }

    // Výchozí užitečná odpověď s doporučením dle profilu
    return {
      title: "S čím vám mohu poradit?",
      paragraphs: [
        "Zkuste se zeptat například: „Co dnes koupit?“, „Které akcie jsou přehřáté?“, „Jaký je stav trhu?“, „Hledám klidnější akcie“ nebo napište název konkrétní akcie (třeba „AAPL“, „NVDA“ nebo „ČEZ“).",
        "Níže jsem rovnou vybral orientační tipy podle vašeho zvoleného stylu:",
      ],
      picks: replyForRecommendations(ctx).picks,
    };
  }

  global.AkcieAssistant = {
    PROFILE_LABELS,
    answerQuestion,
  };
})(window);
