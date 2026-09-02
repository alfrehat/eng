using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Tenders;

public class TenderOpening : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public DateTime OpeningDate { get; set; } = DateTime.UtcNow;
    public string ConductedBy { get; set; } = "لجنة فتح المظاريف";
    public string? Notes { get; set; }
    public bool IsLocked { get; set; } = false;

    public ICollection<TenderOpeningEntry> Entries { get; set; } = new List<TenderOpeningEntry>();
}

public class TenderOpeningEntry : AuditableEntity
{
    public Guid TenderOpeningId { get; set; }
    public TenderOpening TenderOpening { get; set; } = null!;

    public Guid BidId { get; set; }
    public Bid Bid { get; set; } = null!;

    public decimal ReadOutAmount { get; set; } = 0;
    public bool GuaranteeReceived { get; set; } = true;
    public bool ChecklistPassed { get; set; } = true;
    public string? Remarks { get; set; }
}
