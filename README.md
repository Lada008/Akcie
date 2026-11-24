# Akciový rádce (RSI & SMA)

Statická webová aplikace v čistém HTML, CSS a JavaScriptu (bez externích frameworků a bez CORS problémů), připravená přímo pro **GitHub Pages**.

## Funkce
- **Správa vlastního seznamu tickerů**: přidávání a odebírání tickerů s automatickým ukládáním do `localStorage`.
- **Filtrování a vyhledávání**: rychlé filtry podle signálu (`Vše`, `KOUPIT`, `PRODAT`, `DRŽET`) a fulltextové vyhledávání podle tickeru, názvu nebo sektoru.
- **Technické indikátory počítané přímo v prohlížeči**:
  - **RSI (14 period)** — pod výchozí hranicí `30` signál **KOUPIT**, nad výchozí hranicí `70` signál **PRODAT**, mezi nimi **DRŽET** (hranice lze v rozhraní upravit).
  - **Klouzavé průměry** `SMA 20` a `SMA 50`.
  - **Procentní změna** za zvolené období (`5D`, `1M`, `3M`, `6M`, `Vše`).
  - **Stručné zdůvodnění signálu** u každého tickeru.
- **Interaktivní grafy**: po kliknutí na ticker se vykreslí cenový graf s křivkami `SMA 20` a `SMA 50` a synchronizovaný graf `RSI (14)`.
- **Data a záložní režim**: aplikace načítá data z `data/market-data.json`. Pokud soubor chybí nebo jej prohlížeč zablokuje (např. při otevření přes `file://`), přepne se do záložního režimu s ukázkovými demo daty. Mezi režimy lze kdykoli přepínat.

## Denní aktualizace dat (GitHub Actions)
Soubor [`.github/workflows/update-data.yml`](.github/workflows/update-data.yml) každý pracovní den ve `22:15 UTC` (a také ručně přes *Run workflow*) spustí skript [`scripts/update_data.py`](scripts/update_data.py), který stáhne aktuální denní uzavírací ceny do [`data/market-data.json`](data/market-data.json) a změny uloží do repozitáře.

Seznam sledovaných tickerů pro automatickou aktualizaci lze upravit v `DEFAULT_TICKERS` uvnitř `scripts/update_data.py`.

## Nasazení na GitHub Pages
1. Otevřete v repozitáři **Settings → Pages**.
2. Jako **Source** zvolte **Deploy from a branch**, větev `main` a složku `/ (root)`.
3. Po uložení bude aplikace dostupná na adrese `https://<uživatel>.github.io/<repozitář>/`.

## Upozornění
Tato aplikace neprovádí žádné automatické obchodování. Slouží výhradně jako analytický pomůckový nástroj podle nastavených technických pravidel, nikoliv jako investiční doporučení.
