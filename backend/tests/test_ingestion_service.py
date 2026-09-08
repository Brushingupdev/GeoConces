import io
import json
import zipfile

from app.ingestion.parser import (
    IngestionParseError,
    parse_csv_bytes,
    parse_geojson_bytes,
    parse_shapefile_zip_bytes,
)
from app.ingestion.service import IngestionService
from app.models import ConcessionStatus


def test_normalize_status_maps_spanish_values():
    service = IngestionService(db=None)

    assert service.normalize_status("vigente") == ConcessionStatus.active
    assert service.normalize_status("caducado") == ConcessionStatus.expired
    assert service.normalize_status("en trámite") == ConcessionStatus.pending


def test_normalize_row_cleans_basic_fields():
    service = IngestionService(db=None)

    row = service.normalize_row(
        {
            "code": " abc-123 ",
            "name": " Mina Norte ",
            "holder_ruc": "20-12345678-9",
            "status": "activo",
            "area_hectares": "1250.5",
        },
        source="GEOCATMIN",
    )

    assert row["code"] == "ABC-123"
    assert row["name"] == "Mina Norte"
    assert row["holder_ruc"] == "20123456789"
    assert row["status"] == ConcessionStatus.active
    assert row["area_hectares"] == 1250.5
    assert row["source"] == "GEOCATMIN"


def test_parse_csv_bytes_maps_spanish_headers():
    rows = parse_csv_bytes(
        (
            "codigo,nombre,titular,ruc,estado,hectareas,geometry\n"
            "abc-123,Mina Sur,Empresa Uno,20123456789,vigente,1500.25,"
            "\"POLYGON((-75 -10,-74 -10,-74 -9,-75 -9,-75 -10))\"\n"
        ).encode("utf-8")
    )

    assert len(rows) == 1
    assert rows[0]["code"] == "abc-123"
    assert rows[0]["name"] == "Mina Sur"
    assert rows[0]["holder_name"] == "Empresa Uno"
    assert rows[0]["holder_ruc"] == "20123456789"
    assert rows[0]["status"] == "vigente"
    assert rows[0]["area_hectares"] == "1500.25"
    assert rows[0]["geometry_wkt"] == "POLYGON((-75 -10,-74 -10,-74 -9,-75 -9,-75 -10))"


def test_parse_csv_bytes_requires_code():
    try:
        parse_csv_bytes("nombre\nSin codigo\n".encode("utf-8"))
    except IngestionParseError as exc:
        assert "code" in str(exc)
    else:
        raise AssertionError("Expected IngestionParseError for missing code column")


def test_parse_geojson_bytes_maps_properties_and_geometry():
    rows = parse_geojson_bytes(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "codigo": "geo-001",
                            "nombre": "Geo Mina",
                            "titular": "Geo Empresa",
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[-75, -10], [-74, -10], [-74, -9], [-75, -9], [-75, -10]]],
                        },
                    }
                ],
            }
        ).encode("utf-8")
    )

    assert len(rows) == 1
    assert rows[0]["code"] == "geo-001"
    assert rows[0]["name"] == "Geo Mina"
    assert rows[0]["holder_name"] == "Geo Empresa"
    assert rows[0]["geometry_geojson"]["type"] == "Polygon"


def test_parse_shapefile_zip_bytes_maps_attributes_and_geometry():
    try:
        import shapefile
    except ModuleNotFoundError:
        return

    shp_buffer = io.BytesIO()
    shx_buffer = io.BytesIO()
    dbf_buffer = io.BytesIO()

    writer = shapefile.Writer(shp=shp_buffer, shx=shx_buffer, dbf=dbf_buffer)
    writer.field("codigo", "C")
    writer.field("nombre", "C")
    writer.record("shp-001", "Shape Mina")
    writer.poly([[[-75, -10], [-74, -10], [-74, -9], [-75, -9], [-75, -10]]])
    writer.close()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as archive:
        archive.writestr("concesiones.shp", shp_buffer.getvalue())
        archive.writestr("concesiones.shx", shx_buffer.getvalue())
        archive.writestr("concesiones.dbf", dbf_buffer.getvalue())

    rows = parse_shapefile_zip_bytes(zip_buffer.getvalue())

    assert len(rows) == 1
    assert rows[0]["code"] == "shp-001"
    assert rows[0]["name"] == "Shape Mina"
    assert rows[0]["geometry_geojson"]["type"] == "Polygon"
