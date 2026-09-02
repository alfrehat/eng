using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<ProjectsController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetProjects(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null,
        [FromQuery] ProjectLifecycleStatus? status = null,
        [FromQuery] string? projectType = null)
    {
        var query = _context.Projects
            .Include(p => p.OrganizationUnit)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{search}%") || 
                                     EF.Functions.ILike(p.ProjectNumber, $"%{search}%"));
        }

        if (status.HasValue)
        {
            query = query.Where(p => p.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(projectType))
        {
            query = query.Where(p => p.ProjectTypeCode == projectType.ToUpperInvariant());
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.ProjectNumber,
                p.Name,
                p.ProjectTypeCode,
                p.CategoryCode,
                p.Status,
                StatusName = p.Status.ToString(),
                p.PriorityLevel,
                OrganizationName = p.OrganizationUnit != null ? p.OrganizationUnit.Name : null,
                p.ResponsibleEngineer,
                p.StartDate,
                p.PlannedEndDate,
                p.EstimatedCost,
                p.ContractValue,
                p.ActualExpenditure,
                p.ProgressPercentage,
                p.PrimaryFundingSource,
                Latitude = p.LocationGeometry != null ? (double?)p.LocationGeometry.Coordinate.Y : null,
                Longitude = p.LocationGeometry != null ? (double?)p.LocationGeometry.Coordinate.X : null,
                p.LocationDescription
            })
            .ToListAsync();

        var pagedResult = new PagedResult<object>(items, totalCount, page, pageSize);
        return Ok(ApiResponse<PagedResult<object>>.Ok(pagedResult, _correlationContext.CorrelationId));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProjectById(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.OrganizationUnit)
            .Include(p => p.Milestones.OrderBy(m => m.TargetDate))
            .Include(p => p.Allocations)
                .ThenInclude(a => a.FundingSource)
            .Include(p => p.Allocations)
                .ThenInclude(a => a.BudgetItem)
            .Include(p => p.Expenditures.OrderByDescending(e => e.DisbursementDate))
            .Include(p => p.Schedules)
                .ThenInclude(s => s.Activities.OrderBy(a => a.EarlyStartDay))
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المطلوب غير موجود", _correlationContext.CorrelationId));

        var result = new
        {
            project.Id,
            project.ProjectNumber,
            project.Name,
            project.Description,
            project.ProjectTypeCode,
            project.CategoryCode,
            project.Status,
            StatusName = project.Status.ToString(),
            project.PriorityLevel,
            project.OrganizationUnitId,
            OrganizationName = project.OrganizationUnit?.Name,
            project.ResponsibleEngineer,
            project.ExecutingAgency,
            project.OwnerAgency,
            project.StartDate,
            project.PlannedEndDate,
            project.ActualEndDate,
            project.EstimatedCost,
            project.ContractValue,
            project.ActualExpenditure,
            project.ProgressPercentage,
            project.PrimaryFundingSource,
            project.ProgramName,
            project.PlanName,
            project.Notes,
            Latitude = project.LocationGeometry != null ? (double?)project.LocationGeometry.Coordinate.Y : null,
            Longitude = project.LocationGeometry != null ? (double?)project.LocationGeometry.Coordinate.X : null,
            project.LocationDescription,
            project.Address,
            Milestones = project.Milestones.Select(m => new { m.Id, m.Name, m.TargetDate, m.ActualDate, m.IsCompleted }),
            Allocations = project.Allocations.Select(a => new { a.Id, a.FiscalYear, a.AllocatedAmount, a.CommittedAmount, FundingSource = a.FundingSource?.Name, BudgetItem = a.BudgetItem?.Name }),
            Expenditures = project.Expenditures.Select(e => new { e.Id, e.DisbursementDate, e.Amount, e.VoucherNumber, e.Payee, e.Description }),
            Schedules = project.Schedules.Select(s => new { s.Id, s.ScheduleName, s.TotalDurationDays, s.CalculatedStartDate, s.CalculatedEndDate, ActivitiesCount = s.Activities.Count, CriticalCount = s.Activities.Count(a => a.IsCritical) })
        };

        return Ok(ApiResponse<object>.Ok(result, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "اسم المشروع مطلوب", _correlationContext.CorrelationId));

        // 1. Generate Project Number using Numbering Engine if not provided
        string projectNumber = dto.ProjectNumber;
        if (string.IsNullOrWhiteSpace(projectNumber))
        {
            var numberingDef = await _context.NumberingDefinitions
                .FirstOrDefaultAsync(n => n.Code == "PROJECT_SEQ" || n.Code == "PRJ_SEQ");

            if (numberingDef != null)
            {
                projectNumber = numberingDef.GenerateNextFormatted();
            }
            else
            {
                // Fallback automated standard sequence
                var currentYear = DateTime.UtcNow.Year;
                var count = await _context.Projects.CountAsync();
                projectNumber = $"PRJ-{currentYear}-{(count + 1):D4}";
            }
        }

        // 2. Build PostGIS Geometry if Latitude & Longitude provided
        Geometry? locationGeom = null;
        if (dto.Latitude.HasValue && dto.Longitude.HasValue)
        {
            var geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
            locationGeom = geometryFactory.CreatePoint(new Coordinate(dto.Longitude.Value, dto.Latitude.Value));
        }

        var project = new Project
        {
            ProjectNumber = projectNumber,
            Name = dto.Name.Trim(),
            Description = dto.Description,
            ProjectTypeCode = dto.ProjectTypeCode?.ToUpperInvariant() ?? "ROADS",
            CategoryCode = dto.CategoryCode?.ToUpperInvariant() ?? "CAPITAL",
            Status = ProjectLifecycleStatus.Draft,
            PriorityLevel = dto.PriorityLevel ?? "MEDIUM",
            OrganizationUnitId = dto.OrganizationUnitId,
            ResponsibleEngineer = dto.ResponsibleEngineer,
            ExecutingAgency = dto.ExecutingAgency,
            OwnerAgency = dto.OwnerAgency ?? "بلدية كفرنجة الجديدة",
            StartDate = dto.StartDate ?? DateTime.UtcNow.Date,
            PlannedEndDate = dto.PlannedEndDate ?? DateTime.UtcNow.Date.AddDays(90),
            EstimatedCost = dto.EstimatedCost,
            ContractValue = dto.ContractValue,
            PrimaryFundingSource = dto.PrimaryFundingSource,
            ProgramName = dto.ProgramName,
            PlanName = dto.PlanName,
            Notes = dto.Notes,
            LocationGeometry = locationGeom,
            LocationDescription = dto.LocationDescription,
            Address = dto.Address
        };

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Project created successfully. Number: {ProjectNumber}, ID: {ProjectId}", project.ProjectNumber, project.Id);

        return Ok(ApiResponse<object>.Ok(new
        {
            project.Id,
            project.ProjectNumber,
            project.Name,
            project.Description,
            project.ProjectTypeCode,
            project.CategoryCode,
            project.Status,
            StatusName = project.Status.ToString(),
            project.PriorityLevel,
            project.ResponsibleEngineer,
            project.StartDate,
            project.PlannedEndDate,
            project.EstimatedCost,
            project.ContractValue,
            project.ActualExpenditure,
            project.ProgressPercentage,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            project.LocationDescription
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{id}/status")]
    public async Task<IActionResult> TransitionStatus(Guid id, [FromBody] UpdateProjectStatusDto dto)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المطلوب غير موجود", _correlationContext.CorrelationId));

        var oldStatus = project.Status;
        project.Status = dto.NewStatus;
        if (dto.NewStatus == ProjectLifecycleStatus.Completed && !project.ActualEndDate.HasValue)
        {
            project.ActualEndDate = DateTime.UtcNow;
            project.ProgressPercentage = 100;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Project {ProjectNumber} status changed from {Old} to {New}", project.ProjectNumber, oldStatus, dto.NewStatus);

        return Ok(ApiResponse<string>.Ok($"تم تغيير حالة المشروع إلى {dto.NewStatus}", _correlationContext.CorrelationId));
    }

    [HttpGet("{id}/dashboard")]
    public async Task<IActionResult> GetProjectDashboard(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.Allocations)
            .Include(p => p.Expenditures)
            .Include(p => p.Milestones)
            .Include(p => p.Schedules)
                .ThenInclude(s => s.Activities)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المطلوب غير موجود", _correlationContext.CorrelationId));

        var totalAllocated = project.Allocations.Sum(a => a.AllocatedAmount);
        var totalCommitted = project.Allocations.Sum(a => a.CommittedAmount);
        var totalExpended = project.Expenditures.Sum(e => e.Amount);
        var remainingBudget = totalAllocated - totalExpended;

        var activeSchedule = project.Schedules.FirstOrDefault();
        var criticalActivitiesCount = activeSchedule?.Activities.Count(a => a.IsCritical) ?? 0;
        var totalActivitiesCount = activeSchedule?.Activities.Count ?? 0;

        var dashboard = new
        {
            projectId = project.Id,
            projectNumber = project.ProjectNumber,
            projectName = project.Name,
            status = project.Status.ToString(),
            progressPercentage = project.ProgressPercentage,
            estimatedCost = project.EstimatedCost,
            contractValue = project.ContractValue,
            financials = new
            {
                totalAllocated,
                totalCommitted,
                totalExpended,
                remainingBudget,
                spendingRate = totalAllocated > 0 ? Math.Round((totalExpended / totalAllocated) * 100, 1) : 0
            },
            schedule = new
            {
                durationDays = activeSchedule?.TotalDurationDays ?? 0,
                calculatedStartDate = activeSchedule?.CalculatedStartDate ?? project.StartDate,
                calculatedEndDate = activeSchedule?.CalculatedEndDate ?? project.PlannedEndDate,
                criticalActivitiesCount,
                totalActivitiesCount
            },
            milestones = project.Milestones.Select(m => new
            {
                m.Id,
                m.Name,
                m.TargetDate,
                m.ActualDate,
                m.IsCompleted
            })
        };

        return Ok(ApiResponse<object>.Ok(dashboard, _correlationContext.CorrelationId));
    }
}

public class CreateProjectDto
{
    public string ProjectNumber { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ProjectTypeCode { get; set; }
    public string? CategoryCode { get; set; }
    public string? PriorityLevel { get; set; }
    public Guid? OrganizationUnitId { get; set; }
    public string? ResponsibleEngineer { get; set; }
    public string? ExecutingAgency { get; set; }
    public string? OwnerAgency { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? PlannedEndDate { get; set; }
    public decimal EstimatedCost { get; set; } = 0;
    public decimal ContractValue { get; set; } = 0;
    public string? PrimaryFundingSource { get; set; }
    public string? ProgramName { get; set; }
    public string? PlanName { get; set; }
    public string? Notes { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? LocationDescription { get; set; }
    public string? Address { get; set; }
}

public class UpdateProjectStatusDto
{
    public ProjectLifecycleStatus NewStatus { get; set; }
}
