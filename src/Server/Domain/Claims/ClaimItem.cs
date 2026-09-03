using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Contracts;

namespace Knm.Enterprise.Domain.Claims;

public class ClaimItem : AuditableEntity
{
    public Guid ClaimId { get; set; }
    public ContractClaim Claim { get; set; } = null!;

    public Guid ContractItemId { get; set; }
    public ContractItem ContractItem { get; set; } = null!;

    public decimal PreviousQuantity { get; set; } = 0;
    public decimal CurrentQuantity { get; set; } = 0;
    public decimal CumulativeQuantity { get; set; } = 0;

    public string Unit { get; set; } = "م2";
    public decimal UnitPrice { get; set; } = 0;

    public decimal CurrentAmount { get; set; } = 0;
    public decimal CumulativeAmount { get; set; } = 0;

    public Guid? MeasurementRecordId { get; set; }
    public MeasurementRecord? MeasurementRecord { get; set; }

    public int DisplayOrder { get; set; } = 1;

    public void ComputeAmounts()
    {
        CumulativeQuantity = PreviousQuantity + CurrentQuantity;
        CurrentAmount = Math.Round(CurrentQuantity * UnitPrice, 3);
        CumulativeAmount = Math.Round(CumulativeQuantity * UnitPrice, 3);
    }
}
