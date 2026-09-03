using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Claims;

public class PaymentCertificate : AuditableEntity
{
    public string CertificateNumber { get; set; } = string.Empty; // Numbering Engine e.g. "CERT-2026-0001"

    public Guid ContractClaimId { get; set; }
    public ContractClaim ContractClaim { get; set; } = null!;

    public DateTime CertificateDate { get; set; } = DateTime.UtcNow;

    public decimal GrossCertified { get; set; } = 0;
    public decimal PreviousCertified { get; set; } = 0;
    public decimal CurrentCertified { get; set; } = 0;
    public decimal CumulativeCertified { get; set; } = 0;

    public decimal DeductionsTotal { get; set; } = 0;
    public decimal NetCertified { get; set; } = 0;

    public string Status { get; set; } = "PENDING"; // PENDING, CERTIFIED, REJECTED
    
    public string? CertifiedBy { get; set; }
    public DateTime? CertificationDate { get; set; }
    public string? Notes { get; set; }

    public ICollection<CertificateDeduction> Deductions { get; set; } = new List<CertificateDeduction>();
    public ICollection<RetentionRecord> RetentionRecords { get; set; } = new List<RetentionRecord>();
    public ICollection<AdvanceRecovery> AdvanceRecoveries { get; set; } = new List<AdvanceRecovery>();
    public ICollection<ClaimPaymentLink> PaymentLinks { get; set; } = new List<ClaimPaymentLink>();
}
