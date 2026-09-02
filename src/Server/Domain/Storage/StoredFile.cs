using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Storage;

public class StoredFile : AuditableEntity
{
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public string Sha256Hash { get; set; } = string.Empty;
    public string? ModuleReference { get; set; }
    public string? EntityReferenceId { get; set; }
}
