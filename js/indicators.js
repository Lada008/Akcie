(function (global) {
  "use strict";

  /**
   * Vypočítá jednoduchý klouzavý průměr (SMA) pro zadanou periodu.
   * @param {number[]} closes
   * @param {number} period
   * @returns {(number|null)[]}
   */
  function calculateSMA(closes, period) {
    const result = new Array(closes.length).fill(null);
    if (!Array.isArray(closes) || closes.length < period || period <= 0) {
      return result;
    }

    let rollingSum = 0;
    for (let i = 0; i < closes.length; i++) {
      rollingSum += closes[i];
      if (i >= period) {
        rollingSum -= closes[i - period];
      }
      if (i >= period - 1) {
        result[i] = rollingSum / period;
      }
    }
    return result;
  }

  /**
   * Vypočítá Wilderův indikátor RSI pro zadanou periodu (výchozí 14).
   * @param {number[]} closes
   * @param {number} period
   * @returns {(number|null)[]}
   */
  function calculateRSI(closes, period = 14) {
    const result = new Array(closes.length).fill(null);
    if (!Array.isArray(closes) || closes.length <= period || period <= 0) {
      return result;
    }

    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) {
        gainSum += diff;
      } else {
        lossSum += -diff;
      }
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return result;
  }

  /**
   * Procentní změna za zvolené období (počet obchodních dnů).
   * @param {number[]} closes
   * @param {number} lookbackDays
   * @returns {number|null}
   */
  function calculatePercentChange(closes, lookbackDays) {
    if (!Array.isArray(closes) || closes.length < 2) {
      return null;
    }
    const lastIdx = closes.length - 1;
    const baseIdx =
      lookbackDays > 0 ? Math.max(0, lastIdx - lookbackDays) : 0;
    const basePrice = closes[baseIdx];
    const latestPrice = closes[lastIdx];
    if (!basePrice || basePrice === 0) {
      return null;
    }
    return ((latestPrice - basePrice) / basePrice) * 100;
  }

  function formatNumber(val, digits = 2) {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    return Number(val).toLocaleString("cs-CZ", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatPrice(val, currency = "USD") {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    const formatted = formatNumber(val, 2);
    if (currency === "CZK") return `${formatted} Kč`;
    if (currency === "EUR") return `${formatted} €`;
    if (currency === "USD") return `$${formatted}`;
    return `${formatted} ${currency}`;
  }

  function formatPercent(val) {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    const sign = val > 0 ? "+" : "";
    return `${sign}${formatNumber(val, 2)} %`;
  }

  /**
   * Kompletní analýza tickeru: RSI(14), SMA 20, SMA 50, % změna, signál a zdůvodnění.
   */
  function analyzeTicker(tickerData, options = {}) {
    const buyThreshold = Number(options.buyThreshold ?? 30);
    const sellThreshold = Number(options.sellThreshold ?? 70);
    const periodDays = Number(options.periodDays ?? 21);

    const history = Array.isArray(tickerData?.history) ? tickerData.history : [];
    const closes = history.map((pt) => Number(pt.close));
    const dates = history.map((pt) => pt.date);

    if (closes.length < 15) {
      return {
        symbol: tickerData?.symbol || "",
        name: tickerData?.name || tickerData?.symbol || "",
        currency: tickerData?.currency || "USD",
        sector: tickerData?.sector || "—",
        hasData: false,
        signal: "DRŽET",
        reason: "Nedostatek historických dat pro výpočet RSI (min. 15 obchodních dnů).",
        latestPrice: closes.length ? closes[closes.length - 1] : null,
        latestDate: dates.length ? dates[dates.length - 1] : null,
        rsi: null,
        sma20: null,
        sma50: null,
        percentChange: null,
        series: { dates, closes, sma20: [], sma50: [], rsi: [] },
      };
    }

    const sma20Series = calculateSMA(closes, 20);
    const sma50Series = calculateSMA(closes, 50);
    const rsiSeries = calculateRSI(closes, 14);

    const lastIdx = closes.length - 1;
    const latestPrice = closes[lastIdx];
    const latestDate = dates[lastIdx];
    const latestRsi = rsiSeries[lastIdx];
    const latestSma20 = sma20Series[lastIdx];
    const latestSma50 = sma50Series[lastIdx];
    const percentChange = calculatePercentChange(closes, periodDays);

    let signal = "DRŽET";
    if (latestRsi !== null && latestRsi < buyThreshold) {
      signal = "KOUPIT";
    } else if (latestRsi !== null && latestRsi > sellThreshold) {
      signal = "PRODAT";
    }

    // Sestavení stručného a srozumitelného zdůvodnění signálu i pro začátečníky
    const parts = [];
    if (signal === "KOUPIT") {
      parts.push(
        `RSI je ${formatNumber(latestRsi, 1)} (pod hranicí ${buyThreshold} — akcie v posledních dnech výrazně oslabila).`
      );
    } else if (signal === "PRODAT") {
      parts.push(
        `RSI je ${formatNumber(latestRsi, 1)} (nad hranicí ${sellThreshold} — akcie rychle vyrostla a může být přehřátá).`
      );
    } else {
      parts.push(
        `RSI je ${formatNumber(latestRsi, 1)} (v klidném pásmu ${buyThreshold}–${sellThreshold}, bez extrému).`
      );
    }

    if (latestSma20 !== null && latestSma50 !== null) {
      const above20 = latestPrice >= latestSma20;
      const trendUp = latestSma20 >= latestSma50;
      if (above20 && trendUp) {
        parts.push("Cena je nad měsíčním i dlouhodobějším průměrem (rostoucí trend).");
      } else if (!above20 && !trendUp) {
        parts.push("Cena je pod měsíčním i dlouhodobějším průměrem (klesající trend).");
      } else if (above20 && !trendUp) {
        parts.push("Cena se vrátila nad měsíční průměr, dlouhodobější průměr ale ještě klesá.");
      } else {
        parts.push("Cena krátkodobě klesla pod měsíční průměr, celkový trend je ale zatím rostoucí.");
      }
    } else if (latestSma20 !== null) {
      parts.push(
        latestPrice >= latestSma20
          ? "Cena se drží nad měsíčním průměrem (SMA 20)."
          : "Cena se pohybuje pod měsíčním průměrem (SMA 20)."
      );
    }

    return {
      symbol: tickerData.symbol,
      name: tickerData.name || tickerData.symbol,
      currency: tickerData.currency || "USD",
      sector: tickerData.sector || "—",
      isSimulated: Boolean(tickerData.isSimulated),
      hasData: true,
      signal,
      reason: parts.join(" "),
      latestPrice,
      latestDate,
      rsi: latestRsi,
      sma20: latestSma20,
      sma50: latestSma50,
      percentChange,
      series: {
        dates,
        closes,
        sma20: sma20Series,
        sma50: sma50Series,
        rsi: rsiSeries,
      },
    };
  }

  global.AkcieIndicators = {
    calculateSMA,
    calculateRSI,
    calculatePercentChange,
    analyzeTicker,
    formatNumber,
    formatPrice,
    formatPercent,
  };
})(window);
