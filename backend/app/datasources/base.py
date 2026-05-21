"""Base interface for external data source clients."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from app.schemas import IngestionConcessionRow


@dataclass
class FetchResult:
    source: str
    rows: List[IngestionConcessionRow] = field(default_factory=list)
    fetched_at: Optional[str] = None
    notes: Optional[str] = None


class DataSourceClient(ABC):
    """Abstract base class for external mining data source clients.

    Implement fetch_concessions() returning IngestionConcessionRow instances
    that the existing IngestionService already knows how to persist.
    """

    source_name: str = ""

    @abstractmethod
    def fetch_concessions(self, since: Optional[str] = None, limit: Optional[int] = None) -> FetchResult:
        """Return normalized concession rows ready to be ingested.

        Args:
            since: ISO date string; the client should return changes after this.
            limit: Soft cap on rows; clients may ignore.
        """
        raise NotImplementedError

    def health_check(self) -> bool:
        """Optional probe to verify the remote source is reachable."""
        return True
