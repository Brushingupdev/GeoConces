"""
Actualiza concesiones con data limpia del shapefile oficial de INGEMMET.

Campos actualizados:
  - registration_date  → FEC_DENU (YYYYMMDD, más preciso que epoch ms)
  - area_hectares      → HASDATUM (área geodésica calculada por INGEMMET)
  - name               → CONCESION (UTF-8 corregido)
  - holder_name        → TIT_CONCES (UTF-8 corregido)
  - region             → DEPA (title-case limpio)
  - province           → PROVI (title-case limpio)
  - district           → DISTRI (title-case limpio)
  - concession_type    → SUSTANCIA normalizado
"""

import struct, os
from datetime import date, datetime, timezone
import psycopg2, psycopg2.extras

DB_DSN = "host=localhost port=5432 dbname=geoconces user=postgres password=postgres"
BASE   = "/tmp/catastro_shp"
ZONES  = ["17S", "18S", "19S"]
FILE   = "CatastroMinero_WGS84_{zone}_180526.dbf"

SUSTANCIA_MAP = {"M": "Metálica", "NM": "No metálica",
                 "MN": "Metálica y no metálica", "E": "Energética", "N": "No metálica"}
COMMIT_EVERY = 3000

def read_dbf(path):
    with open(path, "rb") as f:
        f.read(4)
        rec_count  = struct.unpack("<I", f.read(4))[0]
        header_sz  = struct.unpack("<H", f.read(2))[0]
        f.read(22)
        fields = []
        while f.tell() < header_sz - 1:
            name   = f.read(11).rstrip(b"\x00").decode("latin-1")
            ftype  = f.read(1).decode("latin-1")
            f.read(4)
            length = struct.unpack("B", f.read(1))[0]
            f.read(15)
            if name: fields.append((name, ftype, length))
        f.seek(header_sz)
        for _ in range(rec_count):
            flag = f.read(1)
            row  = {n: f.read(l).decode("utf-8", "replace").strip()
                    for n, t, l in fields}
            if flag != b"*":
                yield row

def parse_date(s):
    s = (s or "").strip()
    if len(s) != 8: return None
    try:
        d = date(int(s[:4]), int(s[4:6]), int(s[6:]))
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    except (ValueError, OverflowError):
        return None

def parse_float(s):
    try: return float(s) if s else None
    except ValueError: return None

def main():
    conn = psycopg2.connect(DB_DSN)
    cur  = conn.cursor()
    total_updated = total_skipped = 0
    batch = []

    for zone in ZONES:
        path = os.path.join(BASE, zone, FILE.format(zone=zone))
        if not os.path.exists(path):
            print(f"SKIP: {path}"); continue

        count = 0
        for row in read_dbf(path):
            code = row.get("CODIGOU", "").strip().upper()
            if not code: continue

            reg_date    = parse_date(row.get("FEC_DENU"))
            area        = parse_float(row.get("HASDATUM"))
            name        = row.get("CONCESION", "").strip() or None
            holder_name = row.get("TIT_CONCES", "").strip() or None
            region      = row.get("DEPA", "").strip().title() or None
            province    = row.get("PROVI", "").strip().title() or None
            district    = row.get("DISTRI", "").strip().title() or None
            sustancia   = row.get("SUSTANCIA", "").strip().upper()
            c_type      = SUSTANCIA_MAP.get(sustancia) or sustancia or None

            batch.append((reg_date, area, name, holder_name,
                          region, province, district, c_type, code))
            count += 1

            if len(batch) >= COMMIT_EVERY:
                u, s = _flush(cur, conn, batch)
                total_updated += u; total_skipped += s
                batch = []
                sys.stdout.write(f"\r  Zone {zone}: {count:>6} leídos | "
                                 f"{total_updated:>6} actualizados | "
                                 f"{total_skipped:>6} sin match")
                sys.stdout.flush()

        print(f"\nZone {zone}: {count} registros")

    if batch:
        u, s = _flush(cur, conn, batch)
        total_updated += u; total_skipped += s

    cur.close(); conn.close()
    print(f"\n✅ Completado:")
    print(f"   Actualizadas: {total_updated:,}")
    print(f"   Sin match:    {total_skipped:,}")

def _flush(cur, conn, batch):
    # Use RETURNING to count actual matches
    psycopg2.extras.execute_batch(
        cur,
        """UPDATE concessions SET
               registration_date = %s,
               area_hectares     = COALESCE(%s, area_hectares),
               name              = COALESCE(%s, name),
               holder_name       = COALESCE(%s, holder_name),
               region            = COALESCE(%s, region),
               province          = COALESCE(%s, province),
               district          = COALESCE(%s, district),
               concession_type   = COALESCE(%s, concession_type),
               updated_at        = NOW()
           WHERE code = %s""",
        batch,
        page_size=500,
    )
    # Count matches by checking how many codes exist
    codes = [b[-1] for b in batch]
    cur.execute("SELECT COUNT(*) FROM concessions WHERE code = ANY(%s)", (codes,))
    matched = cur.fetchone()[0]
    conn.commit()
    return matched, len(batch) - matched

import sys
if __name__ == "__main__":
    main()
