"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { api } from "@/lib/api";
import MapSidebar, {
  DEFAULT_FILTERS,
  type MapFiltersState,
} from "@/components/maps/MapSidebar";
import ConcessionLayer from "@/components/maps/ConcessionLayer";
import { getDefaultMapView } from "@/lib/maps";
import type { ConcessionMapFeature } from "@/types/concessions";

// ── Tile layers ────────────────────────────────────────────────────────────────
type TileLayerKey = "osm" | "satellite" | "topo";

const TILE_LAYERS: Record<TileLayerKey, { url: string; attribution: string; label: string; icon: string }> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
    label: "Mapa",
    icon: "🗺️",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics",
    label: "Satélite",
    icon: "🛰️",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    label: "Topografía",
    icon: "⛰️",
  },
};

// ── Status colors ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active:    "#16a34a",
  pending:   "#d97706",
  expired:   "#dc2626",
  suspended: "#6b7280",
};

// ── BoundsListener ────────────────────────────────────────────────────────────
function BoundsListener({ onBoundsChange }: { onBoundsChange: (b: any) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        min_lng: b.getWest(),
        min_lat: b.getSouth(),
        max_lng: b.getEast(),
        max_lat: b.getNorth(),
      });
    },
  });

  useEffect(() => {
    const b = map.getBounds();
    onBoundsChange({
      min_lng: b.getWest(),
      min_lat: b.getSouth(),
      max_lng: b.getEast(),
      max_lat: b.getNorth(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── FlyToGeometry — centra el mapa en una geometría ──────────────────────────
function FlyToGeometry({ geometry }: { geometry: any }) {
  const map = useMapEvents({});

  useEffect(() => {
    if (!geometry) return;
    try {
      const coords: number[][] =
        geometry.type === "Polygon"
          ? geometry.coordinates[0]
          : geometry.coordinates[0][0];

      if (!coords?.length) return;

      const lats = coords.map((c) => c[1]);
      const lngs = coords.map((c) => c[0]);
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      );
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 13, duration: 1.2 });
    } catch {
      // ignore invalid geometries
    }
  }, [geometry, map]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
interface PeruMapProps {
  initialCode?: string;  // pre-fill search y filtrar por este código
  initialId?:   number;  // auto-seleccionar y centrar en esta concesión
}

export default function PeruMap({ initialCode, initialId }: PeruMapProps) {
  const defaultView = getDefaultMapView();

  const initFilters: MapFiltersState = initialCode
    ? { ...DEFAULT_FILTERS, q: initialCode }
    : DEFAULT_FILTERS;

  const [filters, setFilters] = useState<MapFiltersState>(initFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<MapFiltersState>(initFilters);

  const [features, setFeatures] = useState<ConcessionMapFeature[]>([]);
  const [selectedGeometry, setSelectedGeometry] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [capped, setCapped] = useState(false);

  // Capa de mapa base
  const [activeLayer, setActiveLayer] = useState<TileLayerKey>("osm");
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const boundsRef   = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectedRef = useRef(false); // para no re-seleccionar en cada render

  // Debounce text fields (q, areaMin, areaMax), apply others immediately
  const handleFiltersChange = (next: MapFiltersState) => {
    setFilters(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedFilters(next), 400);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchFeatures = useCallback(
    async (bounds: any, f: MapFiltersState) => {
      setLoading(true);
      try {
        const params: Record<string, any> = { ...bounds };
        if (f.q) params.q = f.q;

        // Multiple statuses → send first one (backend accepts single for now)
        // If multiple selected, we could do separate calls, but for UX we OR via
        // sending the first and letting backend handle. For simplicity, if more
        // than 1 status is selected, omit (show all) — same UX as "clear".
        if (f.statuses.length === 1) params.status = f.statuses[0];

        if (f.region) params.region = f.region;
        if (f.concessionType) params.concession_type = f.concessionType;
        if (f.areaMin) params.area_min = parseFloat(f.areaMin);
        if (f.areaMax) params.area_max = parseFloat(f.areaMax);

        const res = await api.get("/maps/concessions", { params });
        const data = res.data;
        setFeatures(data.features || []);
        setCount(data.count ?? 0);
        setCapped((data.count ?? 0) >= (data.limit ?? 500));
      } catch {
        // ignore network errors silently
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Re-fetch on filter changes
  useEffect(() => {
    if (boundsRef.current) fetchFeatures(boundsRef.current, debouncedFilters);
  }, [debouncedFilters, fetchFeatures]);

  // Auto-seleccionar la concesión inicial cuando llegan los features
  useEffect(() => {
    if (!initialId || autoSelectedRef.current || features.length === 0) return;
    const match = features.find((f) => f.id === initialId);
    if (match) {
      autoSelectedRef.current = true;
      handleSelect(match);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, initialId]);

  const handleBoundsChange = useCallback(
    (bounds: any) => {
      boundsRef.current = bounds;
      fetchFeatures(bounds, debouncedFilters);
    },
    [debouncedFilters, fetchFeatures],
  );

  // ── Select concession ──────────────────────────────────────────────────────
  const handleSelect = async (feature: ConcessionMapFeature) => {
    if (selectedId === feature.id) {
      setSelectedId(null);
      setSelectedGeometry(null);
      return;
    }
    setSelectedId(feature.id);
    try {
      const res = await api.get(`/maps/concessions/${feature.id}/geometry`);
      const geo = res.data.geojson ? JSON.parse(res.data.geojson) : null;
      setSelectedGeometry(geo);
    } catch {
      setSelectedGeometry(null);
    }
  };

  const polygonColor =
    STATUS_COLORS[features.find((f) => f.id === selectedId)?.status ?? ""] ?? "#2563eb";

  const layer = TILE_LAYERS[activeLayer];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-[#dce8e6]">
      {/* Sidebar overlaid on map */}
      <MapSidebar
        filters={filters}
        onChange={handleFiltersChange}
        count={count}
        capped={capped}
        loading={loading}
      />

      {/* Layer switcher — bottom-right */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col items-end gap-1.5">
        {showLayerMenu && (
          <div className="flex flex-col gap-1 rounded-xl border border-white/20 bg-white/90 p-1.5 shadow-lg backdrop-blur-sm">
            {(Object.entries(TILE_LAYERS) as [TileLayerKey, typeof TILE_LAYERS[TileLayerKey]][]).map(
              ([key, info]) => (
                <button
                  key={key}
                  onClick={() => { setActiveLayer(key); setShowLayerMenu(false); }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeLayer === key
                      ? "bg-[#0f6c5a] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              ),
            )}
          </div>
        )}
        <button
          onClick={() => setShowLayerMenu((v) => !v)}
          title="Cambiar capa de mapa"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 border border-gray-200 text-base transition-colors"
        >
          {layer.icon}
        </button>
      </div>

      {/* Map */}
      <MapContainer
        center={defaultView.center}
        zoom={defaultView.zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          key={activeLayer}
          attribution={layer.attribution}
          url={layer.url}
          maxZoom={activeLayer === "satellite" ? 20 : 19}
        />

        <BoundsListener onBoundsChange={handleBoundsChange} />

        {/* Centrar automáticamente cuando hay una concesión seleccionada por URL */}
        {selectedGeometry && initialId && selectedId === initialId && (
          <FlyToGeometry geometry={selectedGeometry} />
        )}

        <ConcessionLayer
          features={features}
          onSelect={handleSelect}
          selectedId={selectedId}
        />

        {selectedGeometry?.type === "Polygon" && (
          <Polygon
            positions={selectedGeometry.coordinates[0].map((c: number[]) => [c[1], c[0]])}
            pathOptions={{ color: polygonColor, fillOpacity: 0.25, weight: 2 }}
          />
        )}
        {selectedGeometry?.type === "MultiPolygon" &&
          selectedGeometry.coordinates.map((ring: number[][][], i: number) => (
            <Polygon
              key={i}
              positions={ring[0].map((c: number[]) => [c[1], c[0]])}
              pathOptions={{ color: polygonColor, fillOpacity: 0.25, weight: 2 }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
