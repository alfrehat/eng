using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Numbering;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/system/[controller]")]
public class NumberingController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public NumberingController(IApplicationDbContext context, CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await _context.NumberingDefinitions
            .OrderBy(n => n.Code)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<NumberingDefinition>>.Ok(list, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateDefinition([FromBody] CreateNumberingDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز وقالب الترقيم مطلوبان", _correlationContext.CorrelationId));

        var def = new NumberingDefinition
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Prefix = dto.Prefix?.Trim() ?? string.Empty,
            Suffix = dto.Suffix?.Trim(),
            YearFormat = dto.YearFormat ?? "YYYY",
            SequencePadding = dto.SequencePadding > 0 ? dto.SequencePadding : 4,
            ResetPeriod = dto.ResetPeriod ?? "YEARLY"
        };

        _context.NumberingDefinitions.Add(def);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<NumberingDefinition>.Ok(def, _correlationContext.CorrelationId));
    }
}

public class CreateNumberingDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Prefix { get; set; }
    public string? Suffix { get; set; }
    public string? YearFormat { get; set; }
    public int SequencePadding { get; set; } = 4;
    public string? ResetPeriod { get; set; }
}
