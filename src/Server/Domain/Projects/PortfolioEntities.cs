using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Projects;

public class Portfolio : AuditableEntity
{
    public string Code { get; set; } = string.Empty; // e.g. "PORT_2026_ROADS"
    public string Name { get; set; } = string.Empty;
    public int TargetYear { get; set; } = DateTime.UtcNow.Year;
    public string? Description { get; set; }
    public decimal TotalBudget { get; set; } = 0;
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, ARCHIVED, PLANNED

    public ICollection<PortfolioItem> Items { get; set; } = new List<PortfolioItem>();
}

public class PortfolioItem : AuditableEntity
{
    public Guid PortfolioId { get; set; }
    public Portfolio Portfolio { get; set; } = null!;

    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public decimal AllocatedAmount { get; set; } = 0;
    public string? Notes { get; set; }
}
