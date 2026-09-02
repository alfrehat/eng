using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Organization;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/system/[controller]")]
public class OrganizationController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public OrganizationController(IApplicationDbContext context, CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetTree()
    {
        var units = await _context.OrganizationUnits
            .OrderBy(u => u.DisplayOrder)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<OrganizationUnit>>.Ok(units, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateUnit([FromBody] CreateOrgUnitDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز الوحدة واسمها مطلوبان", _correlationContext.CorrelationId));

        var unit = new OrganizationUnit
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            UnitType = dto.UnitType,
            ParentId = dto.ParentId,
            Description = dto.Description,
            DisplayOrder = dto.DisplayOrder
        };

        _context.OrganizationUnits.Add(unit);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<OrganizationUnit>.Ok(unit, _correlationContext.CorrelationId));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUnit(Guid id)
    {
        var unit = await _context.OrganizationUnits.FindAsync(id);
        if (unit == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الوحدة التنظيمية غير موجودة", _correlationContext.CorrelationId));

        _context.OrganizationUnits.Remove(unit);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("تم حذف الوحدة التنظيمية بنجاح", _correlationContext.CorrelationId));
    }
}

public class CreateOrgUnitDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public OrganizationUnitType UnitType { get; set; }
    public Guid? ParentId { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
}
