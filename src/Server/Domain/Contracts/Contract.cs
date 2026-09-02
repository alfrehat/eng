using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Domain.Tenders;

namespace Knm.Enterprise.Domain.Contracts;

public enum ContractWorkflowState
{
    Draft = 0,
    UnderReview = 1,
    ApprovedForSigning = 2,
    SignaturePending = 3,
    Signed = 4,
    Active = 5,
    Suspended = 6,
    ExtensionRequested = 7,
    AmendmentRequested = 8,
    VariationRequested = 9,
    Completed = 10,
    Closed = 11,
    Terminated = 12,
    Cancelled = 13
}

public class Contract : AuditableEntity
{
    public string ContractNumber { get; set; } = string.Empty; // e.g. "CON-2026-0001" from Numbering Engine
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Chain Linkage (Mandatory prerequisites)
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public Guid? AwardRecommendationId { get; set; }
    public AwardRecommendation? AwardRecommendation { get; set; }

    public Guid? AwardDecisionId { get; set; }
    public AwardDecision? AwardDecision { get; set; }

    // Dynamic Classifications (Managed via Reference Data)
    public string ContractTypeCode { get; set; } = "WORKS"; // WORKS, SUPPLY, SERVICES, CONSULTANCY, MAINTENANCE
    public ContractWorkflowState ContractStatus { get; set; } = ContractWorkflowState.Draft;

    // Parties
    public Guid? ContractorPartyId { get; set; }
    public ContractParty? ContractorParty { get; set; }

    // Chronology (Original is immutable after signing; Current is modified only via approved extensions)
    public DateTime ContractDate { get; set; } = DateTime.UtcNow;
    public DateTime? NoticeToProceedDate { get; set; }
    public DateTime? CommencementDate { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime OriginalCompletionDate { get; set; }
    public DateTime CurrentCompletionDate { get; set; }

    // Financial Values (Original is immutable; Current is adjusted only via approved variations/amendments)
    public decimal OriginalValue { get; set; } = 0;
    public decimal TaxAmount { get; set; } = 0;
    public decimal TotalValue { get; set; } = 0;
    public decimal CurrentContractValue { get; set; } = 0;
    public string Currency { get; set; } = "JOD";

    // References
    public string? ProcurementReference { get; set; }
    public string? ExternalReference { get; set; }
    public string? Notes { get; set; }

    // Navigation Collections
    public ICollection<ContractPartyRole> PartyRoles { get; set; } = new List<ContractPartyRole>();
    public ICollection<ContractBoq> Boqs { get; set; } = new List<ContractBoq>();
    public ICollection<ContractGuarantee> Guarantees { get; set; } = new List<ContractGuarantee>();
    public ICollection<ContractExtension> Extensions { get; set; } = new List<ContractExtension>();
    public ICollection<ContractVariation> Variations { get; set; } = new List<ContractVariation>();
    public ICollection<ContractMilestone> Milestones { get; set; } = new List<ContractMilestone>();
    public ICollection<ContractNotice> Notices { get; set; } = new List<ContractNotice>();
    public ICollection<ContractSignature> Signatures { get; set; } = new List<ContractSignature>();
    public ICollection<ContractPaymentLink> PaymentLinks { get; set; } = new List<ContractPaymentLink>();
}
