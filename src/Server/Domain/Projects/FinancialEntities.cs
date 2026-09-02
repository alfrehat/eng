using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Projects;

public class FinancialProgram : AuditableEntity
{
    public string Code { get; set; } = string.Empty; // e.g. "PRG_CAPITAL_2026"
    public string Name { get; set; } = string.Empty;
    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    public decimal TotalBudget { get; set; } = 0;

    public ICollection<BudgetChapter> Chapters { get; set; } = new List<BudgetChapter>();
}

public class BudgetChapter : AuditableEntity
{
    public Guid FinancialProgramId { get; set; }
    public FinancialProgram FinancialProgram { get; set; } = null!;

    public string Code { get; set; } = string.Empty; // e.g. "CH_02"
    public string Name { get; set; } = string.Empty; // e.g. "الأشغال الهندسية والمشاريع"
    public ICollection<BudgetItem> Items { get; set; } = new List<BudgetItem>();
}

public class BudgetItem : AuditableEntity
{
    public Guid BudgetChapterId { get; set; }
    public BudgetChapter BudgetChapter { get; set; } = null!;

    public string Code { get; set; } = string.Empty; // e.g. "ITEM_21"
    public string Name { get; set; } = string.Empty; // e.g. "تعبيد وخلطات إسفلتية"
    public decimal AllocatedAmount { get; set; } = 0;
}

public class FundingSource : AuditableEntity
{
    public string Code { get; set; } = string.Empty; // e.g. "MUNICIPAL_BUDGET", "MINISTRY_GRANT", "FOREIGN_AID"
    public string Name { get; set; } = string.Empty;
    public string? OrganizationName { get; set; }
}

public class ProjectAllocation : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid? BudgetItemId { get; set; }
    public BudgetItem? BudgetItem { get; set; }

    public Guid? FundingSourceId { get; set; }
    public FundingSource? FundingSource { get; set; }

    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    public decimal AllocatedAmount { get; set; } = 0;
    public decimal CommittedAmount { get; set; } = 0;
    public string? Notes { get; set; }
}

public class ProjectExpenditure : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid? ProjectAllocationId { get; set; }
    public ProjectAllocation? ProjectAllocation { get; set; }

    public DateTime DisbursementDate { get; set; } = DateTime.UtcNow;
    public decimal Amount { get; set; } = 0;
    public string VoucherNumber { get; set; } = string.Empty;
    public string? Payee { get; set; }
    public string? Description { get; set; }
}
