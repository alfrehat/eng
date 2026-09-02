using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractMilestone : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MilestoneType { get; set; } = "TECHNICAL"; // TECHNICAL, PAYMENT, COMPLETION
    public DateTime PlannedDate { get; set; }
    public DateTime? ActualDate { get; set; }
    public decimal Percentage { get; set; } = 0;
    public string Status { get; set; } = "PENDING"; // PENDING, IN_PROGRESS, ACHIEVED
}

public class ContractNotice : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string NoticeType { get; set; } = "COMMENCEMENT"; // COMMENCEMENT, DELAY_WARNING, DEFECT_NOTICE, GENERAL
    public string ReferenceNumber { get; set; } = string.Empty;
    public DateTime NoticeDate { get; set; } = DateTime.UtcNow;
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public string Receiver { get; set; } = string.Empty;
    public bool ResponseRequired { get; set; } = false;
    public DateTime? ResponseDeadline { get; set; }
    public string Status { get; set; } = "ISSUED"; // ISSUED, ACKNOWLEDGED, RESOLVED
}

public class ContractSignature : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string SignerName { get; set; } = string.Empty;
    public string SignerRole { get; set; } = "MAYOR"; // MAYOR, CONTRACTOR, WITNESS
    public DateTime SignatureDate { get; set; } = DateTime.UtcNow;
    public string SignatureStatus { get; set; } = "VERIFIED"; // PENDING, VERIFIED, REJECTED
    public string? CertificateReference { get; set; }
    public string HashAlgorithm { get; set; } = "SHA-256";
    public string DocumentHash { get; set; } = string.Empty; // SHA-256 hex string
    public string? SignatureReference { get; set; }
}

public class ContractPaymentLink : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string ReferenceType { get; set; } = "INTERIM_PAYMENT_CERTIFICATE"; // INTERIM_PAYMENT_CERTIFICATE, ADVANCE_PAYMENT, FINAL_ACCOUNT
    public string PaymentClaimReference { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0;
    public string Status { get; set; } = "LINKED"; // LINKED, APPROVED, DISBURSED
    public DateTime LinkedDate { get; set; } = DateTime.UtcNow;
}
