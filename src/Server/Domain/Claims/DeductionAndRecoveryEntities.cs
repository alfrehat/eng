using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Contracts;

namespace Knm.Enterprise.Domain.Claims;

public class CertificateDeduction : AuditableEntity
{
    public Guid ContractClaimId { get; set; }
    public ContractClaim ContractClaim { get; set; } = null!;

    public Guid? PaymentCertificateId { get; set; }
    public PaymentCertificate? PaymentCertificate { get; set; }

    public string DeductionTypeCode { get; set; } = "RETENTION"; // RETENTION, ADVANCE_RECOVERY, PENALTY, TAX_WITHHOLDING, OTHER
    public string Description { get; set; } = string.Empty;
    public decimal Rate { get; set; } = 0; // %
    public decimal Amount { get; set; } = 0;
    public string? Reference { get; set; }
    public bool IsApproved { get; set; } = true;
    public string? Notes { get; set; }
}

public class RetentionRecord : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public Guid? PaymentCertificateId { get; set; }
    public PaymentCertificate? PaymentCertificate { get; set; }

    public decimal Rate { get; set; } = 5; // Configurable %
    public decimal Amount { get; set; } = 0;
    public decimal CumulativeRetention { get; set; } = 0;
    public decimal ReleasedAmount { get; set; } = 0;
    public decimal RemainingRetention { get; set; } = 0;
    public string? Notes { get; set; }
}

public class AdvanceRecovery : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public Guid? PaymentCertificateId { get; set; }
    public PaymentCertificate? PaymentCertificate { get; set; }

    public decimal OriginalAdvance { get; set; } = 0;
    public decimal RecoveredToDate { get; set; } = 0;
    public decimal CurrentRecovery { get; set; } = 0;
    public decimal RemainingAdvance { get; set; } = 0;
    public string? Notes { get; set; }
}
