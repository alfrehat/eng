using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Metadata;

namespace Knm.Enterprise.Domain.DynamicData;

public class DynamicRecord : AuditableEntity
{
    public Guid ScreenId { get; set; }
    public SystemScreen Screen { get; set; } = null!;

    public string? ReferenceNumber { get; set; } // Sequence number from Numbering Engine (e.g. TEN-2026-001)
    public string DataJson { get; set; } = "{}"; // JSONB column storing dynamic fields values
    public string Status { get; set; } = "DRAFT"; // DRAFT, SUBMITTED, APPROVED, COMPLETED
}
