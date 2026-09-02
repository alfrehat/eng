using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/tenders/{tenderId}/openings")]
public class TenderOpeningsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<TenderOpeningsController> _logger;

    public TenderOpeningsController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<TenderOpeningsController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetOpenings(Guid tenderId)
    {
        var openings = await _context.TenderOpenings
            .Where(o => o.TenderId == tenderId)
            .Include(o => o.Entries)
                .ThenInclude(e => e.Bid)
                    .ThenInclude(b => b.Bidder)
            .AsNoTracking()
            .Select(o => new
            {
                o.Id,
                o.TenderId,
                o.OpeningDate,
                o.ConductedBy,
                o.Notes,
                o.IsLocked,
                Entries = o.Entries.Select(e => new
                {
                    e.Id,
                    e.BidId,
                    BidderName = e.Bid.Bidder.Name,
                    CommercialRegisterNumber = e.Bid.Bidder.CommercialRegisterNumber,
                    e.ReadOutAmount,
                    e.GuaranteeReceived,
                    e.ChecklistPassed,
                    e.Remarks
                })
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(openings, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> StartOpeningSession(Guid tenderId, [FromBody] CreateOpeningSessionDto dto)
    {
        var tender = await _context.Tenders.FindAsync(tenderId);
        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المحدد غير موجود", _correlationContext.CorrelationId));

        var opening = new TenderOpening
        {
            TenderId = tenderId,
            OpeningDate = dto.OpeningDate ?? DateTime.UtcNow,
            ConductedBy = string.IsNullOrWhiteSpace(dto.ConductedBy) ? "لجنة فتح المظاريف الرسمية" : dto.ConductedBy.Trim(),
            Notes = dto.Notes
        };

        _context.TenderOpenings.Add(opening);
        tender.Status = TenderLifecycleState.Opening;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Tender opening session initiated for Tender {TenderNumber}", tender.TenderNumber);

        return Ok(ApiResponse<object>.Ok(new
        {
            opening.Id,
            opening.TenderId,
            opening.OpeningDate,
            opening.ConductedBy,
            opening.IsLocked
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{openingId}/entries")]
    public async Task<IActionResult> RecordOpeningEntry(Guid tenderId, Guid openingId, [FromBody] CreateOpeningEntryDto dto)
    {
        var opening = await _context.TenderOpenings.FindAsync(openingId);
        if (opening == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "جلسة فتح المظاريف غير موجودة", _correlationContext.CorrelationId));

        if (opening.IsLocked)
            return BadRequest(ApiResponse<object>.Fail("SESSION_LOCKED", "جلسة فتح المظاريف مقفلة ولا يمكن التعديل عليها", _correlationContext.CorrelationId));

        var bid = await _context.Bids.FindAsync(dto.BidId);
        if (bid == null)
            return BadRequest(ApiResponse<object>.Fail("BID_NOT_FOUND", "عرض المناقص المحدد غير موجود", _correlationContext.CorrelationId));

        var entry = new TenderOpeningEntry
        {
            TenderOpeningId = openingId,
            BidId = dto.BidId,
            ReadOutAmount = dto.ReadOutAmount > 0 ? dto.ReadOutAmount : bid.OfferedAmount,
            GuaranteeReceived = dto.GuaranteeReceived,
            ChecklistPassed = dto.ChecklistPassed,
            Remarks = dto.Remarks
        };

        _context.TenderOpeningEntries.Add(entry);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            entry.Id,
            entry.TenderOpeningId,
            entry.BidId,
            entry.ReadOutAmount,
            entry.GuaranteeReceived,
            entry.ChecklistPassed
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{openingId}/lock")]
    public async Task<IActionResult> LockOpeningSession(Guid tenderId, Guid openingId)
    {
        var opening = await _context.TenderOpenings.FindAsync(openingId);
        if (opening == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "جلسة فتح المظاريف غير موجودة", _correlationContext.CorrelationId));

        opening.IsLocked = true;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("تم إقفال محضر جلسة فتح المظاريف وتوثيق السجل نهائياً", _correlationContext.CorrelationId));
    }
}

public class CreateOpeningSessionDto
{
    public DateTime? OpeningDate { get; set; }
    public string? ConductedBy { get; set; }
    public string? Notes { get; set; }
}

public class CreateOpeningEntryDto
{
    public Guid BidId { get; set; }
    public decimal ReadOutAmount { get; set; }
    public bool GuaranteeReceived { get; set; } = true;
    public bool ChecklistPassed { get; set; } = true;
    public string? Remarks { get; set; }
}
