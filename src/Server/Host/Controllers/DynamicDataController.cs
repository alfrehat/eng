using System.Text.Json;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.DynamicData;
using Knm.Enterprise.Domain.Metadata;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/system/data")]
public class DynamicDataController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<DynamicDataController> _logger;

    public DynamicDataController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<DynamicDataController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet("{screenCode}")]
    public async Task<IActionResult> GetRecords(
        string screenCode, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null)
    {
        var screen = await _context.SystemScreens
            .Include(s => s.Fields.OrderBy(f => f.DisplayOrder))
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Code == screenCode.ToUpperInvariant());

        if (screen == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", $"الشاشة '{screenCode}' غير موجودة", _correlationContext.CorrelationId));

        var query = _context.DynamicRecords
            .Where(r => r.ScreenId == screen.Id);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(r => EF.Functions.ILike(r.DataJson, $"%{search}%") || 
                                     (r.ReferenceNumber != null && EF.Functions.ILike(r.ReferenceNumber, $"%{search}%")));
        }

        var totalCount = await query.CountAsync();
        var records = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync();

        var result = new
        {
            screen = new { screen.Id, screen.Code, screen.Title, screen.Fields },
            items = records.Select(r => new
            {
                r.Id,
                r.ReferenceNumber,
                data = JsonSerializer.Deserialize<Dictionary<string, object>>(r.DataJson),
                r.CreatedAt,
                r.CreatedBy,
                r.UpdatedAt,
                r.Version
            }),
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        return Ok(ApiResponse<object>.Ok(result, _correlationContext.CorrelationId));
    }

    [HttpPost("{screenCode}")]
    public async Task<IActionResult> CreateRecord(string screenCode, [FromBody] Dictionary<string, object> payload)
    {
        var screen = await _context.SystemScreens
            .Include(s => s.Fields)
            .FirstOrDefaultAsync(s => s.Code == screenCode.ToUpperInvariant());

        if (screen == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", $"الشاشة '{screenCode}' غير موجودة", _correlationContext.CorrelationId));

        // Validate Required Fields
        foreach (var field in screen.Fields.Where(f => f.IsRequired))
        {
            if (!payload.ContainsKey(field.FieldName) || payload[field.FieldName] == null || 
                string.IsNullOrWhiteSpace(payload[field.FieldName]?.ToString()))
            {
                return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", $"الحقل '{field.Label}' إلزامي ولا يمكن تركه فارغاً", _correlationContext.CorrelationId));
            }
        }

        // Generate Reference Number if numbering configured
        string? refNumber = null;
        if (!string.IsNullOrWhiteSpace(screen.NumberingDefinitionCode))
        {
            var numberingDef = await _context.NumberingDefinitions
                .FirstOrDefaultAsync(n => n.Code == screen.NumberingDefinitionCode);
            if (numberingDef != null)
            {
                refNumber = numberingDef.GenerateNextFormatted();
            }
        }

        var record = new DynamicRecord
        {
            ScreenId = screen.Id,
            ReferenceNumber = refNumber,
            DataJson = JsonSerializer.Serialize(payload)
        };

        _context.DynamicRecords.Add(record);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Dynamic record created in screen {ScreenCode}, ID: {RecordId}, Ref: {Ref}", screen.Code, record.Id, refNumber);

        var responseData = new
        {
            record.Id,
            record.ReferenceNumber,
            data = payload,
            record.CreatedAt
        };

        return Ok(ApiResponse<object>.Ok(responseData, _correlationContext.CorrelationId));
    }

    [HttpDelete("{screenCode}/{id}")]
    public async Task<IActionResult> DeleteRecord(string screenCode, Guid id)
    {
        var record = await _context.DynamicRecords.FindAsync(id);
        if (record == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "السجل المطلوب غير موجود", _correlationContext.CorrelationId));

        _context.DynamicRecords.Remove(record);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("تم حذف السجل بنجاح", _correlationContext.CorrelationId));
    }
}
