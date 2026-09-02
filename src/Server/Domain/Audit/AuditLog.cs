using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Audit;

public class AuditLog : BaseEntity
{
    public string? UserId { get; set; }
    public string? Username { get; set; }
    public string Action { get; set; } = string.Empty; // CREATE, UPDATE, DELETE, LOGIN, EXPORT
    public string EntityName { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? CorrelationId { get; set; }
    public string? BeforeStateJson { get; set; }
    public string? AfterStateJson { get; set; }
    public string ResultStatus { get; set; } = "SUCCESS"; // SUCCESS, FAILED
}
