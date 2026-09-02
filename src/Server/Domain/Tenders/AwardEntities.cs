using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Tenders;

public class AwardRecommendation : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public Guid SelectedBidId { get; set; }
    public Bid SelectedBid { get; set; } = null!;

    public decimal RecommendedAmount { get; set; } = 0;
    public DateTime RecommendationDate { get; set; } = DateTime.UtcNow;
    public string Justification { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING_APPROVAL"; // PENDING_APPROVAL, ENDORSED, REJECTED

    public ICollection<AwardDecision> Decisions { get; set; } = new List<AwardDecision>();
}

public class AwardDecision : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public Guid AwardRecommendationId { get; set; }
    public AwardRecommendation AwardRecommendation { get; set; } = null!;

    public string CouncilDecisionNumber { get; set; } = string.Empty; // e.g. "DEC-2026/14"
    public DateTime DecisionDate { get; set; } = DateTime.UtcNow;
    public string DecisionStatus { get; set; } = "APPROVED"; // APPROVED, REJECTED, POSTPONED
    public decimal FinalAwardedAmount { get; set; } = 0;
    public string? Notes { get; set; }
}
