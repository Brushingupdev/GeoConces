"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { Layers, Plus, Minus, X, MapPin } from "lucide-react";
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

const TILE_LAYERS: Record<TileLayerKey, { url: string; attribution: string; label: string }> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
    label: "Mapa",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics",
    label: "Satélite",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    label: "Topografía",
  },
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active:    { color: "#16a34a", label: "Activa" },
  pending:   { color: "#d97706", label: "Pendiente" },
  expired:   { color: "#dc2626", label: "Expirada" },
  suspended: { color: "#6b7280", label: "Suspendida" },
};

// ── MapCapture — captures Leaflet map instance for outside components ──────────
function MapCapture({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

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

// ── FlyToGeometry ─────────────────────────────────────────────────────────────
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

// ── ZoomControls ──────────────────────────────────────────────────────────────
function ZoomControls({ map }: { map: L.Map | null }) {
  return (
    <div className="absolute top-4 left-4 z-[600] flex flex-col gap-1">
      <button
        onClick={() => map?.zoomIn()}
        title="Acercar"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Plus size={15} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => map?.zoomOut()}
        title="Alejar"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── CountBadge ────────────────────────────────────────────────────────────────
function CountBadge({ count, capped, loading }: { count: number; capped: boolean; loading: boolean }) {
  return (
    <div className="absolute top-[104px] left-4 z-[600]">
      <div className="flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-1.5 text-xs font-medium text-gray-700">
        {loading ? (
          <span className="text-gray-400">Cargando...</span>
        ) : (
          <>
            <MapPin size={11} className="text-[#145a55]" />
            <span>
              {capped ? `+${count}` : count} concesion{count !== 1 ? "es" : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── MapLegend ─────────────────────────────────────────────────────────────────
function MapLegend() {
  return (
    <div className="absolute bottom-5 left-4 z-[600]">
      <div className="rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5">
        {Object.entries(STATUS_CONFIG).map(([key, { color, label }]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LayerSwitcher ─────────────────────────────────────────────────────────────
function LayerSwitcher({
  active,
  onSelect,
}: {
  active: TileLayerKey;
  onSelect: (key: TileLayerKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 right-4 z-[600] flex flex-col items-end gap-1.5">
      {open && (
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm">
          {(Object.entries(TILE_LAYERS) as [TileLayerKey, typeof TILE_LAYERS[TileLayerKey]][]).map(
            ([key, info]) => (
              <button
                key={key}
                onClick={() => { onSelect(key); setOpen(false); }}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active === key
                    ? "bg-[#145a55] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {info.label}
              </button>
            ),
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Cambiar capa de mapa"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 border border-gray-200 text-gray-600 transition-colors"
      >
        <Layers size={16} />
      </button>
    </div>
  );
}

// ── ConcessionInfoBar ─────────────────────────────────────────────────────────
function ConcessionInfoBar({
  feature,
  onClose,
}: {
  feature: ConcessionMapFeature | null;
  onClose: () => void;
}) {
  const visible = feature !== null;
  const status = STATUS_CONFIG[feature?.status ?? ""] ?? { color: "#2563eb", label: feature?.status ?? "" };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-[600] transition-transform duration-300 ease-in-out ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-4 mb-4 rounded-xl bg-white border border-gray-200 shadow-xl p-4">
        {feature && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Name + status */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-xs font-medium" style={{ color: status.color }}>
                  {status.label}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500 font-mono">{feature.code}</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 truncate">{feature.name}</h3>

              {/* Details row */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {feature.region && (
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Región:</span> {feature.region}
                  </span>
                )}
                {feature.area_hectares != null && (
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Área:</span>{" "}
                    {feature.area_hectares.toLocaleString("es-PE", { maximumFractionDigits: 1 })} ha
                  </span>
                )}
                {feature.holder_name && (
                  <span className="text-xs text-gray-500 truncate max-w-xs">
                    <span className="font-medium text-gray-700">Titular:</span> {feature.holder_name}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/explorar/${feature.id}`}
                className="rounded-lg bg-[#145a55] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0f4a46] transition-colors"
              >
                Ver detalle
              </Link>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface PeruMapProps {
  initialCode?: string;
  initialId?:   number;
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
  const [selectedFeature, setSelectedFeature] = useState<ConcessionMapFeature | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [capped, setCapped] = useState(false);

  const [activeLayer, setActiveLayer] = useState<TileLayerKey>("osm");
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const boundsRef   = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectedRef = useRef(false);

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

  useEffect(() => {
    if (boundsRef.current) fetchFeatures(boundsRef.current, debouncedFilters);
  }, [debouncedFilters, fetchFeatures]);

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
      setSelectedFeature(null);
      setSelectedGeometry(null);
      return;
    }
    setSelectedId(feature.id);
    setSelectedFeature(feature);
    try {
      const res = await api.get(`/maps/concessions/${feature.id}/geometry`);
      const geo = res.data.geojson ? JSON.parse(res.data.geojson) : null;
      setSelectedGeometry(geo);
    } catch {
      setSelectedGeometry(null);
    }
  };

  const handleCloseInfo = () => {
    setSelectedId(null);
    setSelectedFeature(null);
    setSelectedGeometry(null);
  };

  const onMapReady = useCallback((map: L.Map) => setMapInstance(map), []);

  const polygonColor =
    STATUS_CONFIG[features.find((f) => f.id === selectedId)?.status ?? ""]?.color ?? "#2563eb";

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

      {/* Zoom controls — top-left */}
      <ZoomControls map={mapInstance} />

      {/* Count badge — below zoom controls */}
      <CountBadge count={count} capped={capped} loading={loading} />

      {/* Legend — bottom-left */}
      <MapLegend />

      {/* Layer switcher — bottom-right */}
      <LayerSwitcher active={activeLayer} onSelect={setActiveLayer} />

      {/* Map */}
      <MapContainer
        center={defaultView.center}
        zoom={defaultView.zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <MapCapture onMap={onMapReady} />

        <TileLayer
          key={activeLayer}
          attribution={layer.attribution}
          url={layer.url}
          maxZoom={activeLayer === "satellite" ? 20 : 19}
        />

        <BoundsListener onBoundsChange={handleBoundsChange} />

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

      {/* Info bar — bottom slide-up */}
      <ConcessionInfoBar feature={selectedFeature} onClose={handleCloseInfo} />
    </div>
  );
}
