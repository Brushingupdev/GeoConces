import { PERU_DEFAULT_CENTER, PERU_DEFAULT_ZOOM } from "@/lib/constants";

export function getDefaultMapView() {
  return {
    center: PERU_DEFAULT_CENTER,
    zoom: PERU_DEFAULT_ZOOM,
  };
}
