// Manami's brain: a small, offline, keyword-based helper.
// Swap `reply` for a call to an LLM backend later without touching the chat UI.
import { MASCOT_NAME } from '../config.js';

export const SCREEN_TIPS = {
  experience: 'Pick the option that fits you best. New farmers get a short tip from me at the top of each page.',
  farm: 'Tell me if you keep livestock, then untick any crop you can’t grow or sell. I only plan with what’s ticked, and you can change it any time in Settings or from the Planner.',
  paddocks: 'Search for your farm, press “Draw paddock”, then click each corner. Click the first corner again (or press Enter) to close it. Corners snap onto neighbouring paddocks so they share an edge.',
  register: 'Every paddock in one table. Sort by any column, search by name, and click a row to open its details.',
  review: 'I sample the soil at both ends of every paddock. Where it changes a lot, I suggest splitting the paddock so each part can be managed for its own soil.',
  paddock: 'This is the paddock at a glance: its soil health, next crop, the safest sowing window and its ten-season plan.',
  history: '“Seen from space” shows what NASA satellites saw growing here each season. Press “Use as crop history”, or set any season by hand.',
  conditions: 'Soil, slope and climate are filled in for you from global datasets. A soil test from the paddock itself is always more accurate.',
  priorities: 'Slide each priority to show what matters most here, and tick why you rotate. The preview on the right updates as you go.',
  planner: 'Each row is a paddock and each column a season. Click a column (or use ← →) to see that season on the map, or click a cell to see why I chose that crop.',
  insights: 'Proof from your own farm: how cereals did after a break crop, rain each season, and the safest sowing windows from 30 years of NASA weather.',
  dashboard: 'Your farm at a glance. Alerts on the right link straight to the paddock that needs attention.',
  settings: 'Change your crop list, theme and tips here. Your farm is saved in this browser; export it to keep a copy.',
};

