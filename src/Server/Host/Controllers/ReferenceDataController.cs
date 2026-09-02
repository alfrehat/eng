using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.ReferenceData;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/system/[controller]")]
public class ReferenceDataController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public ReferenceDataController(IApplicationDbContext context, CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllLists()
    {
        var lists = await _context.ReferenceLists
            .Include(l => l.Items.OrderBy(i => i.DisplayOrder))
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<ReferenceList>>.Ok(lists, _correlationContext.CorrelationId));
    }

    [HttpGet("{code}")]
    public async Task<IActionResult> GetListByCode(string code)
    {
        var list = await _context.ReferenceLists
            .Include(l => l.Items.OrderBy(i => i.DisplayOrder))
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Code == code.ToUpperInvariant());

        if (list == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", $"القائمة المرجعية '{code}' غير موجودة", _correlationContext.CorrelationId));

        return Ok(ApiResponse<ReferenceList>.Ok(list, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateList([FromBody] CreateRefListDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز القائمة واسمها مطلوبان", _correlationContext.CorrelationId));

        var list = new ReferenceList
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Description = dto.Description
        };

        if (dto.Items != null)
        {
            int order = 1;
            foreach (var item in dto.Items)
            {
                list.Items.Add(new ReferenceItem
                {
                    Value = item.Value,
                    Label = item.Label,
                    ColorCode = item.ColorCode,
                    DisplayOrder = order++
                });
            }
        }

        _context.ReferenceLists.Add(list);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<ReferenceList>.Ok(list, _correlationContext.CorrelationId));
    }
}

public class CreateRefListDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<CreateRefItemDto>? Items { get; set; }
}

public class CreateRefItemDto
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? ColorCode { get; set; }
}
