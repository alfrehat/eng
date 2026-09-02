using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Tenders;

public class Bidder : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string CommercialRegisterNumber { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string ClassificationGrade { get; set; } = "FIRST"; // FIRST, SECOND, THIRD, FOURTH, UNCLASSIFIED

    public ICollection<Bid> Bids { get; set; } = new List<Bid>();
}

public class Bid : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public Guid BidderId { get; set; }
    public Bidder Bidder { get; set; } = null!;

    public DateTime SubmissionDate { get; set; } = DateTime.UtcNow;
    public decimal OfferedAmount { get; set; } = 0;
    public string Status { get; set; } = "SUBMITTED"; // SUBMITTED, ACCEPTED, REJECTED, DISQUALIFIED
    public string? Notes { get; set; }

    public ICollection<BidItem> Items { get; set; } = new List<BidItem>();
    public ICollection<BidGuarantee> Guarantees { get; set; } = new List<BidGuarantee>();
}

public class BidItem : AuditableEntity
{
    public Guid BidId { get; set; }
    public Bid Bid { get; set; } = null!;

    public Guid TenderBoqItemId { get; set; }
    public TenderBoqItem TenderBoqItem { get; set; } = null!;

    public decimal OfferedUnitPrice { get; set; } = 0;
    public decimal OfferedTotal { get; set; } = 0;
}

public class BidGuarantee : AuditableEntity
{
    public Guid BidId { get; set; }
    public Bid Bid { get; set; } = null!;

    public string GuaranteeTypeCode { get; set; } = "BANK_GUARANTEE"; // BANK_GUARANTEE, CERTIFIED_CHEQUE
    public string GuaranteeNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0;
    public string Currency { get; set; } = "JOD";
    public DateTime IssueDate { get; set; } = DateTime.UtcNow;
    public DateTime ExpiryDate { get; set; } = DateTime.UtcNow.AddDays(90);
    public string Status { get; set; } = "VALID"; // VALID, EXPIRED, RETURNED, CONFISCATED
}
