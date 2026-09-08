"use client";

import { Marker } from "react-leaflet";
import L from "leaflet";
import type { ConcessionMapFeature } from "@/types/concessions";

// Color per status for the selected marker
const STATUS_HEX: Record<string, string> = {
  active:    "#16a34a",
  pending:   "#d97706",
  expired:   "#dc2626",
  suspended: "#6b7280",
};

function makeIcon(color: string, selected = false): L.DivIcon {
  const size = selected ? 14 : 10;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}">
      <circle cx="${size}" cy="${size}" r="${size - 1}"
        fill="${color}" fill-opacity="${selected ? 0.95 : 0.75}"
        stroke="white" stroke-width="${selected ? 2 : 1.5}" />
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -(size + 4)],
  });
}

export default function ConcessionLayer({
  features,
  onSelect,
  selectedId,
}: {
  features: ConcessionMapFeature[];
  icon?: L.Icon | L.DivIcon; // kept for compatibility, unused
  onSelect: (feature: ConcessionMapFeature) => void;
  selectedId?: number | null;
}) {
  return (
    <>
      {features.map((feature) => {
        if (!feature.centroid) return null;
        let coords: [number, number];
        try {
          const geo = JSON.parse(feature.centroid);
          coords = [geo.coordinates[1], geo.coordinates[0]];
        } catch {
          return null;
        }

        const color = STATUS_HEX[feature.status] ?? "#2563eb";
        const isSelected = selectedId === feature.id;
        const icon = makeIcon(color, isSelected);

        return (
          <Marker
            key={feature.id}
            position={coords}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(feature) }}
          />
        );
      })}
    </>
  );
}
