using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Projects;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/project-schedules")]
public class ProjectSchedulesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICpmCalculationService _cpmService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ProjectSchedulesController> _logger;

    public ProjectSchedulesController(
        IApplicationDbContext context,
        ICpmCalculationService cpmService,
        CorrelationContext correlationContext,
        ILogger<ProjectSchedulesController> logger)
    {
        _context = context;
        _cpmService = cpmService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet("project/{projectId}")]
    public async Task<IActionResult> GetScheduleByProjectId(Guid projectId)
    {
        var schedule = await _context.ProjectSchedules
            .Include(s => s.Activities.OrderBy(a => a.EarlyStartDay))
                .ThenInclude(a => a.Predecessors)
            .Include(s => s.Dependencies)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProjectId == projectId);

        if (schedule == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "لا يوجد جدول زمني لهذا المشروع بعد", _correlationContext.CorrelationId));

        return Ok(ApiResponse<ProjectSchedule>.Ok(schedule, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleDto dto)
    {
        var project = await _context.Projects.FindAsync(dto.ProjectId);
        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المحدد غير موجود", _correlationContext.CorrelationId));

        var schedule = new ProjectSchedule
        {
            ProjectId = dto.ProjectId,
            ScheduleName = dto.ScheduleName ?? $"الجدول الزمني لمشروع: {project.Name}",
            CalculatedStartDate = project.StartDate ?? DateTime.UtcNow.Date
        };

        _context.ProjectSchedules.Add(schedule);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            schedule.Id,
            schedule.ProjectId,
            schedule.ScheduleName,
            schedule.CalculatedStartDate
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{scheduleId}/activities")]
    public async Task<IActionResult> AddActivity(Guid scheduleId, [FromBody] CreateActivityDto dto)
    {
        var schedule = await _context.ProjectSchedules.FindAsync(scheduleId);
        if (schedule == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الجدول الزمني المحدد غير موجود", _correlationContext.CorrelationId));

        var activity = new ScheduleActivity
        {
            ProjectScheduleId = scheduleId,
            ActivityCode = dto.ActivityCode.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Description = dto.Description,
            DurationDays = dto.DurationDays > 0 ? dto.DurationDays : 1,
            ProgressPercent = dto.ProgressPercent,
            IsMilestone = dto.IsMilestone
        };

        _context.ScheduleActivities.Add(activity);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            activity.Id,
            activity.ProjectScheduleId,
            activity.ActivityCode,
            activity.Name,
            activity.DurationDays,
            activity.ProgressPercent,
            activity.IsMilestone
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{scheduleId}/dependencies")]
    public async Task<IActionResult> AddDependency(Guid scheduleId, [FromBody] CreateActivityDependencyDto dto)
    {
        if (dto.PredecessorActivityId == dto.SuccessorActivityId)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "لا يمكن ربط النشاط بنفسه كاعتمادية", _correlationContext.CorrelationId));

        var dep = new ActivityDependency
        {
            ProjectScheduleId = scheduleId,
            PredecessorActivityId = dto.PredecessorActivityId,
            SuccessorActivityId = dto.SuccessorActivityId,
            Type = dto.Type,
            LagDays = dto.LagDays
        };

        _context.ActivityDependencies.Add(dep);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            dep.Id,
            dep.ProjectScheduleId,
            dep.PredecessorActivityId,
            dep.SuccessorActivityId,
            dep.Type,
            dep.LagDays
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{scheduleId}/calculate-cpm")]
    public async Task<IActionResult> CalculateCpm(Guid scheduleId)
    {
        var result = await _cpmService.CalculateScheduleCpmAsync(scheduleId);
        if (!result.IsSuccess)
        {
            return BadRequest(ApiResponse<object>.Fail(result.Error.Code, result.Error.Message, _correlationContext.CorrelationId));
        }

        var schedule = result.Value;
        return Ok(ApiResponse<object>.Ok(new
        {
            schedule.Id,
            schedule.ScheduleName,
            schedule.TotalDurationDays,
            schedule.CalculatedStartDate,
            schedule.CalculatedEndDate,
            criticalPathActivities = schedule.Activities.Where(a => a.IsCritical).Select(a => new { a.Id, a.ActivityCode, a.Name, a.DurationDays, a.EarlyStartDay, a.EarlyFinishDay }),
            activities = schedule.Activities.OrderBy(a => a.EarlyStartDay).Select(a => new
            {
                a.Id,
                a.ActivityCode,
                a.Name,
                a.DurationDays,
                a.EarlyStartDay,
                a.EarlyFinishDay,
                a.LateStartDay,
                a.LateFinishDay,
                a.TotalFloat,
                a.FreeFloat,
                a.IsCritical,
                a.EarlyStartDate,
                a.EarlyFinishDate
            })
        }, _correlationContext.CorrelationId));
    }

    [HttpGet("{scheduleId}/gantt")]
    public async Task<IActionResult> GetGanttData(Guid scheduleId)
    {
        var schedule = await _context.ProjectSchedules
            .Include(s => s.Project)
            .Include(s => s.Activities.OrderBy(a => a.EarlyStartDay))
            .Include(s => s.Dependencies)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == scheduleId);

        if (schedule == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الجدول الزمني غير موجود", _correlationContext.CorrelationId));

        var ganttTasks = schedule.Activities.Select(a => new
        {
            id = a.Id,
            code = a.ActivityCode,
            name = a.Name,
            start = a.EarlyStartDate ?? schedule.Project.StartDate ?? DateTime.UtcNow.Date,
            end = a.EarlyFinishDate ?? (schedule.Project.StartDate ?? DateTime.UtcNow.Date).AddDays(a.DurationDays),
            duration = a.DurationDays,
            progress = a.ProgressPercent,
            isCritical = a.IsCritical,
            isMilestone = a.IsMilestone,
            totalFloat = a.TotalFloat,
            dependencies = schedule.Dependencies
                .Where(d => d.SuccessorActivityId == a.Id)
                .Select(d => new { d.PredecessorActivityId, type = d.Type.ToString(), d.LagDays })
        });

        return Ok(ApiResponse<object>.Ok(new
        {
            scheduleId = schedule.Id,
            scheduleName = schedule.ScheduleName,
            totalDurationDays = schedule.TotalDurationDays,
            tasks = ganttTasks
        }, _correlationContext.CorrelationId));
    }
}

public class CreateScheduleDto
{
    public Guid ProjectId { get; set; }
    public string? ScheduleName { get; set; }
}

public class CreateActivityDto
{
    public string ActivityCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationDays { get; set; } = 1;
    public decimal ProgressPercent { get; set; } = 0;
    public bool IsMilestone { get; set; } = false;
}

public class CreateActivityDependencyDto
{
    public Guid PredecessorActivityId { get; set; }
    public Guid SuccessorActivityId { get; set; }
    public DependencyType Type { get; set; } = DependencyType.FinishToStart;
    public int LagDays { get; set; } = 0;
}
