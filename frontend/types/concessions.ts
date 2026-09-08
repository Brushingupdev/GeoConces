export interface ConcessionMapFeature {
  id: number;
  code: string;
  name: string;
  status: string;
  holder_name?: string | null;
  region?: string | null;
  area_hectares?: number | null;
  centroid?: string | null;
}

export interface ConcessionListItem {
  id: number;
  code: string;
  name: string;
  holder_name?: string | null;
  region?: string | null;
  status: string;
}
