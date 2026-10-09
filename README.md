# TEAM SHEEEEP — paddock & crop-rotation planner

> **Visual version:** open [`docs/readme.html`](docs/readme.html) (screenshots, charts), the build plan in [`docs/plan.html`](docs/plan.html), and where we're up to in [`docs/tracker.html`](docs/tracker.html).

A web app in the look of the **TEAM SHEEEEP** Figma file (`design/TEAM SHEEEEP.fig`), built
out into a full planning workspace. Farmers outline their paddocks on a satellite map, the
app pulls soil, slope and climate data for each one (including **NASA POWER**), reads what
grew there from **NASA satellites**, and Manami the sheep helps plan the next ten seasons of
crop rotations.

## What makes it different: NASA Earth data that answers farmers' real questions

Rotation planners all ask the farmer to type in what grew where, and then guess. This one
**reads the farm's own past from space** and uses it.

| Feature | The farmer's problem | What the app does | NASA data |
| --- | --- | --- | --- |
| **Paddock Memory from Space** | Crop records are missing, especially on newly bought or leased land, and a rotation plan is only as good as its history. | Reads every clear satellite image of the farm over the last **5 seasons**, builds each paddock's greenness curve and names the crop family each season (cereal, canola, pulse, pasture, fallow) with a confidence level and the evidence. One click fills in the crop history. A time-lapse shows the real images. | HLS v2.0 (Landsat 8/9 + Sentinel-2, 30 m, every 2–3 days) |
| **Neighbour canola → blackleg warning** | Blackleg spores blow from last year's canola stubble, including the neighbour's, which the farmer can't see on paper. Growers try to keep ~500 m away. | Finds canola **flowering** in every field around the farm, shows it on the map, and when a paddock is within 500 m the planner steers next season's canola elsewhere and says why. | HLS (yellow-flower index during flowering) |
| **Safest sowing window** | Sow too early and frost hits at flowering; too late and heat hits during grain fill. Rules of thumb ignore the farm's own climate. | For every sowing date and crop, replays **30 years** of daily temperatures: thermal time to flowering, frost at flowering, heat during grain fill. Shows the risk curve and the lowest-risk window on the Planner. | POWER daily (T2M_MIN, T2M_MAX) |
| **"Did my rotation work?"** | Farmers rarely get evidence that their rotation pays off on their own farm. | Compares cereals grown after a break crop with cereals after cereals, using each season's satellite vigour relative to the rest of the farm that season, with rainfall and the water-limited yield benchmark for context. | HLS + POWER daily rain (PRECTOTCORR) |

Everything runs in the browser, needs no login or API key, and caches images so a farm is
read once (about 100 images, roughly 30 s the first time).

## Run it

