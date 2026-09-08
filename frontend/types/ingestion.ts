export interface IngestionResult {
  processed: number;
  created: number;
  updated: number;
  events_created: number;
  import_log_id: number;
}

export interface ImportLog {
  id: number;
  source?: string | null;
  import_type?: string | null;
  records_processed?: number | null;
  records_created?: number | null;
  records_updated?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
}
