using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Configuration;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public SettingsController(IApplicationDbContext context, CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings([FromQuery] string? category = null)
    {
        var query = _context.SystemSettings.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(s => s.Category == category);
        }

        var list = await query.ToListAsync();
        return Ok(ApiResponse<IEnumerable<SystemSetting>>.Ok(list, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> SetSetting([FromBody] SystemSettingDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Category) || string.IsNullOrWhiteSpace(dto.Key))
        {
            return BadRequest(ApiResponse<object>.Fail("INVALID_INPUT", "الفئة والمفتاح مطلوبان.", _correlationContext.CorrelationId));
        }

        var existing = await _context.SystemSettings
            .FirstOrDefaultAsync(s => s.Category == dto.Category && s.Key == dto.Key);

        if (existing != null)
        {
            existing.Value = dto.Value;
            existing.Description = dto.Description ?? existing.Description;
            existing.DataType = dto.DataType ?? existing.DataType;
        }
        else
        {
            var newSetting = new SystemSetting
            {
                Category = dto.Category,
                Key = dto.Key,
                Value = dto.Value,
                Description = dto.Description,
                DataType = dto.DataType ?? "STRING"
            };
            _context.SystemSettings.Add(newSetting);
        }

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("تم حفظ الإعداد بنجاح", _correlationContext.CorrelationId));
    }
}

public class SystemSettingDto
{
    public string Category { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? DataType { get; set; }
}
