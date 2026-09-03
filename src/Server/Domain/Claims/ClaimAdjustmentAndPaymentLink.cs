using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Storage;

namespace Knm.Enterprise.Domain.Claims;

public class ClaimAdjustment : AuditableEntity
{
    public Guid ContractClaimId { get; set; }
    public ContractClaim ContractClaim { get; set; } = null!;

    public string AdjustmentType { get; set; } = "ENGINEER_CORRECTION"; // ENGINEER_CORRECTION, AUDIT_ADJUSTMENT, PENALTY_CORRECTION
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0; // Positive (addition) or negative (deduction)
    public string Reason { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public bool IsApproved { get; set; } = false;
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovalDate { get; set; }
}

public class ClaimDocument : AuditableEntity
{
    public Guid ContractClaimId { get; set; }
    public ContractClaim ContractClaim { get; set; } = null!;

    public Guid? StoredFileId { get; set; }
    public StoredFile? StoredFile { get; set; }

    public string DocumentType { get; set; } = "MEASUREMENT_SHEET"; // MEASUREMENT_SHEET, ENGINEER_CERTIFICATE, INVOICE, SITE_EVIDENCE, APPROVAL
    public string Title { get; set; } = string.Empty;
    public string? Reference { get; set; }
}

public class ClaimPaymentLink : AuditableEntity
{
    public Guid PaymentCertificateId { get; set; }
    public PaymentCertificate PaymentCertificate { get; set; } = null!;

    public Guid? FinancialProgramId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? BudgetItemId { get; set; }
    public Guid? FundingSourceId { get; set; }

    public decimal Amount { get; set; } = 0;
    public string Reference { get; set; } = string.Empty;
    public string PaymentStatus { get; set; } = "NOT_REFERRED"; // NOT_REFERRED, REFERRED, CONFIRMED
    public DateTime? ReferredDate { get; set; }
    public DateTime? ConfirmedDate { get; set; }
    public string? Notes { get; set; }
}
