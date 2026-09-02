using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BidsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<BidsController> _logger;

    public BidsController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<BidsController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet("bidders")]
    public async Task<IActionResult> GetBidders([FromQuery] string? search = null)
    {
        var query = _context.Bidders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(b => EF.Functions.ILike(b.Name, $"%{search}%") ||
                                     EF.Functions.ILike(b.CommercialRegisterNumber, $"%{search}%"));
        }

        var bidders = await query.OrderBy(b => b.Name)
            .Select(b => new
            {
                b.Id,
                b.Name,
                b.CommercialRegisterNumber,
                b.ContactPerson,
                b.Phone,
                b.Email,
                b.ClassificationGrade,
                BidsSubmitted = b.Bids.Count
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(bidders, _correlationContext.CorrelationId));
    }

    [HttpPost("bidders")]
    public async Task<IActionResult> CreateBidder([FromBody] CreateBidderDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.CommercialRegisterNumber))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "اسم المقاول/المناقص والرقم التجاري مطلوبان", _correlationContext.CorrelationId));

        var exists = await _context.Bidders.AnyAsync(b => b.CommercialRegisterNumber == dto.CommercialRegisterNumber.Trim());
        if (exists)
            return BadRequest(ApiResponse<object>.Fail("DUPLICATE", "المناقص مسجل مسبقاً بنفس السجل التجاري", _correlationContext.CorrelationId));

        var bidder = new Bidder
        {
            Name = dto.Name.Trim(),
            CommercialRegisterNumber = dto.CommercialRegisterNumber.Trim(),
            ContactPerson = dto.ContactPerson,
            Phone = dto.Phone,
            Email = dto.Email,
            Address = dto.Address,
            ClassificationGrade = dto.ClassificationGrade?.ToUpperInvariant() ?? "FIRST"
        };

        _context.Bidders.Add(bidder);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            bidder.Id,
            bidder.Name,
            bidder.CommercialRegisterNumber,
            bidder.ClassificationGrade
        }, _correlationContext.CorrelationId));
    }

    [HttpGet("tenders/{tenderId}/bids")]
    public async Task<IActionResult> GetTenderBids(Guid tenderId)
    {
        var bids = await _context.Bids
            .Where(b => b.TenderId == tenderId)
            .Include(b => b.Bidder)
            .Include(b => b.Guarantees)
            .AsNoTracking()
            .Select(b => new
            {
                b.Id,
                b.TenderId,
                b.BidderId,
                BidderName = b.Bidder.Name,
                b.Bidder.CommercialRegisterNumber,
                b.Bidder.ClassificationGrade,
                b.OfferedAmount,
                b.SubmissionDate,
                b.Status,
                b.Notes,
                Guarantees = b.Guarantees.Select(g => new
                {
                    g.Id,
                    g.GuaranteeTypeCode,
                    g.GuaranteeNumber,
                    g.BankName,
                    g.Amount,
                    g.Currency,
                    g.ExpiryDate,
                    g.Status
                })
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(bids, _correlationContext.CorrelationId));
    }

    [HttpPost("tenders/{tenderId}/bids")]
    public async Task<IActionResult> SubmitBid(Guid tenderId, [FromBody] SubmitBidDto dto)
    {
        var tender = await _context.Tenders.FindAsync(tenderId);
        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المحدد غير موجود", _correlationContext.CorrelationId));

        var bidder = await _context.Bidders.FindAsync(dto.BidderId);
        if (bidder == null)
            return BadRequest(ApiResponse<object>.Fail("BIDDER_NOT_FOUND", "المناقص المحدد غير مسجل في النظام", _correlationContext.CorrelationId));

        var alreadySubmitted = await _context.Bids.AnyAsync(b => b.TenderId == tenderId && b.BidderId == dto.BidderId);
        if (alreadySubmitted)
            return BadRequest(ApiResponse<object>.Fail("ALREADY_SUBMITTED", "لقد تم تقديم عرض مسبق لهذا المناقص على هذا العطاء", _correlationContext.CorrelationId));

        var bid = new Bid
        {
            TenderId = tenderId,
            BidderId = dto.BidderId,
            SubmissionDate = dto.SubmissionDate ?? DateTime.UtcNow,
            OfferedAmount = dto.OfferedAmount,
            Status = "SUBMITTED",
            Notes = dto.Notes
        };

        _context.Bids.Add(bid);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            bid.Id,
            bid.TenderId,
            bid.BidderId,
            bid.OfferedAmount,
            bid.Status,
            bid.SubmissionDate
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("bids/{bidId}/guarantees")]
    public async Task<IActionResult> AddGuarantee(Guid bidId, [FromBody] CreateBidGuaranteeDto dto)
    {
        var bid = await _context.Bids.FindAsync(bidId);
        if (bid == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "عرض المناقص المحدد غير موجود", _correlationContext.CorrelationId));

        var guarantee = new BidGuarantee
        {
            BidId = bidId,
            GuaranteeTypeCode = dto.GuaranteeTypeCode?.ToUpperInvariant() ?? "BANK_GUARANTEE",
            GuaranteeNumber = dto.GuaranteeNumber.Trim(),
            BankName = dto.BankName.Trim(),
            Amount = dto.Amount,
            Currency = dto.Currency ?? "JOD",
            IssueDate = dto.IssueDate ?? DateTime.UtcNow,
            ExpiryDate = dto.ExpiryDate ?? DateTime.UtcNow.AddDays(90),
            Status = "VALID"
        };

        _context.BidGuarantees.Add(guarantee);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            guarantee.Id,
            guarantee.BidId,
            guarantee.GuaranteeTypeCode,
            guarantee.GuaranteeNumber,
            guarantee.BankName,
            guarantee.Amount,
            guarantee.Status,
            guarantee.ExpiryDate
        }, _correlationContext.CorrelationId));
    }
}

public class CreateBidderDto
{
    public string Name { get; set; } = string.Empty;
    public string CommercialRegisterNumber { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? ClassificationGrade { get; set; }
}

public class SubmitBidDto
{
    public Guid BidderId { get; set; }
    public decimal OfferedAmount { get; set; }
    public DateTime? SubmissionDate { get; set; }
    public string? Notes { get; set; }
}

public class CreateBidGuaranteeDto
{
    public string? GuaranteeTypeCode { get; set; }
    public string GuaranteeNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public DateTime? IssueDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
}
