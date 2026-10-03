// Crop knowledge used by the rotation planner.
// Scores are relative 1 (low) .. 3 (high) and are deliberately simple so agronomists on the
// team can tune them. `soil` is the effect on soil health per season (-3 .. +4).
//
// `price` values are INDICATIVE EXAMPLES in AUD per tonne for demo purposes only — they are
// not live market data. Replace them, or wire up a market feed in src/services/.
export const CROPS = [
  { id: 'wheat', name: 'Wheat', family: 'cereal', color: '#cfb173', water: 2, salinity: 2, waterlogging: 1, cover: 2, acid: 2, alkaline: 2, soil: -2, profit: 3, risk: 2, weedControl: 0, price: 340 },
  { id: 'barley', name: 'Barley', family: 'cereal', color: '#d9c48f', water: 2, salinity: 3, waterlogging: 1, cover: 2, acid: 1, alkaline: 3, soil: -2, profit: 2, risk: 1, weedControl: 1, price: 290 },
  { id: 'oats', name: 'Oats', family: 'cereal', color: '#e2d3a8', water: 2, salinity: 2, waterlogging: 2, cover: 3, acid: 3, alkaline: 2, soil: -1, profit: 1, risk: 1, weedControl: 1, price: 270 },
  { id: 'canola', name: 'Canola', family: 'oilseed', color: '#e0be4a', water: 2, salinity: 2, waterlogging: 1, cover: 1, acid: 2, alkaline: 2, soil: 1, profit: 3, risk: 3, weedControl: 2, price: 690 },
  { id: 'lupins', name: 'Lupins', family: 'pulse', color: '#b5a4c9', water: 1, salinity: 1, waterlogging: 1, cover: 1, acid: 3, alkaline: 1, soil: 3, profit: 2, risk: 2, weedControl: 0, fixesN: true, price: 400 },
  { id: 'field-peas', name: 'Field Peas', family: 'pulse', color: '#9fb07a', water: 2, salinity: 1, waterlogging: 1, cover: 1, acid: 2, alkaline: 3, soil: 3, profit: 2, risk: 2, weedControl: 1, fixesN: true, price: 420 },
  { id: 'chickpeas', name: 'Chickpeas', family: 'pulse', color: '#c9a77c', water: 1, salinity: 1, waterlogging: 1, cover: 1, acid: 1, alkaline: 3, soil: 2, profit: 3, risk: 3, weedControl: 0, fixesN: true, price: 650 },
  { id: 'faba-beans', name: 'Faba Beans', family: 'pulse', color: '#8a9a5b', water: 3, salinity: 2, waterlogging: 3, cover: 2, acid: 1, alkaline: 3, soil: 3, profit: 2, risk: 2, weedControl: 0, fixesN: true, price: 450 },
  { id: 'lentils', name: 'Lentils', family: 'pulse', color: '#d69a7f', water: 1, salinity: 1, waterlogging: 1, cover: 1, acid: 1, alkaline: 3, soil: 2, profit: 3, risk: 3, weedControl: 0, fixesN: true, price: 720 },
  { id: 'vetch', name: 'Vetch (hay)', family: 'pulse', color: '#7e8155', water: 2, salinity: 2, waterlogging: 2, cover: 3, acid: 2, alkaline: 2, soil: 3, profit: 1, risk: 1, weedControl: 3, fixesN: true, price: 260 },
  { id: 'pasture', name: 'Pasture (sheep)', family: 'pasture', needsLivestock: true, color: '#626735', water: 1, salinity: 2, waterlogging: 2, cover: 3, acid: 2, alkaline: 2, soil: 4, profit: 1, risk: 1, weedControl: 3, fixesN: true, price: null },
  { id: 'fallow', name: 'Fallow', family: 'fallow', color: '#a37758', water: 1, salinity: 1, waterlogging: 2, cover: 0, acid: 2, alkaline: 2, soil: 0, profit: 0, risk: 1, weedControl: 2, price: null },
];

export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export const FAMILY_LABEL = {
  cereal: 'Cereal',
  oilseed: 'Oilseed',
  pulse: 'Legume',
  pasture: 'Pasture',
  fallow: 'Fallow',
};
