using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Projects;

public class ProjectSchedule : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public string ScheduleName { get; set; } = "الجدول الزمني الرئيسي";
    public bool IsBaseline { get; set; } = true;
    public DateTime? BaselineDate { get; set; }

    public int TotalDurationDays { get; set; } = 0;
    public DateTime? CalculatedStartDate { get; set; }
    public DateTime? CalculatedEndDate { get; set; }

    public ICollection<ScheduleActivity> Activities { get; set; } = new List<ScheduleActivity>();
    public ICollection<ActivityDependency> Dependencies { get; set; } = new List<ActivityDependency>();
}

public class ScheduleActivity : AuditableEntity
{
    public Guid ProjectScheduleId { get; set; }
    public ProjectSchedule ProjectSchedule { get; set; } = null!;

    public string ActivityCode { get; set; } = string.Empty; // e.g. "ACT-01"
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationDays { get; set; } = 1;
    public decimal ProgressPercent { get; set; } = 0;

    // CPM Calculated Fields
    public int EarlyStartDay { get; set; } = 0;
    public int EarlyFinishDay { get; set; } = 0;
    public int LateStartDay { get; set; } = 0;
    public int LateFinishDay { get; set; } = 0;
    public int TotalFloat { get; set; } = 0;
    public int FreeFloat { get; set; } = 0;
    public bool IsCritical { get; set; } = false;

    // Concrete Calendar Dates (derived from Project.StartDate + Days)
    public DateTime? EarlyStartDate { get; set; }
    public DateTime? EarlyFinishDate { get; set; }
    public DateTime? LateStartDate { get; set; }
    public DateTime? LateFinishDate { get; set; }

    public int DisplayOrder { get; set; }
    public bool IsMilestone { get; set; } = false;

    public ICollection<ActivityDependency> Predecessors { get; set; } = new List<ActivityDependency>();
    public ICollection<ActivityDependency> Successors { get; set; } = new List<ActivityDependency>();
}

public class ActivityDependency : AuditableEntity
{
    public Guid ProjectScheduleId { get; set; }
    public ProjectSchedule ProjectSchedule { get; set; } = null!;

    public Guid PredecessorActivityId { get; set; }
    public ScheduleActivity PredecessorActivity { get; set; } = null!;

    public Guid SuccessorActivityId { get; set; }
    public ScheduleActivity SuccessorActivity { get; set; } = null!;

    public DependencyType Type { get; set; } = DependencyType.FinishToStart;
    public int LagDays { get; set; } = 0;
}

public class ProjectMilestone : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public DateTime TargetDate { get; set; }
    public DateTime? ActualDate { get; set; }
    public bool IsCompleted { get; set; } = false;
    public string? Notes { get; set; }
}
