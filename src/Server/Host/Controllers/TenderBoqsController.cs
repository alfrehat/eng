using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Tenders;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/tenders/{tenderId}/[controller]")]
public class TenderBoqsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ITenderCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;

    public TenderBoqsController(
        IApplicationDbContext context,
        ITenderCalculationService calcService,
        CorrelationContext correlationContext)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetBoqs(Guid tenderId)
    {
        var boqs = await _context.TenderBoqs
            .Where(b => b.TenderId == tenderId)
            .Include(b => b.Items.OrderBy(i => i.ItemNumber))
            .AsNoTracking()
            .Select(b => new
            {
                b.Id,
                b.TenderId,
                b.Title,
                b.SubTotal,
                b.TaxRatePercent,
                b.TaxAmount,
                b.GrandTotal,
                Items = b.Items.Select(i => new
                {
                    i.Id,
                    i.ItemNumber,
                    i.Description,
                    i.Unit,
                    i.Quantity,
                    i.EstimatedUnitPrice,
                    i.EstimatedTotal,
                    i.Notes
                })
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(boqs, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateBoq(Guid tenderId, [FromBody] CreateTenderBoqDto dto)
    {
        var tender = await _context.Tenders.FindAsync(tenderId);
        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المحدد غير موجود", _correlationContext.CorrelationId));

        var boq = new TenderBoq
        {
            TenderId = tenderId,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? "جدول الكميات الأساسي" : dto.Title.Trim(),
            TaxRatePercent = dto.TaxRatePercent >= 0 ? dto.TaxRatePercent : 16
        };

        _context.TenderBoqs.Add(boq);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            boq.Id,
            boq.TenderId,
            boq.Title,
            boq.SubTotal,
            boq.TaxRatePercent,
            boq.TaxAmount,
            boq.GrandTotal
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{boqId}/items")]
    public async Task<IActionResult> AddBoqItem(Guid tenderId, Guid boqId, [FromBody] CreateBoqItemDto dto)
    {
        var boq = await _context.TenderBoqs
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == boqId && b.TenderId == tenderId);

        if (boq == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "جدول الكميات المحدد غير موجود", _correlationContext.CorrelationId));

        if (dto.Quantity < 0 || dto.EstimatedUnitPrice < 0)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "الكمية وسعر الوحدة التقديري يجب أن تكون قيماً موجبة", _correlationContext.CorrelationId));

        var nextItemNumber = boq.Items.Any() ? boq.Items.Max(i => i.ItemNumber) + 1 : 1;

        var item = new TenderBoqItem
        {
            TenderBoqId = boqId,
            ItemNumber = nextItemNumber,
            Description = dto.Description.Trim(),
            Unit = dto.Unit?.Trim() ?? "م2",
            Quantity = dto.Quantity,
            EstimatedUnitPrice = dto.EstimatedUnitPrice,
            Notes = dto.Notes
        };
        item.ComputeTotal();

        _context.TenderBoqItems.Add(item);
        await _context.SaveChangesAsync();

        // Automatically recalculate header totals
        var recalcResult = await _calcService.RecalculateBoqTotalsAsync(boqId);

        return Ok(ApiResponse<object>.Ok(new
        {
            item.Id,
            item.TenderBoqId,
            item.ItemNumber,
            item.Description,
            item.Unit,
            item.Quantity,
            item.EstimatedUnitPrice,
            item.EstimatedTotal,
            boqSubTotal = recalcResult.Value?.SubTotal ?? 0,
            boqGrandTotal = recalcResult.Value?.GrandTotal ?? 0
        }, _correlationContext.CorrelationId));
    }

    [HttpPut("{boqId}/items/{itemId}")]
    public async Task<IActionResult> UpdateBoqItem(Guid tenderId, Guid boqId, Guid itemId, [FromBody] UpdateBoqItemDto dto)
    {
        var item = await _context.TenderBoqItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.TenderBoqId == boqId);

        if (item == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "بند جدول الكميات غير موجود", _correlationContext.CorrelationId));

        if (dto.Quantity < 0 || dto.EstimatedUnitPrice < 0)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "الكمية وسعر الوحدة التقديري يجب أن تكون قيماً موجبة", _correlationContext.CorrelationId));

        item.Quantity = dto.Quantity;
        item.EstimatedUnitPrice = dto.EstimatedUnitPrice;
        if (!string.IsNullOrWhiteSpace(dto.Description)) item.Description = dto.Description.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Unit)) item.Unit = dto.Unit.Trim();
        item.Notes = dto.Notes;
        item.ComputeTotal();

        await _context.SaveChangesAsync();

        // Recalculate
        var recalcResult = await _calcService.RecalculateBoqTotalsAsync(boqId);

        return Ok(ApiResponse<object>.Ok(new
        {
            item.Id,
            item.ItemNumber,
            item.Quantity,
            item.EstimatedUnitPrice,
            item.EstimatedTotal,
            boqSubTotal = recalcResult.Value?.SubTotal ?? 0,
            boqGrandTotal = recalcResult.Value?.GrandTotal ?? 0
        }, _correlationContext.CorrelationId));
    }

    [HttpDelete("{boqId}/items/{itemId}")]
    public async Task<IActionResult> DeleteBoqItem(Guid tenderId, Guid boqId, Guid itemId)
    {
        var item = await _context.TenderBoqItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.TenderBoqId == boqId);

        if (item == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "بند جدول الكميات غير موجود", _correlationContext.CorrelationId));

        _context.TenderBoqItems.Remove(item);
        await _context.SaveChangesAsync();

        var recalcResult = await _calcService.RecalculateBoqTotalsAsync(boqId);

        return Ok(ApiResponse<object>.Ok(new
        {
            message = "تم حذف البند وإعادة احتساب المجموع الإجمالي بنجاح",
            boqSubTotal = recalcResult.Value?.SubTotal ?? 0,
            boqGrandTotal = recalcResult.Value?.GrandTotal ?? 0
        }, _correlationContext.CorrelationId));
    }
}

public class CreateTenderBoqDto
{
    public string? Title { get; set; }
    public decimal TaxRatePercent { get; set; } = 16;
}

public class CreateBoqItemDto
{
    public string Description { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public decimal Quantity { get; set; } = 1;
    public decimal EstimatedUnitPrice { get; set; } = 0;
    public string? Notes { get; set; }
}

public class UpdateBoqItemDto
{
    public string? Description { get; set; }
    public string? Unit { get; set; }
    public decimal Quantity { get; set; }
    public decimal EstimatedUnitPrice { get; set; }
    public string? Notes { get; set; }
}
