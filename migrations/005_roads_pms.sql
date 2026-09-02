-- ====================================================================
-- SCRIPT: 005_roads_pms.sql
-- DESCRIPTION: Pavement Management System (PMS) & GIS Road Network Schema
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create Roads Table
CREATE TABLE IF NOT EXISTS roads (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    classification VARCHAR(100) DEFAULT 'فرعي',
    category VARCHAR(100) DEFAULT 'فرعي',
    length_km NUMERIC(10,3) DEFAULT 0.000,
    "lengthKm" NUMERIC(10,3) DEFAULT 0.000,
    width_m NUMERIC(8,2) DEFAULT 0.00,
    "widthMeters" NUMERIC(8,2) DEFAULT 0.00,
    surface_type VARCHAR(100) DEFAULT 'خلطة ساخنة',
    "surfaceType" VARCHAR(100) DEFAULT 'خلطة ساخنة',
    pci_score NUMERIC(5,2) DEFAULT 85.00,
    "conditionIndex" NUMERIC(5,2) DEFAULT 85.00,
    last_maintenance_date DATE,
    lanes INT DEFAULT 2,
    "geoJson" TEXT,
    geom GEOMETRY(LineString, 4326),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for Spatial Queries
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_roads_pci ON roads(pci_score);

-- 2. Create Pavement Inspections Table
CREATE TABLE IF NOT EXISTS pavement_inspections (
    inspection_id VARCHAR(100) PRIMARY KEY,
    road_id VARCHAR(100) NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    inspection_date DATE DEFAULT CURRENT_DATE,
    defect_type VARCHAR(150) NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('منخفضة (Low)', 'متوسطة (Medium)', 'عالية (High)', 'منخفضة', 'متوسطة', 'عالية')),
    recommended_action VARCHAR(255),
    pci_impact NUMERIC(5,2) DEFAULT 0.00,
    inspector_name VARCHAR(150),
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pavement_inspections_road ON pavement_inspections(road_id);

-- 3. Automatic PCI Recalculation Trigger Function
CREATE OR REPLACE FUNCTION update_road_pci_on_inspection()
RETURNS TRIGGER AS $$
DECLARE
    total_deduct NUMERIC(5,2);
    new_pci NUMERIC(5,2);
BEGIN
    SELECT COALESCE(SUM(pci_impact), 0) INTO total_deduct
    FROM pavement_inspections
    WHERE road_id = NEW.road_id;

    new_pci := GREATEST(0.00, 100.00 - total_deduct);

    UPDATE roads
    SET pci_score = new_pci,
        "conditionIndex" = new_pci,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW.road_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_road_pci ON pavement_inspections;
CREATE TRIGGER trg_update_road_pci
AFTER INSERT OR UPDATE OR DELETE ON pavement_inspections
FOR EACH ROW EXECUTE FUNCTION update_road_pci_on_inspection();

-- 4. View for Real-time Road Network PCI Analytics & GeoJSON Output
CREATE OR REPLACE VIEW v_roads_geojson AS
SELECT 
    r.id,
    r.code,
    r.name,
    COALESCE(r.classification, r.category) AS classification,
    COALESCE(r.length_km, r."lengthKm") AS length_km,
    COALESCE(r.width_m, r."widthMeters") AS width_m,
    COALESCE(r.surface_type, r."surfaceType") AS surface_type,
    COALESCE(r.pci_score, r."conditionIndex") AS pci_score,
    CASE 
        WHEN COALESCE(r.pci_score, r."conditionIndex") >= 85 THEN 'ممتازة (Good)'
        WHEN COALESCE(r.pci_score, r."conditionIndex") >= 60 THEN 'متوسطة (Fair)'
        ELSE 'متدهورة (Poor)'
    END AS pci_status_ar,
    CASE 
        WHEN COALESCE(r.pci_score, r."conditionIndex") >= 85 THEN '#28a745'
        WHEN COALESCE(r.pci_score, r."conditionIndex") >= 60 THEN '#ffc107'
        ELSE '#dc3545'
    END AS pci_color_code,
    r.last_maintenance_date,
    r.lanes,
    r."geoJson",
    CASE WHEN r.geom IS NOT NULL THEN ST_AsGeoJSON(r.geom) ELSE NULL END AS geom_geojson,
    r."createdAt",
    r."updatedAt"
FROM roads r;
