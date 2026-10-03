import { createPaddock } from '../state/store.jsx';

// A small example farm (four paddocks) in the NSW Riverina wheat-sheep belt, for demos.
export const DEMO_FARM = {
  view: { center: [-34.9385, 147.1655], zoom: 15 },
  paddocks: [
    [
      [-34.9338, 147.1588],
      [-34.9339, 147.1652],
      [-34.9389, 147.1653],
      [-34.9388, 147.1589],
    ],
    [
      [-34.9339, 147.1657],
      [-34.934, 147.1722],
      [-34.939, 147.1723],
      [-34.9389, 147.1658],
    ],
    [
      [-34.9393, 147.1589],
      [-34.9394, 147.1653],
      [-34.9437, 147.1654],
      [-34.9436, 147.159],
    ],
    [
      [-34.9394, 147.1658],
      [-34.9395, 147.1723],
      [-34.9438, 147.1724],
      [-34.9437, 147.1659],
    ],
  ],
};

/** Fresh paddock objects for the demo farm. */
export function buildDemoPaddocks() {
  const paddocks = [];
  for (const coords of DEMO_FARM.paddocks) paddocks.push(createPaddock(coords, paddocks));
  return paddocks;
}
