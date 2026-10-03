// Feeds what the satellites saw into the planner: crop history for seasons the farmer left
// blank, and blackleg risk from canola that flowered near each paddock last season.
const KEYS = ['last', 'prev', 'prev2'];

/** The paddock as the planner should see it, plus which history fields came from space. */
export function withSpace(paddock, space) {
  const sp = space?.paddocks?.[paddock.id];
  if (!sp) return paddock;
  const newestFirst = [...sp.seasons].reverse();
  const history = { ...paddock.history };
  const fromSpace = [];
  KEYS.forEach((k, i) => {
    const typed = history[k]?.some(Boolean);
    const seen = newestFirst[i];
    if (!typed && seen?.cropId && seen.confidence !== 'low') {
      history[k] = [seen.cropId];
      fromSpace.push(k);
    }
  });
  const near = space.canola?.nearest?.[paddock.id];
  return {
    ...paddock,
    history,
    historyFromSpace: fromSpace,
    blackleg: near != null ? { distanceM: near, year: space.canola.year } : null,
  };
}

export const withSpaceAll = (paddocks, space) => paddocks.map((p) => withSpace(p, space));
