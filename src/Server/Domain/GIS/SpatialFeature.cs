using Knm.Enterprise.Domain.Common;
using NetTopologySuite.Geometries;

namespace Knm.Enterprise.Domain.GIS;

public class SpatialFeature : AuditableEntity
{
    public string FeatureType { get; set; } = string.Empty; // ROAD_CENTERLINE, ZONE_BOUNDARY, INFRASTRUCTURE_POINT
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public Geometry Geometry { get; set; } = null!; // PostGIS PostGIS geometry (Point, LineString, Polygon)
    public int Srid { get; set; } = 4326; // WGS 84
    public string? PropertiesJson { get; set; }
}
