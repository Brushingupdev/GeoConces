"""Registry of available external data source clients."""

from typing import Dict, List

from app.datasources.base import DataSourceClient
from app.geocatmin.client import GEOCATMINClient
from app.sidemcat.client import SIDEMCATClient
from app.datasources.ingemmet import INGEMMETClient


REGISTRY: Dict[str, DataSourceClient] = {
    "GEOCATMIN": GEOCATMINClient(),
    "SIDEMCAT": SIDEMCATClient(),
    "INGEMMET": INGEMMETClient(),
}


def get_client(source: str) -> DataSourceClient:
    key = source.upper()
    if key not in REGISTRY:
        raise KeyError(f"Fuente desconocida: {source}. Disponibles: {list(REGISTRY)}")
    return REGISTRY[key]


def list_sources() -> List[str]:
    return list(REGISTRY.keys())


def is_known_source(source: str) -> bool:
    return source.upper() in REGISTRY
