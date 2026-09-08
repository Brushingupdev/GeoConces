"""
Seed script to populate sample concessions for development.
Run with: docker-compose exec backend python scripts/seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.ingestion.service import IngestionService
from datetime import datetime, timezone, timedelta

REGIONES = ["Ancash", "Arequipa", "Cajamarca", "Cusco", "La Libertad", "Lima", "Puno"]

def seed():
    db = SessionLocal()
    try:
        from app.models import Concession

        existing = db.query(Concession).first()
        if existing:
            print("Database already seeded. Skipping.")
            return

        rows = []
        for i in range(1, 51):
            region = REGIONES[i % len(REGIONES)]
            lat = -8.0 - (i % 10)
            lng = -75.0 - (i % 5)
            rows.append(
                {
                    "code": f"CONC-{i:04d}",
                    "name": f"Concesión Demo {i}",
                    "holder_name": f"Empresa Minera {i}",
                    "holder_ruc": f"20{i:09d}",
                    "status": "active" if i % 5 != 0 else "expired",
                    "concession_type": "Metalífera" if i % 2 == 0 else "No metalífera",
                    "region": region,
                    "province": "Provincia Demo",
                    "district": "Distrito Demo",
                    "area_hectares": 1000.0 + i * 10,
                    "registration_date": datetime.now(timezone.utc) - timedelta(days=i * 30),
                    "title_date": datetime.now(timezone.utc) - timedelta(days=i * 30),
                    "expiration_date": datetime.now(timezone.utc) + timedelta(days=365 * (5 if i % 5 != 0 else -1)),
                    "geometry_wkt": (
                        f"POLYGON(({lng} {lat}, {lng+0.5} {lat}, {lng+0.5} {lat+0.5}, "
                        f"{lng} {lat+0.5}, {lng} {lat}))"
                    ),
                }
            )

        result = IngestionService(db).ingest_concessions(
            rows=rows,
            source="seed",
            import_type="seed",
        )
        print(f"Seeded sample concessions: {result}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
