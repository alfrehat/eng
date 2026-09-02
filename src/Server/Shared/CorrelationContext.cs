namespace Knm.Enterprise.Shared;

public class CorrelationContext
{
    public string CorrelationId { get; set; } = Guid.NewGuid().ToString("N");
}
