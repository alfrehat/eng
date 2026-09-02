using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Organization;
using NetTopologySuite.Geometries;

namespace Knm.Enterprise.Domain.Projects;

public enum ProjectLifecycleStatus
{
    Draft = 0,
    Planning = 1,
    Approved = 2,
    Active = 3,
    Suspended = 4,
    Completed = 5,
    Closed = 6,
    Cancelled = 7
}

public class Project : AuditableEntity
{
    public string ProjectNumber { get; set; } = string.Empty; // e.g. "PRJ-2026-0001" from NumberingEngine
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Managed types / categories from ReferenceDataEngine
    public string ProjectTypeCode { get; set; } = "ROADS"; // ROADS, BUILDINGS, WATER, INFRASTRUCTURE
    public string CategoryCode { get; set; } = "CAPITAL"; // CAPITAL, MAINTENANCE, EMERGENCY
    public ProjectLifecycleStatus Status { get; set; } = ProjectLifecycleStatus.Draft;
    public string PriorityLevel { get; set; } = "MEDIUM"; // HIGH, MEDIUM, LOW

    // Organization Link
    public Guid? OrganizationUnitId { get; set; }
    public OrganizationUnit? OrganizationUnit { get; set; }
    public string? ResponsibleEngineer { get; set; }
    public string? ExecutingAgency { get; set; }
    public string? OwnerAgency { get; set; }

    // Timeline
    public DateTime? StartDate { get; set; }
    public DateTime? PlannedEndDate { get; set; }
    public DateTime? ActualEndDate { get; set; }

    // Financial Overview
    public decimal EstimatedCost { get; set; } = 0;
    public decimal ContractValue { get; set; } = 0;
    public decimal ActualExpenditure { get; set; } = 0;
    public string? PrimaryFundingSource { get; set; }

    // Progress
    public decimal ProgressPercentage { get; set; } = 0; // 0 to 100

    // GIS Spatial Integration (PostGIS NetTopologySuite)
    public Geometry? LocationGeometry { get; set; } // Point, LineString or Polygon in SRID 4326
    public string? LocationDescription { get; set; }
    public string? Address { get; set; }

    // Programs & Notes
    public string? ProgramName { get; set; }
    public string? PlanName { get; set; }
    public string? Notes { get; set; }

    // Navigation Collections
    public ICollection<ProjectMilestone> Milestones { get; set; } = new List<ProjectMilestone>();
    public ICollection<ProjectAllocation> Allocations { get; set; } = new List<ProjectAllocation>();
    public ICollection<ProjectExpenditure> Expenditures { get; set; } = new List<ProjectExpenditure>();
    public ICollection<ProjectPriorityScore> PriorityScores { get; set; } = new List<ProjectPriorityScore>();
    public ICollection<PortfolioItem> PortfolioItems { get; set; } = new List<PortfolioItem>();
    public ICollection<ProjectSchedule> Schedules { get; set; } = new List<ProjectSchedule>();
}
