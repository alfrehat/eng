namespace Knm.Enterprise.Domain.Common;

public abstract class BaseEntity<TId>
{
    public TId Id { get; protected set; } = default!;
    public bool IsActive { get; set; } = true;
    public uint Version { get; set; } = 1; // Concurrency token / OCC
}

public abstract class BaseEntity : BaseEntity<Guid>
{
    protected BaseEntity()
    {
        Id = Guid.NewGuid();
    }
}
