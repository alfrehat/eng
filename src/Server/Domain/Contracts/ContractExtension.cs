using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractExtension : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string ExtensionNumber { get; set; } = string.Empty; // e.g. "EXT-01"
    public DateTime PreviousCompletionDate { get; set; }
    public DateTime RequestedCompletionDate { get; set; }
    public DateTime ApprovedCompletionDate { get; set; }
    public int ExtensionDays { get; set; } = 0;
    public string Reason { get; set; } = string.Empty;
    public DateTime RequestDate { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovalDate { get; set; }
    public string? DecisionReference { get; set; }
    public string Status { get; set; } = "REQUESTED"; // REQUESTED, APPROVED, REJECTED
}
