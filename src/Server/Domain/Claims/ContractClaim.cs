using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Contracts;

namespace Knm.Enterprise.Domain.Claims;

public enum ClaimWorkflowState
{
    Draft = 0,
    MeasurementPending = 1,
    Measured = 2,
    Submitted = 3,
    TechnicalReview = 4,
    FinancialReview = 5,
    CertificationPending = 6,
    Certified = 7,
    PaymentPending = 8,
    PaymentReferred = 9,
    Paid = 10,
    Rejected = 11,
    Cancelled = 12
}

public class ContractClaim : AuditableEntity
{
    public string ClaimNumber { get; set; } = string.Empty; // Numbering Engine e.g. "CLM-2026-0001"
    
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string ClaimTypeCode { get; set; } = "INTERIM_PAYMENT"; // INTERIM_PAYMENT, FINAL_PAYMENT, ADVANCE_PAYMENT, RETENTION_RELEASE
    
    public DateTime ClaimPeriodFrom { get; set; }
    public DateTime ClaimPeriodTo { get; set; }
    public DateTime? SubmissionDate { get; set; }

    public ClaimWorkflowState Status { get; set; } = ClaimWorkflowState.Draft;

    // Financial Totals
    public decimal GrossAmount { get; set; } = 0;
    public decimal DeductionAmount { get; set; } = 0;
    public decimal NetAmount { get; set; } = 0;

    // Cumulative tracking
    public decimal PreviousCertifiedAmount { get; set; } = 0;
    public decimal CurrentCertifiedAmount { get; set; } = 0;
    public decimal CumulativeCertifiedAmount { get; set; } = 0;

    public string? Notes { get; set; }

    // Navigation Collections
    public ICollection<ClaimItem> Items { get; set; } = new List<ClaimItem>();
    public ICollection<MeasurementRecord> Measurements { get; set; } = new List<MeasurementRecord>();
    public ICollection<ProgressRecord> ProgressRecords { get; set; } = new List<ProgressRecord>();
    public ICollection<PaymentCertificate> Certificates { get; set; } = new List<PaymentCertificate>();
    public ICollection<CertificateDeduction> Deductions { get; set; } = new List<CertificateDeduction>();
    public ICollection<ClaimAdjustment> Adjustments { get; set; } = new List<ClaimAdjustment>();
    public ICollection<ClaimPaymentLink> PaymentLinks { get; set; } = new List<ClaimPaymentLink>();
}
