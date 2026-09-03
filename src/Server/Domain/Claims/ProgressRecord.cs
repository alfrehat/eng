using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Contracts;

namespace Knm.Enterprise.Domain.Claims;

public class ProgressRecord : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public Guid? ClaimId { get; set; }
    public ContractClaim? Claim { get; set; }

    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }

    public decimal PhysicalProgress { get; set; } = 0; // %
    public decimal FinancialProgress { get; set; } = 0; // %
    public decimal OverallProgress { get; set; } = 0; // %

    public string? ApprovedBy { get; set; }
    public DateTime? ApprovalDate { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, APPROVED
    public string? Notes { get; set; }
}
