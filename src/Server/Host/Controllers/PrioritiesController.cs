using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Projects;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PrioritiesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IProjectPriorityService _priorityService;
    private readonly CorrelationContext _correlationContext;

    public PrioritiesController(
        IApplicationDbContext context,
        IProjectPriorityService priorityService,
        CorrelationContext correlationContext)
    {
        _context = context;
        _priorityService = priorityService;
        _correlationContext = correlationContext;
    }

    [HttpGet("models")]
    public async Task<IActionResult> GetModels()
    {
        var models = await _context.PriorityModels
            .Include(m => m.Criteria.OrderBy(c => c.DisplayOrder))
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<PriorityModel>>.Ok(models, _correlationContext.CorrelationId));
    }

    [HttpPost("models")]
    public async Task<IActionResult> CreateModel([FromBody] CreatePriorityModelDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز واسم نموذج الأولوية مطلوبان", _correlationContext.CorrelationId));

        var model = new PriorityModel
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Description = dto.Description
        };

        if (dto.Criteria != null)
        {
            int order = 1;
            foreach (var c in dto.Criteria)
            {
                model.Criteria.Add(new PriorityCriterion
                {
                    Name = c.Name,
                    WeightPercentage = c.WeightPercentage,
                    Description = c.Description,
                    DisplayOrder = order++
                });
            }
        }

        _context.PriorityModels.Add(model);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<PriorityModel>.Ok(model, _correlationContext.CorrelationId));
    }

    [HttpPost("projects/{projectId}/evaluate")]
    public async Task<IActionResult> EvaluateProject(Guid projectId, [FromBody] List<ProjectScoreInputDto> scores)
    {
        var project = await _context.Projects
            .Include(p => p.PriorityScores)
            .FirstOrDefaultAsync(p => p.Id == projectId);

        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المطلوب غير موجود", _correlationContext.CorrelationId));

        var criteriaIds = scores.Select(s => s.PriorityCriterionId).ToList();
        var criteria = await _context.PriorityCriteria
            .Where(c => criteriaIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id);

        decimal totalWeightedScore = 0;

        foreach (var s in scores)
        {
            if (!criteria.TryGetValue(s.PriorityCriterionId, out var criterion))
                continue;

            var weightFactor = criterion.WeightPercentage / 100m;
            var weighted = s.RawScore * weightFactor;
            totalWeightedScore += weighted;

            var existing = project.PriorityScores.FirstOrDefault(ps => ps.PriorityCriterionId == s.PriorityCriterionId);
            if (existing != null)
            {
                existing.RawScore = s.RawScore;
                existing.WeightedScore = weighted;
                existing.Justification = s.Justification;
            }
            else
            {
                var newScore = new ProjectPriorityScore
                {
                    ProjectId = projectId,
                    PriorityCriterionId = s.PriorityCriterionId,
                    RawScore = s.RawScore,
                    WeightedScore = weighted,
                    Justification = s.Justification
                };
                _context.ProjectPriorityScores.Add(newScore);
            }
        }

        project.PriorityLevel = totalWeightedScore switch
        {
            >= 7.5m => "HIGH",
            >= 4.5m => "MEDIUM",
            _ => "LOW"
        };

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            projectId = project.Id,
            calculatedTotalScore = totalWeightedScore,
            assignedPriorityLevel = project.PriorityLevel
        }, _correlationContext.CorrelationId));
    }
}

public class CreatePriorityModelDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<CreateCriterionDto>? Criteria { get; set; }
}

public class CreateCriterionDto
{
    public string Name { get; set; } = string.Empty;
    public decimal WeightPercentage { get; set; } = 20;
    public string? Description { get; set; }
}

public class ProjectScoreInputDto
{
    public Guid PriorityCriterionId { get; set; }
    public decimal RawScore { get; set; } = 5;
    public string? Justification { get; set; }
}