Requires Node.js **22.15+** (for `npm run export:figma`; the app itself runs on Node 20.19+).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run test:e2e   # browser checks (with npm run dev running)
npm run validate:phenology   # crop-from-space accuracy vs. USDA crop maps
```

No API keys are needed. The project lives in OneDrive, so `node_modules/` will sync —
consider pausing OneDrive sync for this folder or excluding `node_modules`.

## The app

After signing in, everything lives in one workspace: a dark soil-coloured **sidebar**
(Overview, Farm map, Paddocks, Planner, Insights, Settings; it collapses to icons), a **top
bar** with breadcrumbs, **Ctrl K search** (pages, paddocks and actions), a live **satellite
status** pill, a **light/dark** switch and **Ask Manami**, who opens as a side panel. New
farmers get one short tip from her at the top of each page instead of a bubble over the
content. Long jobs (satellite read, soil, slope, climate) run in the background with progress
shown in place; the plan updates as the data arrives. Changes pop up as notices, and deleting a
paddock can be undone.

**Setup** (first visit) is six steps with a progress bar on each page and a "Getting started"
card in the sidebar: About you → Crops → Paddocks → Soil check → Paddock details → Your plan.
"Try the demo farm" skips straight to the Overview.

| Route | Page | What it does |
| --- | --- | --- |
| `#/` | Sign in | The meadow scene with a sign-in card. Front-end only: it names the local profile; passwords are never stored. "Try the demo farm" loads four paddocks near Wagga Wagga. Returning users get "Continue as …". |
| `#/dashboard` | Overview | Greeting with next season's crops, the sowing window and blackleg count; KPI tiles (farm area, soil health after the plan, crops next season, items needing attention); farm map coloured by crop for any of the next five seasons; **Needs attention** list (blackleg risks, missing history, soil gaps, one-crop seasons, crop-list warnings), each linking to the fix; soil-health outlook chart with the range across paddocks; crop-mix donut; paddock table; **Did my rotation work?**; recent activity; status of every data source. |
| `#/experience` | About you | New or experienced farmer (tips on or off; change any time in Settings). |
| `#/farm` | Crops and livestock | **Do you keep livestock?** (“Crops only” removes grazed pasture) and **which crops can you grow and sell?** The plan only ever picks ticked crops. Warns when the list has no break crop or no legume. Also reachable from Settings, the Planner and the account menu. |
| `#/paddocks` | Farm map | Place search, a paddock list beside the map, **Draw paddock**. Corners snap to neighbouring paddocks within 14 screen pixels (so zooming in keeps real gaps), two clicks on a neighbour's border trace it, Alt or the Snap switch places corners freely, and any overlap is trimmed automatically. Select a paddock to edit its shape, open it or delete it (with Undo). |
| `#/paddocks/review` | Soil check | Samples the soil at both ends of each paddock, with a live list showing each paddock's progress. It suggests a split when the soil really differs: a texture change backed by ≥4 % clay or ≥6 % sand difference, or pH ±0.5, or clay ±8 %. Accept, or keep the old paddocks and note why. |
| `#/register` | Paddocks | Every paddock in one sortable, searchable table: area, soil, pH, slope, last season (from space or typed), next season, soil-health meter and flags. |
| `#/paddocks/:id` | Paddock · Overview | Soil health after the plan, next crop and why, blackleg distance, the ten-season plan, the paddock's soil-health chart and its sowing window. A rail on the right keeps the map and the next five seasons in view on every tab; arrows step to the previous/next paddock. |
| `#/paddocks/:id/history` | Paddock · History | **Seen from space** (crop per season, confidence, greenness sparkline, time-lapse, “Use as crop history”, blackleg alert), the last three seasons (showing what the satellite saw for any blank season), known issues, notes. |
| `#/paddocks/:id/conditions` | Paddock · Conditions | Soil (SoilGrids), slope and terrain (Copernicus DEM) and climate (NASA POWER), and how the starting soil health is worked out. |
| `#/paddocks/:id/priorities` | Paddock · Priorities | Four sliders (soil health, water saving, profit, play it safe) with a **live preview** of the next seasons, reasons for rotating, indicative prices. In setup it repeats for each paddock, then goes to the Planner. |
| `#/planner` | Planner | KPI tiles (soil health after 10 seasons, share of break crops, crops per season, blackleg steering); the **rotation grid** (rows are paddocks, columns are seasons; click a season or use ←/→, click any cell for **why that crop**, its soil-health effect and how the alternatives scored); the map for the selected season (with last season's neighbour canola in season 1); crops to grow; **sowing window**. **Export CSV**, **Print**, and the crop list button. |
| `#/insights` | Insights | Did my rotation work?, growing-season rain by season against the long-term normal, **paddock memory from space** as one grid (every paddock × every season), neighbour-canola distances against the 500 m line, sowing windows for every crop on the list. |
| `#/settings` | Settings | Profile and guidance (tips), crops and livestock, theme (light, dark, system) and compact sidebar, export/import the farm as a file, re-read the satellites, delete the farm. |

Everything you enter is saved in the browser’s `localStorage` (`sheeep:v1`); theme and sidebar
preferences are kept separately (`sheeep:theme`, `sheeep:sidebar`).

## Data sources

| Card | Source | Notes |
| --- | --- | --- |
| Soil: texture, pH, clay/sand, organic carbon | [ISRIC SoilGrids 2.0](https://rest.isric.org) | 250 m global maps, 0–30 cm depth-weighted. Fair use is about 5 requests/minute, so requests are spaced, cached for 30 days, time out after 20 s, and the UI offers “Try again” when the service is down. |
| Soil: rainfall, root-zone moisture | [NASA POWER](https://power.larc.nasa.gov) | Long-term agroclimatology (PRECTOTCORR, T2M, GWETROOT). |
| Crop history from space, neighbour canola, vigour | [NASA HLS v2.0](https://lpdaac.usgs.gov/products/hlss30v002/) (HLSL30 + HLSS30) via [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/dataset/hls2-s30) | STAC search, then the data API returns small per-farm PNGs holding NDVI, the yellow-flower index and the Fmask cloud mask. Planetary Computer is used because it serves NASA's HLS to browsers without a login (NASA's LP DAAC copy needs Earthdata login). Images are kept in Cache Storage (`sheeep-hls-v1`). |
| Time-lapse pictures | Sentinel-2 L2A (ESA Copernicus) via Planetary Computer | HLS's Sentinel scenes are Sentinel-2 passes resampled to 30 m, so pictures from those passes use the original **10 m** image of the same pass (3× sharper, 9× the detail). For Landsat passes the picture is the nearest Sentinel-2 pass that is clear over the farm itself (checked with Sentinel-2's scene classification), within 12 days (5 for the flowering picture); if there is none, the 30 m picture is kept and labelled. The canola-flowering picture is chosen by how yellow the canola *looks* in true colour, and a 10 m pass wins if it looks at least ~83% as yellow. Analysis still uses NASA HLS. |
| Sowing window, season rainfall | [NASA POWER daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | T2M_MIN, T2M_MAX, PRECTOTCORR for the last 30 complete years, one request per farm, cached (`sheeep-power-v1`). |
| Slope, aspect, elevation | [Open-Meteo elevation API](https://open-meteo.com/en/docs/elevation-api) | Copernicus 90 m DEM. A plane is fitted (least squares) to elevations sampled across the whole paddock, so slope is the paddock average. |
| Place search | [OpenStreetMap Nominatim](https://nominatim.org) | One request per search. |
| Map imagery | Esri World Imagery | Via Leaflet. |
| Prices | `src/data/crops.js` | **Indicative example values only, not live market data.** |

## Accuracy

These checks were run against independent references (Oct 2026):

| What | Result |
| --- | --- |
| Paddock area vs. WGS84 geodesic (geographiclib) | within 0.001 % from 1 ha to 40,000 ha, including at 60° latitude |
| Soil sample point | always inside the paddock, including U-shaped and crescent paddocks and their split halves |
| USDA texture class | 22/22 reference cases, with sand/silt/clay normalised to 100 % |
| SoilGrids units | verified against the live API (`d_factor`: pH×10, g/kg→%, dg/kg and cg/kg→g/kg); 0–30 cm depth-weighted |
| Slope fit | recovers known synthetic slopes to ±0.02 % and the right facing direction |
| Drawing | double-click and Enter finish with exactly the clicked corners; crossed outlines and tiny mis-clicks are rejected; corner drag/add/remove update the shape and re-fetch its data |
| Priority sliders | each one moves the plan in the right direction across its range (monotone); click, drag and keyboard values match the handle position |

Limits worth knowing: SoilGrids is a 250 m model (paddocks smaller than that sample the same cell at both ends), NASA POWER climate is regional (~50 km), and the DEM is 90 m.

### Paddock Memory from Space: how accurate is it?

Checked against an independent ground truth, the **USDA Cropland Data Layer** (which maps
the crop in every 30 m pixel of the US), over canola country in Cavalier County, North
Dakota. Every uniform 150 m block (about 5,500 per season) was classified by the app's own
code from HLS images and compared with the CDL. 2021 was used while developing; **2020 was
held out** and only checked at the end. Reproduce it with `npm run validate:phenology`.

| | 2021 (development) | 2020 (held out) |
| --- | --- | --- |
| Canola found (recall) | 85.3 % | 95.7 % |
| Canola right when called (precision) | 94.1 % | 89.2 % |
| Crop family right (cereal / canola / pulse / pasture / fallow) | 78.3 % | 87.7 % |
| Neighbour-canola map, per pixel (precision / recall) | 83.7 % / 64.6 % | 79.7 % / 86.7 % |

Where it goes wrong, so the app says so too:
- **Cereal vs. pulse** is the weakest call (peas were read as cereal or canola about half the time, and 26 % of 2021 wheat was read as pulse). The app marks these as low confidence (“best guess”) and does not fill them in automatically.
- **Sunflower** flowers yellow too and was read as canola in 2021. It is rare in Australian winter cropping, but worth knowing in the US.
- **Fallow** is sometimes read as a weedy pulse.
- Thresholds were tuned on 2021 only. A tuned version that fitted 2021 better did worse on 2020, so the simpler rules were kept.
- The validation is in North Dakota, a different climate from Australia; seasons are set by latitude (southern: April–January, flowering mid-July to 10 October).

### Reading paddocks from pure pixels

Pixels on a paddock's edge mix in fences, tracks and the neighbour's crop, so each paddock is read only from pixels lying wholly inside it (falling back to all its pixels when fewer than 6 are pure). Tested on whole USDA fields (same-crop patches of the Cropland Data Layer), crop-type accuracy went up in both years. Reproduce with `npm run validate:pixels`.

| Field size | 2021 all → pure pixels | 2020 (held out) all → pure pixels |
| --- | --- | --- |
| 5–20 ha | 57.4 % → 67.6 % | 48.5 % → 51.5 % |
| 20–60 ha | 62.3 % → 79.2 % | 72.5 % → 77.5 % |
| > 60 ha | 68.1 % → 84.7 % | 88.0 % → 92.8 % |

(Patches under 5 ha are mostly speckle in the CDL itself, so they are not reported.)

### Tested and not adopted: a 10 m canola map

Sentinel-2 at 10 m would make the neighbour-canola map sharper, so it was tested against the 30 m HLS map on the same 8 × 8 km of North Dakota, with the same detector, scored on field interiors (`npm run validate:canola10m`). HLS found much more of the canola (recall 73.4 % vs 45.7 % in 2021, 91.9 % vs 58.5 % in 2020) with similar or better precision, so the analysis stays on NASA HLS. It wasn't Sentinel-2's cloud mask: very yellow canola pixels are labelled clear vegetation. Re-tuning the detector for Sentinel-2 could close the gap, but with two years of ground truth that risks overfitting, and the blackleg rule works at 500 m, where ±30 m hardly matters. 10 m is used for pictures only.

### Sowing window and rotation report: what to keep in mind

- Thermal times in `src/logic/sowing.js` are typical mid-maturity values for south-eastern Australia; varieties differ by a few weeks. Frost counts from ≤ 1 °C because a POWER grid cell (~50 km) is milder than a cold paddock floor. The window is the run of dates within 8 percentage points of the lowest combined risk. On the demo farm (NSW Riverina, near Wagga Wagga) it suggests wheat around 29 April and canola 6–13 May, in line with local guides.
- The rotation report compares relative vigour (area under the greenness curve, 1.00× = the farm's cropped paddocks that season). With 5 seasons and a few paddocks it is a first hint, and the card says so until there are at least 2 cases on each side.

## How the planner decides

`src/logic/rotation.js` scores every crop for every future season and picks the best:

- **Priorities** (the four sliders, 0–100, 50 = neutral) weight soil benefit, water use, margin and risk. Their strengths are in `PRIORITY_STRENGTH` (`src/logic/rotation.js`), tuned so every slider changes the plan across its range without overriding the rotation rules. Water Saving has the smallest effect because the rotation rules already favour low-water legumes.
- **Rotation rules**: no repeating a crop or crop family back to back; cereals score well after a break crop or legume; break crops score well after a run of cereals; legumes get a nitrogen bonus; rotations are kept varied.
- **Issues and goals** (checkboxes): e.g. salinity favours barley, waterlogging favours faba beans and oats, herbicide-resistant weeds favour pasture and hay.
- **Your crop list** (`src/logic/cropSet.js`): only the crops the farmer ticked are scored, and “Crops only” (no livestock) removes grazed pasture. The plan, the Priorities preview and the Dashboard all use the same list.
- **Site data**: acidic soil favours lupins and oats, alkaline soil barley and chickpeas, and dry climates (under 400 mm) favour low-water crops.
- **From space** (`src/logic/spacePlanning.js`): blank history is filled from confident satellite readings, and if canola flowered within 500 m last season (`BLACKLEG_DISTANCE_M`) canola is heavily penalised for the coming season, with a note explaining why.

The soil-health index starts from organic carbon, pH and known issues, and each season’s crop nudges it up or down.
The crop attributes in `src/data/crops.js` are deliberately simple so the team can tune them.

Manami’s answers come from a small offline keyword matcher in `src/logic/manami.js`.
Replace `reply()` with a call to an LLM backend to make her smarter without touching the chat UI.

## Design → code

- **Theme**: the Figma palette (charcoal, teal, olive, gold, rose, taupe, cream, ink) and Lato are kept. `src/styles/tokens.css` turns them into semantic tokens (`--bg`, `--surface`, `--text`, `--border`, status colours…) with a **light** theme on warm cream and a **dark** theme on soil brown. The Figma button fills and label colours are unchanged; extra tones (ghost, subtle, plain) cover dense tool UI.
- **UI kit** (`src/components/ui.jsx`, `src/styles/ui.css`): buttons, cards, KPI tiles with animated numbers, badges, crop chips, tabs, segmented controls, fields, checkboxes, switches, tables, skeletons, empty states, tooltips, modals, a side drawer and toasts. Icons are Lucide line icons behind one name map (`src/components/Icon.jsx`). Charts (`src/components/charts.jsx`) are small SVG components with hover tooltips: line with crosshair, donut, bars, sparklines and meters.
- **App shell** (`src/components/shell/`): sidebar, top bar, Ctrl K command palette, Manami's panel and the background loaders for satellite, soil, slope and climate data.
- **Artwork** (`src/assets/`): the scenes, sheep and Manami are exported straight from the `.fig` file as SVG by `tools/figma-export`. The meadow scene stays on the sign-in page (click a sheep and it hops); the sheep mark each paddock and Manami sits in the sidebar, the top bar and her panel. Motion is disabled under `prefers-reduced-motion`.
- **Layout**: the app fills the window at its real size (no page zoom). The sidebar collapses to icons, wide tables scroll sideways, and below 960 px the sidebar becomes a slide-out menu. `npm run test:e2e -- fit` checks that no page scrolls as a whole or is wider than the window.

### Re-exporting artwork after design changes

```bash
npm run export:figma                      # reads design/TEAM SHEEEEP.fig
npm run export:figma -- path/to/new.fig   # or another export of the file
```

The exporter (`tools/figma-export/`) decodes the `.fig` binary (Kiwi schema + zstd), then
renders nodes to SVG using Figma’s own pre-computed vector geometry, so boolean
operations, strokes and text outlines match the editor. Node IDs live in `export.mjs`. If a
frame is rebuilt in Figma, update its ID there (select the layer; the URL shows
`node-id=25-1867`, which becomes `25:1867`).

## Project structure

```
design/                 the source .fig file
tools/figma-export/     .fig decoder + SVG renderer + asset manifest
tools/validation/       checks the crop-from-space classifier against the USDA Cropland Data Layer
tools/e2e/              browser checks (drawing, snapping, sliders, soil split, mobile, NASA flow,
                        setup flow, fit); _doc-shots.mjs refreshes docs/img
docs/                   visual README, build plan and project tracker (open in a browser)
src/
  App.jsx               routes (hash router, lazy-loaded screens)
  config.js             app name, mascot name, planning horizon, sowing date
  screens/              one file per page (Login, Dashboard, OutlinePaddocks, Planner, Insights…)
  components/           shell/ (sidebar, top bar, search, Manami), Page, UI kit, charts,
                        PaddockMap (Leaflet), PaddockTable, SpaceHistoryCard, TimeLapse, SowingCard…
  state/                store (useReducer + localStorage, activity log), useFarm (plan, alerts),
                        site data, space and weather hooks, toasts, preferences (theme, sidebar)
  services/             SoilGrids, NASA POWER (climate + daily), NASA HLS (hls.js), farm analysis
                        from space (space.js), Open-Meteo, Nominatim (+ cached fetch helper)
  logic/                rotation planner, crop classifier (phenology.js), sowing risk (sowing.js),
                        rotation report (performance.js), snapping/overlap, geometry, Manami's replies
  data/                 crop knowledge base, demo farm
  styles/               tokens (light/dark), base, ui kit, shell, charts, one file per page area, map, scene
```

## Known gaps / next steps

- **Auth**: there is no backend yet. Login only names the local profile.
- **App name**: the design says “Webapp Name”; change it in `src/config.js` and `index.html`.
- **Prices**: these are static examples. Connect a market feed in `src/services/`.
- **Crop from space**: telling cereals from pulses needs more than greenness. Adding Sentinel-1 radar (sees crop structure through cloud) or training on labelled Australian paddocks (e.g. ABARES land-use maps) would sharpen it.
- **Sowing window**: lets the farmer pick a variety (early/mid/late maturity) instead of assuming mid-maturity.
- **Soil split**: this is a two-sample heuristic per paddock. Proper soil-zone mapping (e.g. from a SoilGrids raster or EM survey) would sharpen the suggestions.