const INTENTS = [
  {
    test: /\b(what can you do|help me|how do i use|what do you do)\b/,
    answer: () =>
      `I can explain anything in the planner: drawing paddocks, the soil check, what NASA satellites saw on your paddocks, blackleg, sowing windows, soil health and why I picked each crop. Press Ctrl K any time to jump to a page or paddock.`,
  },
  {
    test: /\b(snap|snapping|share an edge|neighbouring paddock)/,
    answer: () => 'While you draw or reshape, corners lock onto a neighbouring paddock’s corners and edges, so paddocks share a boundary with no gaps or overlaps. Hold Alt to place a corner freely, or turn Snap off.',
  },
  {
    test: /\b(soil health|health index|health score)/,
    answer: () =>
      'Soil health is a 0–100 index. It starts from the paddock’s organic carbon and pH (from SoilGrids) minus known problems like erosion or salinity, then each season moves it up or down by the crop grown: legumes and pasture build it, cereal after cereal runs it down.',
  },
  {
    test: /\b(best guess|confiden|sure|likely|how certain)/,
    answer: () =>
      '“Sure” and “likely” seasons have a clear greenness curve, so I fill them in for you. “Best guess” means the curve could fit more than one crop (cereal vs pulse is my weakest call), so I only use it when you press “Use as crop history”.',
  },
  {
    test: /\b(shortcut|keyboard|ctrl|command|search)/,
    answer: () => 'Press Ctrl K (⌘ K on a Mac) to search pages, paddocks and actions. On the Planner, ← and → move between seasons. While drawing, Enter finishes, Backspace undoes and Esc cancels.',
  },
  {
    test: /\b(export|csv|download|print|backup)/,
    answer: () => 'On the Planner, “Export” saves the whole rotation as a CSV for Excel. In Settings you can export the farm as a file and import it again on another computer.',
  },
  {
    test: /\b(hi|hello|hey|g'?day|howdy)\b/,
    answer: () => `Hi! I'm ${MASCOT_NAME}, the farm sheep. Ask me about outlining paddocks, soil, slope, rainfall or crop rotations.`,
  },
  {
    test: /\b(thank|thanks|cheers|ta)\b/,
    answer: () => 'Any time! Baa :3',
  },
  {
    test: /\b(joke|funny|laugh)/,
    answer: () => 'What do you call a sheep with no legs? A cloud. Baa-ha-ha!',
  },
  {
    test: /\b(who are you|your name|what are you)\b/,
    answer: () => `I'm ${MASCOT_NAME}! I live in the paddocks and help you plan what to grow where.`,
  },
  {
    test: /\b(draw|outlin|boundar|corner|add (a )?paddock|polygon)/,
    answer: () =>
      'On the Farm map: search for your farm, press “Draw paddock”, click each corner of the paddock and click the first corner again (or press Enter) to finish. Backspace removes the last corner. No farm handy? Load the demo farm.',
  },
  {
    test: /\b(space|satellite|nasa image|landsat|sentinel|hls|from above|time-?lapse|seen from)/,
    answer: () =>
      'I read NASA’s HLS satellite images (Landsat + Sentinel-2, a 30 m picture every 2–3 days) for your farm over the last 5 seasons. From each paddock’s greenness curve I can tell when a crop greened up, peaked and dried off, and canola gives itself away by flowering bright yellow. Checked against USDA crop maps, I find canola 85–96% of the time; telling cereals from pulses is my weakest guess, so please correct me.',
  },
  {
    test: /\b(blackleg|stubble|spore|neighbou?r)/,
    answer: () =>
      'Blackleg is canola’s worst disease. Its spores blow from last year’s canola stubble, so growers keep new canola at least ~500 m away. I spot canola flowering around your farm from space and steer canola away from paddocks that are too close, and I tell you when I do.',
  },
  {
    test: /\b(sow|sowing|plant(ing)? date|frost|heat|flower(ing)? time)/,
    answer: () =>
      'The Sowing window card uses 30 years of NASA POWER daily temperatures. For each sowing date I work out when the crop would flower, then count how often frost hit at flowering and heat hit while the grain filled. The window is the run of dates with the lowest risk; it assumes mid-maturity varieties.',
  },
  {
    test: /(did .*work|\bvigou?r|\bproof|report card)/,
    answer: () =>
      'On the Dashboard, “Did my rotation work?” compares cereals grown after a break crop with cereals after cereals, using each season’s satellite greenness compared with the rest of your farm that year. It’s a first hint with only a few seasons, and it firms up every year.',
  },
  {
    test: /\b(livestock|cattle|graz\w*|no sheep|crops only|my crops|crop list|which crops|only grow|don'?t grow|can'?t grow|choose crops)\b/,
    answer: () =>
      'You choose what I plan with. On “Your Farm” (or “Your crops” on the Planner and in the menu), pick Crops only if you have no livestock, which removes grazed pasture, and untick any crop you can’t grow or sell. I’ll only pick from what’s ticked, and I’ll warn you if the list has no break crop.',
  },
  {
    test: /\b(split|suggest|accept|keep old|new paddock)/,
    answer: () =>
      'I sample the soil at both ends of each paddock. If texture, pH or clay content differ a lot, managing the two halves separately usually pays off — so I suggest a split. You can always keep your old paddocks.',
  },
  {
    test: /\b(ph\b|acid|alkalin|lime)/,
    answer: () =>
      'Soil pH comes from ISRIC SoilGrids (0–30 cm average). Below about 5.5 is acidic — lupins and oats cope well, barley, canola and most pulses don’t. Above about 8 is alkaline — barley and chickpeas cope better than lupins.',
  },
  {
    test: /\b(soil|textur|clay|sand|loam|carbon|organic)/,
    answer: () =>
      'The Soil card shows texture (from sand/silt/clay), pH and organic carbon from ISRIC SoilGrids — a global 250 m soil map. It’s a great starting point, but a soil test from your own paddock is always more accurate.',
  },
  {
    test: /\b(slope|steep|hill|elevation|aspect)/,
    answer: () =>
      'Slope is estimated from the Copernicus 90 m elevation model (via Open-Meteo) by comparing points 100 m around the paddock centre. Steeper paddocks erode more, so I favour crops that keep the ground covered there.',
  },
  {
    test: /\b(rain|climate|weather|nasa|power\b|moist|wet\b|dry|drought|temperature)/,
    answer: () =>
      'Rainfall, temperature and root-zone soil wetness come from NASA POWER, which blends satellite observations and models into long-term climate for any point on Earth. In dry places (under ~400 mm a year) I prefer low-water crops.',
  },
  {
    test: /\b(nitrogen|legume|pulse|lupin|peas?\b|bean|chickpea|lentil|fix)/,
    answer: () =>
      'Legumes (lupins, peas, beans, chickpeas, lentils, vetch, legume pasture) fix nitrogen from the air, so the next cereal needs less fertiliser. They’re especially valuable after two or more cereals in a row.',
  },
  {
    test: /\b(weed|herbicide|resist|ryegrass)/,
    answer: () =>
      'For herbicide-resistant weeds, mix up your tactics: a pasture phase grazed by sheep, a hay crop like vetch, or a competitive crop stops weeds setting seed. I boost those options when you tick weed problems.',
  },
  {
    test: /\b(disease|fung|break crop|crown rot|blackleg)/,
    answer: () =>
      'Cereal diseases build up when cereals follow cereals. A “break crop” such as canola or a legume starves them out. I add a bonus for breaking the cereal run when you tick Disease History or Disease Break.',
  },
  {
    test: /\b(salin|salt)/,
    answer: () => 'On saline ground, barley is the most tolerant grain crop, with faba beans and pasture also coping. I favour them when you tick Salinity.',
  },
  {
    test: /\b(waterlog|flood|soggy)/,
    answer: () => 'Waterlogging hurts most pulses. Faba beans, oats and pasture cope best, so I favour them when you tick Waterlogging.',
  },
  {
    test: /\b(erosion|erode|cover|bare)/,
    answer: () => 'Keep the ground covered: stubble-retaining cereals, oats, vetch and pasture protect the soil. Fallow and low-cover crops leave it bare.',
  },
  {
    test: /(\bprice|\bmarket|\bprofit|\bmoney|\bmargin|\$)/,
    answer: () =>
      'The prices shown are indicative example values (AUD per tonne) kept in src/data/crops.js — not live market data. Slide “Profit” up to give higher-margin crops more weight.',
  },
  {
    test: /\b(rotat|plan|what (should|to) (i )?grow|recommend|why\b)/,
    answer: () =>
      'For every season I score each crop on your priorities, the paddock’s history, its soil and climate, and the problems you ticked — avoiding the same crop family twice in a row. The Planner shows the best pick each season and why.',
  },
  {
    test: /\b(timeline|season|drag|strip)/,
    answer: () => 'On the Planner, click any season in the strip at the top (or use the arrows / ← → keys). Each dot is one paddock’s crop that season, and “Next” marks the coming season.',
  },
  {
    test: /\b(saved?\b|lose|lost|my data|privacy|account|password)/,
    answer: () => 'Everything you enter is saved in this browser only (local storage). Nothing is sent anywhere except anonymous location lookups for soil, slope and climate data.',
  },
];

export function reply(text, screen) {
  const t = text.toLowerCase();
  const hit = INTENTS.find((i) => i.test.test(t));
  if (hit) return hit.answer();
  const tip = SCREEN_TIPS[screen];
  return `I’m only a simple sheep, so I didn’t quite get that. Try asking about soil, slope, rainfall, nitrogen, weeds or crop rotation.${tip ? `\n\nTip for this screen: ${tip}` : ''}`;
}
