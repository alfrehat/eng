using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Projects;

public class PriorityModel : AuditableEntity
{
    public string Code { get; set; } = string.Empty; // e.g. "MUNICIPAL_STD_2026"
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ICollection<PriorityCriterion> Criteria { get; set; } = new List<PriorityCriterion>();
}

public class PriorityCriterion : AuditableEntity
{
    public Guid PriorityModelId { get; set; }
    public PriorityModel PriorityModel { get; set; } = null!;

    public string Name { get; set; } = string.Empty; // e.g. "السلامة المرورية"
    public decimal WeightPercentage { get; set; } = 20; // e.g. 30 -> 30%
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
}

public class ProjectPriorityScore : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid PriorityCriterionId { get; set; }
    public PriorityCriterion PriorityCriterion { get; set; } = null!;

    public decimal RawScore { get; set; } = 0; // 0 to 10
    public decimal WeightedScore { get; set; } = 0; // RawScore * (Weight / 100)
    public string? Justification { get; set; }
}
