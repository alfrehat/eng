using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Contracts;

namespace Knm.Enterprise.Domain.Claims;

public class MeasurementRecord : AuditableEntity
{
    public string MeasurementNumber { get; set; } = string.Empty; // e.g. "MEAS-2026-0001"
    
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public Guid? ClaimId { get; set; }
    public ContractClaim? Claim { get; set; }

    public DateTime MeasurementDate { get; set; } = DateTime.UtcNow;
    public string Location { get; set; } = string.Empty;
    public string Engineer { get; set; } = string.Empty;
    public string Status { get; set; } = "DRAFT"; // DRAFT, APPROVED, REJECTED
    public string? Notes { get; set; }

    public ICollection<MeasurementItem> Items { get; set; } = new List<MeasurementItem>();
}

public class MeasurementItem : AuditableEntity
{
    public Guid MeasurementRecordId { get; set; }
    public MeasurementRecord MeasurementRecord { get; set; } = null!;

    public Guid ContractItemId { get; set; }
    public ContractItem ContractItem { get; set; } = null!;

    public string Description { get; set; } = string.Empty;
    public decimal MeasuredQuantity { get; set; } = 0;
    public string Unit { get; set; } = "م2";
    public DateTime MeasurementDate { get; set; } = DateTime.UtcNow;
    public string? Reference { get; set; }
    public string? EvidenceDocument { get; set; }
}
