using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Projects;

public enum DependencyType
{
    FinishToStart = 0,  // FS: Activity/Project B cannot start until A finishes
    StartToStart = 1,   // SS: Activity/Project B cannot start until A starts
    FinishToFinish = 2, // FF: Activity/Project B cannot finish until A finishes
    StartToFinish = 3   // SF: Activity/Project B cannot finish until A starts
}

public class ProjectDependency : AuditableEntity
{
    public Guid PredecessorProjectId { get; set; }
    public Project PredecessorProject { get; set; } = null!;

    public Guid SuccessorProjectId { get; set; }
    public Project SuccessorProject { get; set; } = null!;

    public DependencyType Type { get; set; } = DependencyType.FinishToStart;
    public int LagDays { get; set; } = 0;
    public string? Notes { get; set; }
}
