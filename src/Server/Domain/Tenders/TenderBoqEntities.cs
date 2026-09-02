using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Tenders;

public class TenderBoq : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public string Title { get; set; } = "جدول الكميات والمواصفات الأساسي";
    public decimal SubTotal { get; set; } = 0;
    public decimal TaxRatePercent { get; set; } = 16; // Managed, default 16% in Jordan
    public decimal TaxAmount { get; set; } = 0;
    public decimal GrandTotal { get; set; } = 0;

    public ICollection<TenderBoqItem> Items { get; set; } = new List<TenderBoqItem>();

    public void RecalculateTotals()
    {
        SubTotal = Items.Sum(i => i.EstimatedTotal);
        TaxAmount = Math.Round(SubTotal * (TaxRatePercent / 100m), 3);
        GrandTotal = SubTotal + TaxAmount;
    }
}

public class TenderBoqItem : AuditableEntity
{
    public Guid TenderBoqId { get; set; }
    public TenderBoq TenderBoq { get; set; } = null!;

    public int ItemNumber { get; set; } = 1;
    public string Description { get; set; } = string.Empty;
    public string Unit { get; set; } = "م2"; // م2, م3, م.ط, عدد, طن, مقطوع
    public decimal Quantity { get; set; } = 1;
    public decimal EstimatedUnitPrice { get; set; } = 0;
    public decimal EstimatedTotal { get; set; } = 0;
    public string? Notes { get; set; }

    public void ComputeTotal()
    {
        EstimatedTotal = Math.Round(Quantity * EstimatedUnitPrice, 3);
    }
}
