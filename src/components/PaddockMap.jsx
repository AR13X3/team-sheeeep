import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from './Icon.jsx';
import SheepRunner from './SheepRunner.jsx';
import { areaHa, interiorPoint } from '../logic/geometry.js';
import { findSnap, traceBetween, SNAP_VERTEX_PX } from '../logic/snap.js';
import '../styles/map.css';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    layers: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
  },
  map: {
    label: 'Map',
    attribution: 'Map © Esri, HERE, Garmin, OpenStreetMap contributors',
    layers: [`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`],
  },
};
const BASEMAP_KEY = 'sheeep:basemap';
const DEFAULT_VIEW = { center: [-35.05, 147.35], zoom: 5 }; // south-east Australian wheat-sheep belt
const LABEL_MIN_ZOOM = 13;

const readBasemap = () => {
  try {
    return localStorage.getItem(BASEMAP_KEY) === 'map' ? 'map' : 'satellite';
  } catch {
    return 'satellite';
  }
};

const handleIcon = (cls, size = 18) => L.divIcon({ className: `vertex-handle ${cls}`, iconSize: [size, size] });

/**
 * Satellite map showing paddocks as polygons.
 *
 * props:
 *  paddocks         [{ id, coords, name }]
 *  styleFor(p)      -> { color, fillColor, fillOpacity, weight } per paddock
 *  labelFor(p)      -> hover tooltip text (optional)
 *  tagFor(p)        -> short label always shown on the paddock (optional)
 *  highlightId      paddock to emphasise
 *  onSelect(id)     click handler (optional)
 *  drawing          when true, clicks add corners; Enter / clicking the first corner finishes
 *  onDrawComplete(coords), onDraftChange({ corners, ha }), onDrawCancel()
 *  snap             corners lock onto neighbouring paddocks' corners/edges (hold Alt to place freely)
 *  editableId       paddock whose corners can be dragged; onEditCoords(id, coords); bump editKey to reset handles
 *  markers          [{ at: [lat, lng], label }] small dots, e.g. soil sample points
 *  locate           show a "my location" button
 *  fitKey           change it to re-fit the map to the paddocks
 *  initialView / onViewChange   persist the camera between screens
 *  ref              { flyToBounds(bounds), focus(coords), fit(), undoPoint(), cancelDrawing(), finishDrawing() }
 */
