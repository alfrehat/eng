using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractGuarantee : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string GuaranteeType { get; set; } = "PERFORMANCE_BOND"; // PERFORMANCE_BOND, ADVANCE_PAYMENT, RETENTION, DEFECTS_LIABILITY
    public string ReferenceNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0;
    public string Currency { get; set; } = "JOD";
    public DateTime IssueDate { get; set; } = DateTime.UtcNow;
    public DateTime ExpiryDate { get; set; } = DateTime.UtcNow.AddDays(180);
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, EXPIRED, RELEASED, CONFISCATED
    public string? Notes { get; set; }
}
