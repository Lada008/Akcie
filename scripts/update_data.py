#!/usr/bin/env python3
"""Aktualizuje data/market-data.json denními uzavíracími cenami a tržními zprávami.

Skript používá pouze standardní knihovnu Pythonu (bez externích balíčků).
Pokud se nepodaří stáhnout data pro konkrétní ticker nebo RSS zdroj, zachová předchozí záznam.
"""

from __future__ import annotations

import email.utils
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT_DIR / "data" / "market-data.json"

USER_AGENT = "Mozilla/5.0 (compatible; AkcieSignalAdvisor/1.1)"

DEFAULT_TICKERS: list[dict[str, str]] = [
    # US Technologie & Polovodiče
    {"symbol": "AAPL", "name": "Apple Inc.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "currency": "USD", "sector": "Polovodiče"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "currency": "USD", "sector": "E-commerce"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "currency": "USD", "sector": "Technologie"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "currency": "USD", "sector": "Automobilový průmysl"},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "currency": "USD", "sector": "Polovodiče"},
    {"symbol": "INTC", "name": "Intel Corp.", "currency": "USD", "sector": "Polovodiče"},
    {"symbol": "NFLX", "name": "Netflix Inc.", "currency": "USD", "sector": "Média a streaming"},
    # US Finance, Zdravotnictví, Spotřeba, Energie
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "currency": "USD", "sector": "Finance"},
    {"symbol": "V", "name": "Visa Inc.", "currency": "USD", "sector": "Finance"},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway B", "currency": "USD", "sector": "Konglomerát"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "currency": "USD", "sector": "Zdravotnictví"},
    {"symbol": "UNH", "name": "UnitedHealth Group", "currency": "USD", "sector": "Zdravotnictví"},
    {"symbol": "KO", "name": "The Coca-Cola Co.", "currency": "USD", "sector": "Spotřební zboží"},
    {"symbol": "WMT", "name": "Walmart Inc.", "currency": "USD", "sector": "Maloobchod"},
    {"symbol": "XOM", "name": "Exxon Mobil Corp.", "currency": "USD", "sector": "Energetika"},
    # České & Evropské akcie
    {"symbol": "CEZ.PR", "name": "ČEZ, a. s.", "currency": "CZK", "sector": "Energetika"},
    {"symbol": "KOMB.PR", "name": "Komerční banka, a. s.", "currency": "CZK", "sector": "Finance"},
    {"symbol": "MONET.PR", "name": "MONETA Money Bank", "currency": "CZK", "sector": "Finance"},
    {"symbol": "ASML", "name": "ASML Holding N.V.", "currency": "USD", "sector": "Polovodiče (EU)"},
    {"symbol": "SAP", "name": "SAP SE", "currency": "USD", "sector": "Technologie (EU)"},
    # Populární indexové ETF
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "currency": "USD", "sector": "Indexové ETF (USA)"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust (Nasdaq-100)", "currency": "USD", "sector": "Indexové ETF (Tech)"},
]

MARKET_RSS_FEEDS: list[dict[str, str]] = [
    {"url": "https://www.patria.cz/rss/zpravy.rss", "source": "Patria.cz", "lang": "cs"},
    {"url": "https://finance.yahoo.com/news/rssindex", "source": "Yahoo Finance", "lang": "en"},
]


def http_get_bytes(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_yahoo_history(symbol: str, range_str: str = "6mo") -> tuple[list[dict[str, float | str]], str | None]:
    """Stáhne denní uzavírací ceny pro daný ticker z Yahoo Finance chart endpointu."""
    encoded = urllib.parse.quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range={range_str}&interval=1d"
    payload = json.loads(http_get_bytes(url).decode("utf-8"))

    chart = payload.get("chart", {})
    results = chart.get("result") or []
    if not results:
        raise ValueError(f"Prázdná odpověď pro {symbol}")

    result = results[0]
    meta = result.get("meta", {})
    currency = meta.get("currency")
    timestamps = result.get("timestamp") or []
    quote_list = result.get("indicators", {}).get("quote") or [{}]
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


def parse_rss_date(raw_date: str | None) -> str:
    if not raw_date:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        dt = email.utils.parsedate_to_datetime(raw_date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except (TypeError, ValueError):
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_rss_items(url: str, source_name: str, limit: int = 8, symbol: str | None = None) -> list[dict[str, str]]:
    raw = http_get_bytes(url, timeout=15)
    root = ET.fromstring(raw)
    items: list[dict[str, str]] = []

    for node in root.findall(".//item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        pub = parse_rss_date(node.findtext("pubDate"))
        if not title or not link:
            continue
        entry: dict[str, str] = {
            "title": title,
            "link": link,
            "publishedAt": pub,
            "source": source_name,
        }
        if symbol:
            entry["symbol"] = symbol
        items.append(entry)
        if len(items) >= limit:
            break

    return items


def fetch_market_news(existing_news: list[dict]) -> list[dict[str, str]]:
    collected: list[dict[str, str]] = []
    seen_titles: set[str] = set()

    for feed in MARKET_RSS_FEEDS:
        try:
            items = fetch_rss_items(feed["url"], feed["source"], limit=6)
            for it in items:
                key = it["title"].lower()
                if key not in seen_titles:
                    seen_titles.add(key)
                    collected.append(it)
            print(f"[OK] RSS {feed['source']}: {len(items)} zpráv")
        except Exception as exc:
            print(f"[WARN] Nepodařilo se načíst RSS {feed['source']}: {exc}", file=sys.stderr)

    if not collected and existing_news:
        return existing_news

    collected.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)
    return collected[:10]


def fetch_ticker_news(symbol: str) -> list[dict[str, str]]:
    encoded = urllib.parse.quote(symbol, safe="")
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={encoded}&region=US&lang=en-US"
    try:
        return fetch_rss_items(url, "Yahoo Finance", limit=3, symbol=symbol)
    except Exception:
        return []


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
    existing_news = existing.get("marketNews", []) if isinstance(existing, dict) else []

    updated_tickers: dict[str, dict] = {}
    success_count = 0

    for item in DEFAULT_TICKERS:
        symbol = item["symbol"]
        prev = existing_tickers.get(symbol, {})
        try:
            history, detected_currency = fetch_yahoo_history(symbol)
            news = fetch_ticker_news(symbol) or prev.get("news", [])
            updated_tickers[symbol] = {
                "symbol": symbol,
                "name": item["name"],
                "currency": detected_currency or item["currency"],
                "sector": item["sector"],
                "history": history,
                "news": news,
            }
            success_count += 1
            print(f"[OK] {symbol}: {len(history)} dnů (poslední {history[-1]['date']}: {history[-1]['close']})")
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            print(f"[WARN] Nepodařilo se aktualizovat {symbol}: {exc}", file=sys.stderr)
            if symbol in existing_tickers:
                updated_tickers[symbol] = existing_tickers[symbol]
        time.sleep(0.35)

    if success_count == 0 and not updated_tickers:
        print("[ERROR] Nepodařilo se získat žádná data.", file=sys.stderr)
        return 1

    market_news = fetch_market_news(existing_news)

    output = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance + RSS zprávy (denní aktualizace)",
        "marketNews": market_news,
        "tickers": updated_tickers,
    }

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Uloženo do {DATA_FILE} ({len(updated_tickers)} tickerů, {len(market_news)} tržních zpráv).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
