using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Configuration;

public class SystemSetting : AuditableEntity
{
    public string Category { get; set; } = string.Empty; // SYSTEM, ORGANIZATION, LOCALIZATION, NUMBERING, FILE, SECURITY
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string DataType { get; set; } = "STRING"; // STRING, NUMBER, BOOLEAN, JSON
    public bool IsEncrypted { get; set; } = false;
}
