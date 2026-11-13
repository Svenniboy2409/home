# ✦ Starport

Mijn startpagina voor al mijn apps en games: een donkere kosmische lounge met noorderlicht, twinkelende sterren en een warp-sprong naar elke app.

**Live:** <https://svenniboy2409.github.io/home/>

| Toets | Bestemming | Soort | Adres |
|---|---|---|---|
| `1` | Super Mario Wonderland | Game | <https://super-mario-wonderland.web.app> |
| `2` | DIY Board Games | Game | <https://diy-board-games.web.app> |
| `3` | Scent | Perfume Collection | <https://svenniboy2409.github.io/scent-perfume-app/> |
| `4` | Mixly | Cocktail Collection | <https://svenniboy2409.github.io/cocktail-app/> |
| `5` | Wenslijst | Gift Wishlists | <https://gift-app-beryl.vercel.app/> |
| `6` | Creami | Frozen Treat Recipes | <https://svenniboy2409.github.io/creami-app/> |

## Wat het kan

- **Drie weergaven**, te kiezen met de schakelaar rechtsboven (je keuze wordt onthouden):
  - **List:** de secties Games en Apps onder elkaar.
  - **Tiles:** één raster met kleine tegels voor de apps en grote 2×2-tegels voor de games, schuin tegenover elkaar.
  - **Orbit:** een planetenbaan, met de apps op de binnenring en de games (met Saturnusring) op de buitenring.

  Bij het wisselen vliegen de iconen naar hun nieuwe plek. Op weg naar een planeet worden ze geleidelijk rond, en op de terugweg weer vierkant.
- **Warp-sprong:** klik en de sterren schieten als hyperspace langs voordat de app opent. Ctrl/Cmd-klik opent gewoon een nieuw tabblad.
- **Lucht volgt de klok:** roze bij zonsopkomst, blauw overdag, oranje/paars bij zonsondergang, groen/paars noorderlicht 's avonds en diepblauw 's nachts. Ook de begroeting past zich aan.
- **Zoeken:** `/` of `Ctrl/Cmd + K`, typ bijvoorbeeld "ice" of "cocktail" en druk op Enter.
- **Sneltoetsen:** `1`–`6` opent direct een app (zie de tabel hierboven), `V` gaat naar de volgende weergave en `M` zet het geluid aan of uit.
- **Favorieten & recent:** met de ster pin je een app bovenaan (in de planetenbaan krijgt hij een gouden maantje). Onder "Jump back in" staan je laatst geopende apps.
- **Ambient geluid:** zacht ruimtegeluid, live gemaakt in de browser zonder geluidsbestanden. Staat standaard uit.
- **Parallax:** de sterren bewegen mee met je muis, of met het kantelen van je telefoon.
- **Vallende sterren:** klik erop om ze te vangen; Starport telt mee.
- **Easter egg:** tik 5× snel op het logo (of op het station in de planetenbaan), of probeer de Konami-code ↑↑↓↓←→←→BA.
- **Installeerbaar:** "Zet op beginscherm" geeft Starport een eigen icoon en laat hem schermvullend openen. De pagina werkt ook offline.
- Respecteert "beweging verminderen" op je telefoon of computer: dan staan de animaties uit.

## Een app toevoegen of een tekst aanpassen

Alles staat in **één bestand: [`js/apps.js`](js/apps.js)**. Elk blok daarin wordt een kaart, een tegel én een planeet. De volgorde bepaalt de sneltoetsen.

De beschrijvingen van de twee games zijn tijdelijke teksten, gemarkeerd met `// TODO: your own description`. Pas daar het `desc`-veld (en eventueel `kicker`) aan.

Een nieuwe app toevoegen? Kopieer een blok en pas de velden aan. Zet het icoon (vierkant, minstens 256×256) in `assets/apps/` en kies een `accent`- en `accent2`-kleur. Bij `kind` vul je `"app"` of `"game"` in.

> Heb je iets aangepast? Verhoog dan ook `VERSION` bovenaan [`sw.js`](sw.js) (bijv. `starport-v3`). Dan halen telefoons waarop Starport geïnstalleerd is de nieuwe versie op.

## Online zetten (GitHub Pages)

1. Merge de pull request naar `main`.
2. Ga in deze repo naar **Settings → Pages**.
3. Kies bij **Build and deployment → Source** voor **Deploy from a branch**, met branch **`main`** en map **`/ (root)`**. Klik **Save**.
4. Na een minuutje staat Starport op <https://svenniboy2409.github.io/home/>.

## Lokaal bekijken

Er is geen build-stap en er zijn geen dependencies: het is gewone HTML, CSS en JavaScript.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Tip: met `?hour=7` achter de URL zie je hoe de lucht er om 7 uur 's ochtends uitziet.

## Bestanden

```
index.html              de pagina
css/styles.css          alle opmaak en animaties
js/apps.js              ← de bestemmingen (dit pas je aan)
js/main.js              kaarten, warp, favorieten, sneltoetsen, easter egg
js/sky.js               sterrenhemel, vallende sterren, warp-effect
js/orbit.js             de planetenweergave
js/theme.js             kleuren van de lucht per tijdstip
js/search.js            het zoekpalet
js/sound.js             ambient geluid (Web Audio)
sw.js                   offline + installeerbaar
manifest.webmanifest    app-naam en iconen
assets/                 iconen en lettertypen (Space Grotesk & Inter, SIL Open Font License)
```
