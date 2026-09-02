using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Knm.Enterprise.Application.Projects;

public interface ICpmCalculationService
{
    Task<Result<ProjectSchedule>> CalculateScheduleCpmAsync(Guid scheduleId, CancellationToken cancellationToken = default);
}

public class CpmCalculationService : ICpmCalculationService
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<CpmCalculationService> _logger;

    public CpmCalculationService(IApplicationDbContext context, ILogger<CpmCalculationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Result<ProjectSchedule>> CalculateScheduleCpmAsync(Guid scheduleId, CancellationToken cancellationToken = default)
    {
        var schedule = await _context.ProjectSchedules
            .Include(s => s.Project)
            .Include(s => s.Activities)
            .Include(s => s.Dependencies)
            .FirstOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);

        if (schedule == null)
            return Result<ProjectSchedule>.Failure(new Error("NOT_FOUND", "الجدول الزمني المطلوب غير موجود"));

        if (!schedule.Activities.Any())
            return Result<ProjectSchedule>.Failure(new Error("EMPTY_SCHEDULE", "الجدول الزمني لا يحتوي على أي أنشطة للحساب"));

        var activities = schedule.Activities.ToList();
        var dependencies = schedule.Dependencies.ToList();

        var actDict = activities.ToDictionary(a => a.Id);

        // 1. Validate Cycle Detection (Topological Sort / DFS)
        if (HasCycle(activities, dependencies))
        {
            return Result<ProjectSchedule>.Failure(new Error("CYCLE_DETECTED", "تم اكتشاف علاقة دائرية (Circular Dependency) غير مسموحة بين الأنشطة"));
        }

        // Build adjacency lists
        var predMap = new Dictionary<Guid, List<ActivityDependency>>();
        var succMap = new Dictionary<Guid, List<ActivityDependency>>();

        foreach (var act in activities)
        {
            predMap[act.Id] = new List<ActivityDependency>();
            succMap[act.Id] = new List<ActivityDependency>();
        }

        foreach (var dep in dependencies)
        {
            if (succMap.ContainsKey(dep.PredecessorActivityId))
                succMap[dep.PredecessorActivityId].Add(dep);
            if (predMap.ContainsKey(dep.SuccessorActivityId))
                predMap[dep.SuccessorActivityId].Add(dep);
        }

        // 2. FORWARD PASS: Calculate Early Start (ES) & Early Finish (EF)
        var visited = new HashSet<Guid>();
        void ComputeForward(Guid actId)
        {
            if (visited.Contains(actId)) return;
            var act = actDict[actId];

            int maxEs = 0;
            foreach (var predDep in predMap[actId])
            {
                ComputeForward(predDep.PredecessorActivityId);
                var predAct = actDict[predDep.PredecessorActivityId];
                int earlyStartFromPred = predDep.Type switch
                {
                    DependencyType.StartToStart => predAct.EarlyStartDay + predDep.LagDays,
                    DependencyType.FinishToFinish => (predAct.EarlyFinishDay + predDep.LagDays) - act.DurationDays,
                    _ => predAct.EarlyFinishDay + predDep.LagDays // FinishToStart default
                };
                if (earlyStartFromPred > maxEs) maxEs = earlyStartFromPred;
            }

            act.EarlyStartDay = Math.Max(0, maxEs);
            act.EarlyFinishDay = act.EarlyStartDay + act.DurationDays;
            visited.Add(actId);
        }

        foreach (var act in activities)
        {
            ComputeForward(act.Id);
        }

        int projectDuration = activities.Max(a => a.EarlyFinishDay);
        schedule.TotalDurationDays = projectDuration;

        // 3. BACKWARD PASS: Calculate Late Finish (LF) & Late Start (LS)
        var visitedBack = new HashSet<Guid>();
        void ComputeBackward(Guid actId)
        {
            if (visitedBack.Contains(actId)) return;
            var act = actDict[actId];

            int minLf = projectDuration;
            if (succMap[actId].Any())
            {
                minLf = int.MaxValue;
                foreach (var succDep in succMap[actId])
                {
                    ComputeBackward(succDep.SuccessorActivityId);
                    var succAct = actDict[succDep.SuccessorActivityId];
                    int lateFinishFromSucc = succDep.Type switch
                    {
                        DependencyType.StartToStart => succAct.LateStartDay - succDep.LagDays + act.DurationDays,
                        DependencyType.FinishToFinish => succAct.LateFinishDay - succDep.LagDays,
                        _ => succAct.LateStartDay - succDep.LagDays // FinishToStart
                    };
                    if (lateFinishFromSucc < minLf) minLf = lateFinishFromSucc;
                }
            }

            act.LateFinishDay = minLf;
            act.LateStartDay = act.LateFinishDay - act.DurationDays;
            visitedBack.Add(actId);
        }

        foreach (var act in activities)
        {
            ComputeBackward(act.Id);
        }

        // 4. Calculate Float and Flag Critical Path
        var projectStartDate = schedule.Project.StartDate ?? DateTime.UtcNow.Date;
        schedule.CalculatedStartDate = projectStartDate;
        schedule.CalculatedEndDate = projectStartDate.AddDays(projectDuration);

        foreach (var act in activities)
        {
            act.TotalFloat = act.LateStartDay - act.EarlyStartDay;
            act.IsCritical = act.TotalFloat <= 0;

            // Map day offsets to real dates
            act.EarlyStartDate = projectStartDate.AddDays(act.EarlyStartDay);
            act.EarlyFinishDate = projectStartDate.AddDays(act.EarlyFinishDay);
            act.LateStartDate = projectStartDate.AddDays(act.LateStartDay);
            act.LateFinishDate = projectStartDate.AddDays(act.LateFinishDay);
        }

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("CPM Calculation finished for Schedule {ScheduleId}. Duration: {Days} days, Critical Activities: {Count}",
            scheduleId, projectDuration, activities.Count(a => a.IsCritical));

        return Result<ProjectSchedule>.Success(schedule);
    }

    private static bool HasCycle(List<ScheduleActivity> activities, List<ActivityDependency> dependencies)
    {
        var adj = new Dictionary<Guid, List<Guid>>();
        foreach (var a in activities) adj[a.Id] = new List<Guid>();
        foreach (var d in dependencies)
        {
            if (adj.ContainsKey(d.PredecessorActivityId))
                adj[d.PredecessorActivityId].Add(d.SuccessorActivityId);
        }

        var visited = new HashSet<Guid>();
        var recStack = new HashSet<Guid>();

        bool Dfs(Guid u)
        {
            visited.Add(u);
            recStack.Add(u);

            foreach (var v in adj[u])
            {
                if (!visited.Contains(v) && Dfs(v)) return true;
                if (recStack.Contains(v)) return true;
            }

            recStack.Remove(u);
            return false;
        }

        foreach (var a in activities)
        {
            if (!visited.Contains(a.Id))
            {
                if (Dfs(a.Id)) return true;
            }
        }

        return false;
    }
}
