import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

const STORAGE_KEY = 'sheeep:v1';

export const PRIORITY_KEYS = [
  { key: 'soilHealth', label: 'Soil Health' },
  { key: 'water', label: 'Water Saving' },
  { key: 'profit', label: 'Profit' },
  { key: 'risk', label: 'Low Risk' },
];

export const ISSUE_KEYS = [
  { key: 'waterlogging', label: 'Waterlogging' },
  { key: 'erosion', label: 'Erosion' },
  { key: 'herbicideWeeds', label: 'Herbicide-resistant Weeds' },
  { key: 'diseaseHistory', label: 'Disease History' },
  { key: 'salinity', label: 'Salinity' },
];

export const REASON_KEYS = [
  { key: 'weedControl', label: 'Weed-Control' },
  { key: 'nitrogen', label: 'Nitrogen' },
  { key: 'erosion', label: 'Erosion' },
  { key: 'diseaseBreak', label: 'Disease Break' },
  { key: 'spreadRisk', label: 'Spread Risk' },
  { key: 'profit', label: 'Profit' },
];

const initialState = {
  user: null, // { name }
  experience: null, // 'new' | 'experienced'
  paddocks: [],
  keepReason: '', // why the farmer kept their old paddocks instead of the soil-based split
  mapView: null, // { center: [lat, lng], zoom }
  dismissedTips: {},
  space: null, // { key, result } from services/space.js (satellite history of the farm)
  farm: { livestock: true, crops: null }, // the farm's crop list (logic/cropSet.js); crops: null = every crop
};

// Sheep art (src/assets/art/sheep-N.svg) handed out to paddocks, most colourful first.
const SHEEP_ORDER = [3, 6, 4, 2, 5, 1];

let idCounter = 0;
export const newPaddockId = () => `p${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Gives paddocks sequential names (#1, #2, ...) and sheep in display order. */
export const renumberPaddocks = (paddocks) =>
  paddocks.map((p, i) => ({ ...p, number: i + 1, name: `Paddock #${i + 1}`, sheep: SHEEP_ORDER[i % SHEEP_ORDER.length] }));

export function createPaddock(coords, existing) {
  const used = new Set(existing.map((p) => p.number));
  let number = 1;
  while (used.has(number)) number++;
  return {
    id: newPaddockId(),
    number,
    name: `Paddock #${number}`,
    sheep: SHEEP_ORDER[(number - 1) % SHEEP_ORDER.length], // which sheep (and wool colour) represents this paddock
    coords, // [[lat, lng], ...]
    history: { last: [''], prev: [''], prev2: [''] },
    issues: {},
    comments: '',
    priorities: { soilHealth: 50, water: 50, profit: 50, risk: 50 },
    reasons: {},
    site: {}, // auto-filled data: { soil, terrain, climate }
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'login':
      return { ...state, user: { name: action.name } };
    case 'logout':
      return { ...initialState };
    case 'setExperience':
      return { ...state, experience: action.value };
    case 'addPaddock':
      return { ...state, paddocks: [...state.paddocks, createPaddock(action.coords, state.paddocks)] };
    case 'setPaddocks':
      return { ...state, paddocks: action.paddocks };
    case 'updatePaddock':
      return {
        ...state,
        paddocks: state.paddocks.map((p) =>
          p.id === action.id ? { ...p, ...(typeof action.patch === 'function' ? action.patch(p) : action.patch) } : p,
        ),
      };
    case 'removePaddock':
      return { ...state, paddocks: state.paddocks.filter((p) => p.id !== action.id) };
    case 'setKeepReason':
      return { ...state, keepReason: action.value };
    case 'setMapView':
      return { ...state, mapView: action.value };
    case 'setSpace':
      return { ...state, space: action.value };
    case 'setFarm':
      return { ...state, farm: { ...state.farm, ...action.value } };
    case 'dismissTip':
      return { ...state, dismissedTips: { ...state.dismissedTips, [action.id]: true } };
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...initialState, ...JSON.parse(raw) } : initialState;
  } catch {
    return initialState;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the app still works for this session */
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export function usePaddock(id) {
  const { state, dispatch } = useStore();
  const index = state.paddocks.findIndex((p) => p.id === id);
  const paddock = state.paddocks[index];
  const update = (patch) => dispatch({ type: 'updatePaddock', id, patch });
  return { paddock, index, total: state.paddocks.length, update, paddocks: state.paddocks };
}
