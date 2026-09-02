using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Organization;
using Knm.Enterprise.Domain.Projects;

namespace Knm.Enterprise.Domain.Tenders;

public enum TenderLifecycleState
{
    Draft = 0,
    Preparation = 1,
    Review = 2,
    ApprovedForPublication = 3,
    Published = 4,
    BiddingOpen = 5,
    BiddingClosed = 6,
    Opening = 7,
    Evaluation = 8,
    AwardRecommendation = 9,
    Awarded = 10,
    Cancelled = 11,
    Closed = 12
}

public class Tender : AuditableEntity
{
    public string TenderNumber { get; set; } = string.Empty; // e.g. "TEN-2026-0001" from NumberingEngine
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Project Linkage (Mandatory: Every tender relates to a Project)
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    // Zero-Code Dynamic Classifications (Managed via ReferenceDataEngine)
    public string TenderTypeCode { get; set; } = "WORKS"; // WORKS, SUPPLIES, SERVICES, CONSULTING
    public string TenderMethodCode { get; set; } = "OPEN"; // OPEN, RESTRICTED, DIRECT_PURCHASE
    public string CategoryCode { get; set; } = "ROADS"; // ROADS, BUILDINGS, INFRASTRUCTURE
    public TenderLifecycleState Status { get; set; } = TenderLifecycleState.Draft;

    // Organization & Personnel
    public Guid? OrganizationUnitId { get; set; }
    public OrganizationUnit? OrganizationUnit { get; set; }
    public string? ResponsibleEngineer { get; set; }

    // Financial Overview
    public decimal EstimatedValue { get; set; } = 0;
    public string Currency { get; set; } = "JOD";
    public Guid? FinancialProgramId { get; set; }
    public Guid? BudgetItemId { get; set; }
    public Guid? FundingSourceId { get; set; }

    // Milestones & Dates
    public DateTime? PublicationDate { get; set; }
    public DateTime? ClosingDate { get; set; }
    public DateTime? OpeningDate { get; set; }

    public string? Notes { get; set; }

    // Child Collections
    public ICollection<TenderDocument> Documents { get; set; } = new List<TenderDocument>();
    public ICollection<TenderBoq> Boqs { get; set; } = new List<TenderBoq>();
    public ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public ICollection<TenderOpening> Openings { get; set; } = new List<TenderOpening>();
    public ICollection<EvaluationCommittee> EvaluationCommittees { get; set; } = new List<EvaluationCommittee>();
    public ICollection<AwardRecommendation> AwardRecommendations { get; set; } = new List<AwardRecommendation>();
}