export default function PaddockMap({
  ref,
  paddocks = [],
  styleFor,
  labelFor,
  tagFor,
  highlightId,
  onSelect,
  drawing = false,
  onDrawComplete,
  onDraftChange,
  onDrawCancel,
  snap = true,
  editableId,
  editKey,
  onEditCoords,
  markers = [],
  overlay, // { url, bounds: [[south, west], [north, east]] } e.g. canola seen from space
  locate = false,
  fitKey,
  initialView,
  onViewChange,
  interactive = true,
  className = '',
}) {
  const el = useRef(null);
  const map = useRef(null);
  const base = useRef(null);
  const layer = useRef(null);
  const overlayLayer = useRef(null);
  const draftLayer = useRef(null);
  const editLayer = useRef(null);
  const meLayer = useRef(null);
  // draft corners: { at: [lat, lng], group, snap }. `group` lets Undo remove a click
  // together with any corners traced along a neighbour's border for it.
  const draft = useRef([]);
  const group = useRef(0);
  const cursor = useRef(null);
  const snapHint = useRef(null);
  const altDown = useRef(false);
  const cb = useRef({});
  cb.current = { onSelect, onDrawComplete, onDraftChange, onDrawCancel, onViewChange, onEditCoords, drawing, paddocks, snap, editableId };
  const [basemap, setBasemap] = useState(readBasemap);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [notice, setNotice] = useState('');

  // Create the map once.
  useEffect(() => {
    const view = initialView || DEFAULT_VIEW;
    const m = L.map(el.current, {
      center: view.center,
      zoom: view.zoom,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      zoomSnap: 0.5,
    });
    m.attributionControl.setPrefix(false);
    m.createPane('overlay-img').style.zIndex = 350; // above tiles, below paddock outlines
    overlayLayer.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    draftLayer.current = L.layerGroup().addTo(m);
    editLayer.current = L.layerGroup().addTo(m);
    meLayer.current = L.layerGroup().addTo(m);
    const syncZoomClass = () => el.current?.classList.toggle('paddock-map--far', m.getZoom() < LABEL_MIN_ZOOM);
    syncZoomClass();
    m.on('zoomend', syncZoomClass);
    m.on('moveend', () => cb.current.onViewChange?.({ center: [m.getCenter().lat, m.getCenter().lng], zoom: m.getZoom() }));
    m.on('click', (e) => {
      if (!cb.current.drawing) return;
      const s = snapAt(e.latlng, e.originalEvent);
      if (s?.kind === 'close') return finishDraft();
      addCorner(s ? s.at : [e.latlng.lat, e.latlng.lng], s);
    });
    m.on('dblclick', () => {
      if (!cb.current.drawing) return;
      // A double-click also fired a second click on the same spot: drop it, then finish.
      removeLastGroup();
      finishDraft();
    });
    m.on('mousemove', (e) => {
      if (!cb.current.drawing) return;
      cursor.current = [e.latlng.lat, e.latlng.lng];
      snapHint.current = snapAt(e.latlng, e.originalEvent);
      renderDraft();
    });
    m.on('mouseout', () => {
      if (!cb.current.drawing) return;
      cursor.current = null;
      snapHint.current = null;
      renderDraft();
    });
    map.current = m;
    if (import.meta.env.DEV) window.__paddockMap = m; // lets browser tests convert map and screen positions
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base layer (satellite or street map), with a loading indicator while tiles arrive.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const cfg = BASEMAPS[basemap];
    const group = L.layerGroup(cfg.layers.map((url, i) => L.tileLayer(url, { maxZoom: 19, attribution: i === 0 ? cfg.attribution : undefined, opacity: i === 0 ? 1 : 0.85 })));
    const main = group.getLayers()[0];
    let timer = 0;
    main.on('loading', () => {
      clearTimeout(timer);
      timer = setTimeout(() => setTilesLoading(true), 250);
    });
    main.on('load', () => {
      clearTimeout(timer);
      setTilesLoading(false);
    });
    group.addTo(m);
    group.eachLayer((l) => l.bringToBack());
    base.current = group;
    try {
      localStorage.setItem(BASEMAP_KEY, basemap);
    } catch {
      /* ignore */
    }
    return () => {
      clearTimeout(timer);
      group.remove();
      setTilesLoading(false);
    };
  }, [basemap]);

  /** Where a click at `latlng` would land: the draft's first corner (close), or a neighbour's corner/edge. */
  function snapAt(latlng, ev) {
    const m = map.current;
    if (!m || !cb.current.snap || ev?.altKey || altDown.current) return null;
    const point = m.latLngToContainerPoint(latlng);
    const toPx = ([lat, lng]) => m.latLngToContainerPoint([lat, lng]);
    const d = draft.current;
    if (cb.current.drawing && d.length >= 3) {
      const first = toPx(d[0].at);
      if (Math.hypot(first.x - point.x, first.y - point.y) <= SNAP_VERTEX_PX) return { kind: 'close', at: d[0].at, name: 'the first corner' };
    }
    const targets = cb.current.paddocks.filter((p) => p.id !== cb.current.editableId && p.coords?.length >= 3);
    return findSnap(point, targets, toPx);
  }

  function addCorner(at, s) {
    const g = ++group.current;
    const prev = draft.current[draft.current.length - 1];
    let traced = [];
    // two clicks in a row on the same neighbour's border: follow that border between them
    if (s && prev?.snap && prev.snap.id === s.id) {
      const target = cb.current.paddocks.find((p) => p.id === s.id);
      if (target) traced = traceBetween(target.coords, prev.snap.s, s.s);
    }
    draft.current = [...draft.current, ...traced.map((t) => ({ at: t, group: g })), { at, group: g, snap: s }];
    renderDraft();
  }

  function removeLastGroup() {
    const last = draft.current[draft.current.length - 1];
    if (last) draft.current = draft.current.filter((d) => d.group !== last.group);
  }

  function finishDraft() {
    const pts = draft.current.map((d) => d.at);
    draft.current = [];
    cursor.current = null;
    snapHint.current = null;
    renderDraft();
    if (pts.length >= 3) cb.current.onDrawComplete?.(pts);
  }

  /** Ring (and highlighted edge) showing what a click would lock onto. */
  function drawSnapHint(g, s) {
    if (!s) return;
    if (s.kind === 'edge') L.polyline([s.a, s.b], { color: '#e0be4a', weight: 6, opacity: 0.9, interactive: false }).addTo(g);
    const text = s.kind === 'close' ? 'Close the paddock' : `Snap to ${s.name} ${s.kind === 'vertex' ? 'corner' : 'edge'} · Alt to place freely`;
    L.circleMarker(s.at, { radius: s.kind === 'close' ? 13 : 9, color: '#e0be4a', weight: 3, fill: false, interactive: false, className: 'snap-ring' })
      .bindTooltip(text, { permanent: true, direction: 'top', offset: [0, -12], className: 'snap-tip' })
      .addTo(g);
  }

  function renderDraft() {
    const g = draftLayer.current;
    if (!g) return;
    g.clearLayers();
    const pts = draft.current.map((d) => d.at);
    cb.current.onDraftChange?.({ corners: pts.length, ha: pts.length >= 3 ? areaHa(pts) : 0 });
    if (cb.current.drawing) drawSnapHint(g, snapHint.current);
    if (!pts.length) return;
    if (pts.length >= 3) L.polygon(pts, { stroke: false, fillColor: '#ece4d4', fillOpacity: 0.25, interactive: false }).addTo(g);
    L.polyline(pts, { color: '#1f1a16', weight: 6, opacity: 0.45, interactive: false }).addTo(g);
    L.polyline(pts, { color: '#ece4d4', weight: 3, interactive: false }).addTo(g);
    const tip = snapHint.current?.at || cursor.current;
    if (tip) {
      const band = pts.length >= 2 ? [pts[pts.length - 1], tip, pts[0]] : [pts[pts.length - 1], tip];
      L.polyline(band, { color: '#ece4d4', weight: 2, dashArray: '6 6', interactive: false }).addTo(g);
    }
    pts.forEach((p, i) => {
      const first = i === 0 && pts.length >= 3;
      const marker = L.circleMarker(p, {
        radius: first ? 10 : 6,
        color: '#372f2a',
        weight: 2,
        fillColor: first ? '#989b66' : '#ece4d4',
        fillOpacity: 1,
        // corners never catch clicks: clicks (and double-clicks) reach the map, which closes the
        // paddock when a click snaps to the first corner
        interactive: false,
        bubblingMouseEvents: false,
        className: first ? 'draft-close' : '',
      }).addTo(g);
    });
  }

  function fit(animate = true) {
    const all = cb.current.paddocks.flatMap((p) => p.coords || []);
    if (map.current && all.length) map.current.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 17, animate });
  }

  useImperativeHandle(ref, () => ({
    flyToBounds: (bounds) => map.current?.flyToBounds(bounds, { maxZoom: 16, duration: 1.2 }),
    focus: (coords) => map.current?.flyToBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 17, duration: 0.8 }),
    fit,
    undoPoint: () => {
      removeLastGroup();
      renderDraft();
    },
    cancelDrawing: () => {
      draft.current = [];
      renderDraft();
    },
    finishDrawing: finishDraft,
  }));

  // Drawing mode: crosshair, no double-click zoom, keyboard shortcuts.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    el.current.classList.toggle('paddock-map--drawing', drawing);
    if (drawing) m.doubleClickZoom.disable();
    else if (interactive) m.doubleClickZoom.enable();
    if (!drawing) {
      draft.current = [];
      cursor.current = null;
      renderDraft();
      return;
    }
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finishDraft();
      } else if (e.key === 'Backspace' || e.key === 'Delete' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) {
        e.preventDefault();
        removeLastGroup();
        renderDraft();
      } else if (e.key === 'Escape') {
        cb.current.onDrawCancel?.();
      } else if (e.key === 'Alt') {
        e.preventDefault(); // stop the browser menu bar grabbing focus
        altDown.current = true;
        snapHint.current = null;
        renderDraft();
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'Alt') altDown.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      altDown.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, interactive]);

  // Paddock polygons: a dark halo under a cream outline so they read on any imagery.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const p of paddocks) {
      if (!p.coords || p.coords.length < 3) continue;
      const hl = highlightId && p.id === highlightId;
      const dim = highlightId && !hl;
      const s = styleFor?.(p) || {};
      const weight = hl ? 4 : s.weight || 2.5;
      const fillOpacity = dim ? 0.15 : s.fillOpacity ?? 0.45;
      L.polygon(p.coords, { color: '#1f1a16', weight: weight + 4, opacity: dim ? 0.2 : 0.45, fill: false, interactive: false }).addTo(g);
      const poly = L.polygon(p.coords, {
        color: hl ? '#fff8ea' : s.color || '#ece4d4',
        weight,
        fillColor: s.fillColor || '#989b66',
        fillOpacity,
        opacity: dim ? 0.55 : 1,
        bubblingMouseEvents: false,
        className: `paddock-shape${hl ? ' is-highlighted' : ''}`,
      }).addTo(g);
      const label = labelFor?.(p);
      if (label) poly.bindTooltip(label, { sticky: true, className: 'paddock-tip', direction: 'top', offset: [0, -8] });
      const tag = tagFor?.(p);
      if (tag) {
        L.tooltip({ permanent: true, direction: 'center', className: `paddock-tag${hl ? ' is-highlighted' : ''}${dim ? ' is-dim' : ''}`, interactive: false })
          .setLatLng(interiorPoint(p.coords))
          .setContent(tag)
          .addTo(g);
      }
      poly.on('mouseover', () => !cb.current.drawing && poly.setStyle({ weight: weight + 1.5, fillOpacity: Math.min(0.85, fillOpacity + 0.15) }));
      poly.on('mouseout', () => poly.setStyle({ weight, fillOpacity }));
      poly.on('click', (e) => {
        // belt and braces: if a paddock still receives a click while drawing, treat it as a map click
        if (cb.current.drawing) return map.current?.fire('click', e);
        cb.current.onSelect?.(p.id);
      });
      if (hl) poly.bringToFront();
    }
  }, [paddocks, styleFor, labelFor, tagFor, highlightId]);

  // Corner handles for reshaping one paddock: drag a corner, click a midpoint to add one,
  // right-click a corner to remove it.
  useEffect(() => {
    const g = editLayer.current;
    if (!g) return;
    g.clearLayers();
    const p = paddocks.find((q) => q.id === editableId);
    if (!p) return;
    const coords = p.coords.map((c) => [...c]);
    const outline = L.polygon(coords, { color: '#fff8ea', weight: 2, dashArray: '5 5', fill: false, interactive: false }).addTo(g);
    const hintLayer = L.layerGroup().addTo(g);
    const commit = (next) => cb.current.onEditCoords?.(p.id, next);
    coords.forEach((c, i) => {
      const handle = L.marker(c, { draggable: true, icon: handleIcon('vertex-handle--corner'), keyboard: false, title: 'Drag to move · right-click to remove' }).addTo(g);
      handle.on('drag', (e) => {
        // corners lock onto neighbouring paddocks while dragging, too (Alt to place freely)
        const s = snapAt(e.target.getLatLng(), e.originalEvent);
        if (s) e.target.setLatLng(s.at);
        hintLayer.clearLayers();
        drawSnapHint(hintLayer, s);
        const { lat, lng } = e.target.getLatLng();
        coords[i] = [lat, lng];
        outline.setLatLngs(coords);
      });
      handle.on('dragend', () => {
        hintLayer.clearLayers();
        commit(coords.map((x) => [...x]));
      });
      handle.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e.originalEvent);
        if (coords.length > 3) commit(coords.filter((_, j) => j !== i));
      });
    });
    coords.forEach((c, i) => {
      const n = coords[(i + 1) % coords.length];
      const mid = [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2];
      L.marker(mid, { icon: handleIcon('vertex-handle--mid', 12), keyboard: false, title: 'Click to add a corner' })
        .addTo(g)
        .on('click', () => commit([...coords.slice(0, i + 1), mid, ...coords.slice(i + 1)]));
    });
  }, [paddocks, editableId, editKey]);

  useEffect(() => {
    const g = overlayLayer.current;
    if (!g) return;
    g.clearLayers();
    if (overlay?.url) L.imageOverlay(overlay.url, overlay.bounds, { pane: 'overlay-img', opacity: 0.85, interactive: false, className: 'canola-overlay' }).addTo(g);
  }, [overlay?.url, overlay?.bounds?.toString()]);

  // Extra points of interest (e.g. where soil was sampled).
  useEffect(() => {
    const g = meLayer.current;
    if (!g) return;
    g.eachLayer((l) => l.options.className === 'sample-dot' && g.removeLayer(l));
    for (const m of markers) {
      L.circleMarker(m.at, { radius: 5, color: '#fff8ea', weight: 2, fillColor: '#372f2a', fillOpacity: 1, className: 'sample-dot', interactive: !!m.label })
        .bindTooltip(m.label || '', { direction: 'top', offset: [0, -6] })
        .addTo(g);
    }
  }, [markers]);

  // Fit to paddocks when asked.
  useEffect(() => {
    fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  function locateMe() {
    if (!navigator.geolocation) return flash('Location is not available in this browser');
    flash('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = [pos.coords.latitude, pos.coords.longitude];
        meLayer.current.clearLayers();
        L.circleMarker(at, { radius: 8, color: '#fff8ea', weight: 3, fillColor: '#4a8fd8', fillOpacity: 1, className: 'me-dot' }).addTo(meLayer.current);
        map.current?.flyTo(at, 15, { duration: 1.2 });
        setNotice('');
      },
      () => flash('Couldn’t get your location'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? '' : n)), 3000);
  }

  return (
    <>
      <div ref={el} className={`paddock-map ${className}`} />
      {interactive && (
        <div className="map-rail" role="toolbar" aria-label="Map controls">
          <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Zoom in" title="Zoom in">
            <Icon name="plus" size={22} />
          </button>
          <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Zoom out" title="Zoom out">
            <Icon name="remove" size={22} />
          </button>
          <span className="map-rail__sep" />
          <button type="button" onClick={() => fit()} aria-label="Show all paddocks" title="Show all paddocks" disabled={!paddocks.length}>
            <Icon name="fit" size={22} />
          </button>
          {locate && (
            <button type="button" onClick={locateMe} aria-label="Go to my location" title="Go to my location">
              <Icon name="my-location" size={22} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setBasemap((b) => (b === 'satellite' ? 'map' : 'satellite'))}
            aria-label={`Switch to ${basemap === 'satellite' ? 'street map' : 'satellite'} view`}
            title={basemap === 'satellite' ? 'Street map' : 'Satellite'}
            className="map-rail__layers"
          >
            <Icon name="layers" size={22} />
            <span>{basemap === 'satellite' ? 'Map' : 'Sat'}</span>
          </button>
        </div>
      )}
      {tilesLoading && (
        <div className="map-loading" role="status">
          <SheepRunner count={1} size={30} speed={1.6} className="runner-lane--mini" />
          <span>Loading map…</span>
        </div>
      )}
      {notice && (
        <p className="map-chip map-notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
