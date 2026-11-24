#!/usr/bin/env python3
"""Aktualizuje data/market-data.json denními uzavíracími cenami z Yahoo Finance.

Skript nevyžaduje žádné externí Python balíčky (používá pouze standardní knihovnu).
Pokud se nepodaří stáhnout data pro konkrétní ticker, zachová jeho předchozí záznam.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT_DIR / "data" / "market-data.json"

DEFAULT_TICKERS: list[dict[str, str]] = [
    {"symbol": "AAPL", "name": "Apple Inc.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "currency": "USD", "sector": "Polovodiče"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "currency": "USD", "sector": "E-commerce"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "currency": "USD", "sector": "Automobilový průmysl"},
    {"symbol": "INTC", "name": "Intel Corp.", "currency": "USD", "sector": "Polovodiče"},
    {"symbol": "KO", "name": "The Coca-Cola Co.", "currency": "USD", "sector": "Spotřební zboží"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "currency": "USD", "sector": "Zdravotnictví"},
    {"symbol": "CEZ.PR", "name": "ČEZ, a. s.", "currency": "CZK", "sector": "Energetika"},
    {"symbol": "KOMB.PR", "name": "Komerční banka, a. s.", "currency": "CZK", "sector": "Finance"},
]


def fetch_yahoo_history(symbol: str, range_str: str = "6mo") -> tuple[list[dict[str, float | str]], str | None]:
    """Stáhne denní uzavírací ceny pro daný ticker z Yahoo Finance chart endpointu."""
    encoded = urllib.parse.quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range={range_str}&interval=1d"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; AkcieSignalAdvisor/1.0)",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    chart = payload.get("chart", {})
    results = chart.get("result") or []
    if not results:
        raise ValueError(f"Prázdná odpověď pro {symbol}")

    result = results[0]
    meta = result.get("meta", {})
    currency = meta.get("currency")
    timestamps = result.get("timestamp") or []
    quote_list = (result.get("indicators", {}).get("quote") or [{}])
    closes = quote_list[0].get("close") or []

    history: list[dict[str, float | str]] = []
    seen_dates: set[str] = set()
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        date_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        if date_str in seen_dates:
            continue
        seen_dates.add(date_str)
        history.append({"date": date_str, "close": round(float(close), 2)})

    if len(history) < 20:
        raise ValueError(f"Nedostatek historických dat pro {symbol} ({len(history)} bodů)")

    return history, currency


def load_existing() -> dict:
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def main() -> int:
    existing = load_existing()
    existing_tickers = existing.get("tickers", {}) if isinstance(existing, dict) else {}

    updated_tickers: dict[str, dict] = {}
    success_count = 0

    for item in DEFAULT_TICKERS:
        symbol = item["symbol"]
        try:
            history, detected_currency = fetch_yahoo_history(symbol)
            updated_tickers[symbol] = {
                "symbol": symbol,
                "name": item["name"],
                "currency": detected_currency or item["currency"],
                "sector": item["sector"],
                "history": history,
            }
            success_count += 1
            print(f"[OK] {symbol}: {len(history)} obchodních dnů (poslední {history[-1]['date']}: {history[-1]['close']})")
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            print(f"[WARN] Nepodařilo se aktualizovat {symbol}: {exc}", file=sys.stderr)
            if symbol in existing_tickers:
                updated_tickers[symbol] = existing_tickers[symbol]
        time.sleep(0.4)

    if success_count == 0 and not updated_tickers:
        print("[ERROR] Nepodařilo se získat žádná data.", file=sys.stderr)
        return 1

    output = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance (denní uzavírací ceny)",
        "tickers": updated_tickers,
    }

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Uloženo do {DATA_FILE} ({len(updated_tickers)} tickerů, aktualizováno {success_count}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
