using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.ReferenceData;

public class ReferenceList : AuditableEntity
{
    public string Code { get; set; } = string.Empty; // e.g. "TENDER_TYPES", "VEHICLE_STATUS"
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystem { get; set; } = false;

    public ICollection<ReferenceItem> Items { get; set; } = new List<ReferenceItem>();
}

public class ReferenceItem : AuditableEntity
{
    public Guid ReferenceListId { get; set; }
    public ReferenceList ReferenceList { get; set; } = null!;

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? ColorCode { get; set; }
    public int DisplayOrder { get; set; }
}
