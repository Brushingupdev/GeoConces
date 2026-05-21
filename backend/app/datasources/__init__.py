"""Common interface for external data source clients.

Each data source (GEOCATMIN, SIDEMCAT, INGEMMET, etc.) implements DataSourceClient
and registers itself in `REGISTRY`. The sync orchestrator iterates the registry,
calls fetch_concessions(), and passes the rows through the existing IngestionService.

This keeps the wiring stable while real API integrations are added later.
"""

from app.datasources.base import DataSourceClient, FetchResult
from app.datasources.registry import REGISTRY, get_client, list_sources

__all__ = (
    "DataSourceClient",
    "FetchResult",
    "REGISTRY",
    "get_client",
    "list_sources",
)
