"""INGEMMET client stub.

INGEMMET publishes the official catastro minero as downloadable shapefiles
on a monthly basis. The real implementation will:
  1. Download the latest catastro ZIP from the public portal.
  2. Extract the shapefile.
  3. Re-use IngestionService with import_type="shapefile" to persist rows.
"""

from typing import Optional

from app.datasources.base import DataSourceClient, FetchResult


class INGEMMETClient(DataSourceClient):
    source_name = "INGEMMET"

    def fetch_concessions(self, since: Optional[str] = None, limit: Optional[int] = None) -> FetchResult:
        # TODO: descargar shapefile mensual y devolverlo procesado.
        return FetchResult(source=self.source_name, rows=[], notes="not_implemented")
