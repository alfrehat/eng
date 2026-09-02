using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Storage;

namespace Knm.Enterprise.Domain.Tenders;

public class TenderDocument : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public Guid? StoredFileId { get; set; }
    public StoredFile? StoredFile { get; set; }

    public string DocumentTypeCode { get; set; } = "SPECS"; // SPECS, DRAWINGS, BOQ, CONDITIONS, GUARANTEE
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string DocumentVersion { get; set; } = "1.0";
    public bool IsMandatory { get; set; } = true;
}

public class TenderDocumentRequirement : AuditableEntity
{
    public string TenderTypeCode { get; set; } = "WORKS"; // WORKS, SUPPLIES, SERVICES
    public string DocumentTypeCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsMandatory { get; set; } = true;
    public int DisplayOrder { get; set; }
}
