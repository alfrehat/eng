using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractBoq : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string Title { get; set; } = "جدول كميات العقد الأساسي (لقطة معتمدة)";
    public decimal OriginalSubTotal { get; set; } = 0;
    public decimal CurrentSubTotal { get; set; } = 0;
    public decimal TaxRatePercent { get; set; } = 16;
    public decimal TaxAmount { get; set; } = 0;
    public decimal GrandTotal { get; set; } = 0;

    public ICollection<ContractItem> Items { get; set; } = new List<ContractItem>();

    public void RecalculateTotals()
    {
        OriginalSubTotal = Items.Sum(i => i.OriginalAmount);
        CurrentSubTotal = Items.Sum(i => i.CurrentAmount);
        TaxAmount = Math.Round(CurrentSubTotal * (TaxRatePercent / 100m), 3);
        GrandTotal = CurrentSubTotal + TaxAmount;
    }
}

public class ContractItem : AuditableEntity
{
    public Guid ContractBoqId { get; set; }
    public ContractBoq ContractBoq { get; set; } = null!;

    public string ItemCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Unit { get; set; } = "م2";

    public decimal OriginalQuantity { get; set; } = 0;
    public decimal OriginalUnitPrice { get; set; } = 0;
    public decimal OriginalAmount { get; set; } = 0;

    public decimal CurrentQuantity { get; set; } = 0;
    public decimal CurrentUnitPrice { get; set; } = 0;
    public decimal CurrentAmount { get; set; } = 0;

    public int DisplayOrder { get; set; }

    public void ComputeAmounts()
    {
        OriginalAmount = Math.Round(OriginalQuantity * OriginalUnitPrice, 3);
        CurrentAmount = Math.Round(CurrentQuantity * CurrentUnitPrice, 3);
    }
}
