using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Application.Projects;

public interface IProjectPriorityService
{
    Task<Result<decimal>> CalculateProjectPriorityAsync(Guid projectId, CancellationToken cancellationToken = default);
}

public class ProjectPriorityService : IProjectPriorityService
{
    private readonly IApplicationDbContext _context;

    public ProjectPriorityService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<decimal>> CalculateProjectPriorityAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var project = await _context.Projects
            .Include(p => p.PriorityScores)
                .ThenInclude(ps => ps.PriorityCriterion)
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

        if (project == null)
            return Result<decimal>.Failure(new Error("NOT_FOUND", "المشروع المطلوب غير موجود"));

        if (!project.PriorityScores.Any())
            return Result<decimal>.Success(0);

        decimal totalWeightedScore = 0;
        foreach (var score in project.PriorityScores)
        {
            var weightFactor = score.PriorityCriterion.WeightPercentage / 100m;
            score.WeightedScore = score.RawScore * weightFactor;
            totalWeightedScore += score.WeightedScore;
        }

        // Assign Priority Level based on calculated total score (scale 0-10)
        project.PriorityLevel = totalWeightedScore switch
        {
            >= 7.5m => "HIGH",
            >= 4.5m => "MEDIUM",
            _ => "LOW"
        };

        await _context.SaveChangesAsync(cancellationToken);

        return Result<decimal>.Success(totalWeightedScore);
    }
}
