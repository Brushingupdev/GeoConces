"""
Import concessions from a real file using the shared ingestion pipeline.

Examples:
    python scripts/import_concessions.py /path/to/concesiones.csv
    python scripts/import_concessions.py /path/to/concesiones.geojson --source geocatmin
    python scripts/import_concessions.py /path/to/concesiones.zip --source shapefile --import-type bulk_sync
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import concessions from CSV, XLSX, GeoJSON, or shapefile zip.")
    parser.add_argument("file_path", help="Path to the source file")
    parser.add_argument("--source", default="manual_file", help="Logical source name stored in data_import_logs")
    parser.add_argument("--import-type", default="manual_file", help="Import type stored in data_import_logs")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        from app.core.database import SessionLocal
        from app.ingestion.parser import IngestionParseError, parse_tabular_upload
        from app.ingestion.service import IngestionService
    except ModuleNotFoundError as exc:
        print(f"Missing dependency: {exc}. Install backend requirements first.")
        return 1

    if not os.path.exists(args.file_path):
        print(f"File not found: {args.file_path}")
        return 1

    with open(args.file_path, "rb") as file_handle:
        content = file_handle.read()

    try:
        rows = parse_tabular_upload(content, args.file_path)
    except IngestionParseError as exc:
        print(f"Could not parse file: {exc}")
        return 1

    db = SessionLocal()
    try:
        result = IngestionService(db).ingest_concessions(
            rows=rows,
            source=args.source,
            import_type=args.import_type,
        )
    finally:
        db.close()

    print("Import completed:")
    for key, value in result.items():
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
