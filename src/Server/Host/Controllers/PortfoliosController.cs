using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PortfoliosController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public PortfoliosController(IApplicationDbContext context, CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetPortfolios()
    {
        var portfolios = await _context.Portfolios
            .Include(p => p.Items)
                .ThenInclude(i => i.Project)
            .AsNoTracking()
            .ToListAsync();

        var result = portfolios.Select(p => new
        {
            p.Id,
            p.Code,
            p.Name,
            p.TargetYear,
            p.Description,
            p.TotalBudget,
            p.Status,
            ProjectsCount = p.Items.Count,
            TotalAllocated = p.Items.Sum(i => i.AllocatedAmount),
            Projects = p.Items.Select(i => new
            {
                i.ProjectId,
                i.Project.ProjectNumber,
                i.Project.Name,
                i.Project.Status,
                i.AllocatedAmount
            })
        });

        return Ok(ApiResponse<object>.Ok(result, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreatePortfolio([FromBody] CreatePortfolioDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز واسم المحفظة مطلوبان", _correlationContext.CorrelationId));

        var portfolio = new Portfolio
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            TargetYear = dto.TargetYear > 0 ? dto.TargetYear : DateTime.UtcNow.Year,
            TotalBudget = dto.TotalBudget,
            Description = dto.Description
        };

        _context.Portfolios.Add(portfolio);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<Portfolio>.Ok(portfolio, _correlationContext.CorrelationId));
    }

    [HttpPost("{portfolioId}/items")]
    public async Task<IActionResult> AddProjectToPortfolio(Guid portfolioId, [FromBody] AddPortfolioItemDto dto)
    {
        var portfolio = await _context.Portfolios.FindAsync(portfolioId);
        if (portfolio == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المحفظة المحددة غير موجودة", _correlationContext.CorrelationId));

        var project = await _context.Projects.FindAsync(dto.ProjectId);
        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المحدد غير موجود", _correlationContext.CorrelationId));

        var item = new PortfolioItem
        {
            PortfolioId = portfolioId,
            ProjectId = dto.ProjectId,
            AllocatedAmount = dto.AllocatedAmount,
            Notes = dto.Notes
        };

        _context.PortfolioItems.Add(item);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<PortfolioItem>.Ok(item, _correlationContext.CorrelationId));
    }
}

public class CreatePortfolioDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int TargetYear { get; set; } = DateTime.UtcNow.Year;
    public decimal TotalBudget { get; set; } = 0;
    public string? Description { get; set; }
}

public class AddPortfolioItemDto
{
    public Guid ProjectId { get; set; }
    public decimal AllocatedAmount { get; set; } = 0;
    public string? Notes { get; set; }
}
