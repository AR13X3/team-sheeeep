import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SheepAvatar } from './Art.jsx';
import { Meter } from './charts.jsx';
import { Badge, CropChip, Skeleton, TextField } from './ui.jsx';
import { CROP_BY_ID } from '../data/crops.js';
import { formatHa } from '../logic/geometry.js';
import { BLACKLEG_DISTANCE_M } from '../logic/rotation.js';
import { describeSlope } from '../services/terrain.js';
import { useAllSiteStatus } from '../state/useSiteData.js';

const COLUMNS = [
  { key: 'name', label: 'Paddock', sort: (r) => r.p.number },
  { key: 'area', label: 'Area', num: true, sort: (r) => r.ha },
  { key: 'soil', label: 'Soil', sort: (r) => r.p.site?.soil?.texture || '~' },
  { key: 'ph', label: 'pH', num: true, sort: (r) => r.p.site?.soil?.ph ?? -1 },
  { key: 'slope', label: 'Slope', num: true, sort: (r) => r.p.site?.terrain?.slopePct ?? -1 },
  { key: 'last', label: 'Last season', sort: (r) => r.last?.name || '~' },
  { key: 'next', label: 'Next season', sort: (r) => r.next?.name || '~' },
  { key: 'health', label: 'Soil health (10 seasons)', sort: (r) => r.end },
  { key: 'flags', label: 'Flags', sort: (r) => r.flags.length },
];

/**
 * Every paddock in one sortable, searchable table. `farm` is the result of useFarm().
 * `compact` drops the soil detail columns (for the dashboard).
 */
export default function PaddockTable({ farm, compact = false, search = true, title }) {
  const navigate = useNavigate();
  const status = useAllSiteStatus();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const { paddocks, planned, plans, areas, years } = farm;

  const rows = useMemo(() => {
    const list = paddocks.map((p, i) => {
      const pl = planned[i];
      const plan = plans[p.id];
      const lastId = pl.history?.last?.[0];
      const flags = [];
      if (pl.blackleg?.distanceM != null && pl.blackleg.distanceM < BLACKLEG_DISTANCE_M) flags.push({ tone: 'bad', label: `Blackleg ${pl.blackleg.distanceM} m` });
      if (pl.historyFromSpace?.length) flags.push({ tone: 'info', label: 'History from space' });
      for (const [k, label] of [['salinity', 'Salinity'], ['waterlogging', 'Waterlogging'], ['erosion', 'Erosion'], ['herbicideWeeds', 'Resistant weeds']]) if (p.issues?.[k]) flags.push({ tone: 'warn', label });
      return {
        p,
        ha: areas[p.id],
        last: lastId ? CROP_BY_ID[lastId] : null,
        lastFromSpace: pl.historyFromSpace?.includes('last'),
        next: plan?.seasons[0]?.crop,
        base: plan?.base,
        end: plan?.seasons.at(-1)?.health ?? 0,
        flags,
      };
    });
    const t = q.trim().toLowerCase();
    const col = COLUMNS.find((c) => c.key === sort.key);
    return list
      .filter((r) => !t || `${r.p.name} ${r.next?.name} ${r.last?.name} ${r.p.site?.soil?.texture}`.toLowerCase().includes(t))
      .sort((a, b) => {
        const x = col.sort(a), y = col.sort(b);
        return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
      });
  }, [paddocks, planned, plans, areas, q, sort]);

  const cols = compact ? COLUMNS.filter((c) => !['ph', 'slope', 'soil'].includes(c.key)) : COLUMNS;
  const loading = (id, k) => status[id]?.[k] === 'loading';

  return (
    <>
      {search && (
        <div className="toolbar">
          {title}
          <TextField label="Search paddocks" hideLabel icon="search" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="toolbar__spacer" />
          <span className="toolbar__count">
            {rows.length} of {paddocks.length} paddocks
          </span>
        </div>
      )}
      <div className="table-wrap">
        <table className="table paddock-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.num ? 'is-num' : ''} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}>
                    {c.key === 'next' ? `Next season (${years[0]})` : c.label}
                    <Icon name={sort.key === c.key ? (sort.dir > 0 ? 'sort-up' : 'sort-down') : 'sort'} size={12} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const soil = r.p.site?.soil;
              const t = r.p.site?.terrain;
              return (
                <tr key={r.p.id} className="is-link" onClick={() => navigate(`/paddocks/${r.p.id}`)}>
                  <td>
                    <a
                      className="pname"
                      href={`#/paddocks/${r.p.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                    >
                      <span className="pname__avatar">
                        <SheepAvatar n={r.p.sheep} size={26} />
                      </span>
                      <span>
                        {r.p.name}
                        {compact && <span className="pname__sub">{soil?.texture || 'Soil pending'}</span>}
                      </span>
                    </a>
                  </td>
                  {cols.some((c) => c.key === 'area') && <td className="is-num">{formatHa(r.ha)} ha</td>}
                  {!compact && <td>{soil ? soil.texture : loading(r.p.id, 'soil') ? <Skeleton w={80} /> : soil === null ? <span className="muted">No data</span> : <span className="muted">–</span>}</td>}
                  {!compact && <td className="is-num">{soil?.ph != null ? soil.ph.toFixed(1) : loading(r.p.id, 'soil') ? <Skeleton w={30} /> : '–'}</td>}
                  {!compact && (
                    <td className="is-num" title={t ? describeSlope(t.slopePct) : undefined}>
                      {t ? `${t.slopePct.toFixed(1)}%` : loading(r.p.id, 'terrain') ? <Skeleton w={36} /> : '–'}
                    </td>
                  )}
                  <td>
                    {r.last ? (
                      <span className="cell-crop">
                        <CropChip crop={r.last} size="sm" />
                        {r.lastFromSpace && <Icon name="satellite" size={13} label="Seen from space" />}
                      </span>
                    ) : (
                      <span className="muted">Unknown</span>
                    )}
                  </td>
                  <td>
                    <CropChip crop={r.next} size="sm" />
                  </td>
                  <td>
                    <Meter value={r.end} delta={r.end - r.base} />
                  </td>
                  <td>
                    <span className="cell-flags">
                      {r.flags.length ? r.flags.slice(0, 2).map((f) => (
                        <Badge key={f.label} tone={f.tone}>
                          {f.label}
                        </Badge>
                      )) : <span className="muted">–</span>}
                      {r.flags.length > 2 && <Badge>+{r.flags.length - 2}</Badge>}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={cols.length} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                  No paddock matches “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
