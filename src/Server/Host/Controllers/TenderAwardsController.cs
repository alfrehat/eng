using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/tenders/{tenderId}/awards")]
public class TenderAwardsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<TenderAwardsController> _logger;

    public TenderAwardsController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<TenderAwardsController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAwards(Guid tenderId)
    {
        var recommendations = await _context.AwardRecommendations
            .Where(ar => ar.TenderId == tenderId)
            .Include(ar => ar.SelectedBid)
                .ThenInclude(b => b.Bidder)
            .Include(ar => ar.Decisions)
            .AsNoTracking()
            .Select(ar => new
            {
                ar.Id,
                ar.TenderId,
                ar.SelectedBidId,
                WinnerBidderName = ar.SelectedBid.Bidder.Name,
                WinnerCommercialRegister = ar.SelectedBid.Bidder.CommercialRegisterNumber,
                ar.RecommendedAmount,
                ar.RecommendationDate,
                ar.Justification,
                ar.Status,
                Decisions = ar.Decisions.Select(d => new
                {
                    d.Id,
                    d.CouncilDecisionNumber,
                    d.DecisionDate,
                    d.DecisionStatus,
                    d.FinalAwardedAmount,
                    d.Notes
                })
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(recommendations, _correlationContext.CorrelationId));
    }

    [HttpPost("recommendations")]
    public async Task<IActionResult> CreateRecommendation(Guid tenderId, [FromBody] CreateAwardRecommendationDto dto)
    {
        var tender = await _context.Tenders.FindAsync(tenderId);
        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المحدد غير موجود", _correlationContext.CorrelationId));

        var bid = await _context.Bids
            .Include(b => b.Bidder)
            .FirstOrDefaultAsync(b => b.Id == dto.SelectedBidId && b.TenderId == tenderId);

        if (bid == null)
            return BadRequest(ApiResponse<object>.Fail("BID_NOT_FOUND", "عرض المناقص المحدد غير موجود لهذا العطاء", _correlationContext.CorrelationId));

        var recommendation = new AwardRecommendation
        {
            TenderId = tenderId,
            SelectedBidId = dto.SelectedBidId,
            RecommendedAmount = dto.RecommendedAmount > 0 ? dto.RecommendedAmount : bid.OfferedAmount,
            Justification = string.IsNullOrWhiteSpace(dto.Justification) ? "العرض الأنسب والأفضل مالياً وفنياً والمطابق للشروط" : dto.Justification.Trim(),
            RecommendationDate = dto.RecommendationDate ?? DateTime.UtcNow,
            Status = "PENDING_APPROVAL"
        };

        _context.AwardRecommendations.Add(recommendation);
        tender.Status = TenderLifecycleState.AwardRecommendation;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Award recommendation created for Tender {TenderNumber} to Bidder {BidderName}", tender.TenderNumber, bid.Bidder.Name);

        return Ok(ApiResponse<object>.Ok(new
        {
            recommendation.Id,
            recommendation.TenderId,
            recommendation.SelectedBidId,
            recommendation.RecommendedAmount,
            recommendation.Status
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("recommendations/{recommendationId}/decisions")]
    public async Task<IActionResult> RecordDecision(Guid tenderId, Guid recommendationId, [FromBody] RecordAwardDecisionDto dto)
    {
        var recommendation = await _context.AwardRecommendations
            .Include(ar => ar.Tender)
                .ThenInclude(t => t.Project)
            .FirstOrDefaultAsync(ar => ar.Id == recommendationId && ar.TenderId == tenderId);

        if (recommendation == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "التوصية بالإحالة غير موجودة", _correlationContext.CorrelationId));

        var decision = new AwardDecision
        {
            TenderId = tenderId,
            AwardRecommendationId = recommendationId,
            CouncilDecisionNumber = dto.CouncilDecisionNumber.Trim(),
            DecisionDate = dto.DecisionDate ?? DateTime.UtcNow,
            DecisionStatus = dto.DecisionStatus?.ToUpperInvariant() ?? "APPROVED",
            FinalAwardedAmount = dto.FinalAwardedAmount > 0 ? dto.FinalAwardedAmount : recommendation.RecommendedAmount,
            Notes = dto.Notes
        };

        _context.AwardDecisions.Add(decision);

        if (decision.DecisionStatus == "APPROVED")
        {
            recommendation.Status = "ENDORSED";
            recommendation.Tender.Status = TenderLifecycleState.Awarded;

            // Automatically sync project contract value
            if (recommendation.Tender.Project != null)
            {
                recommendation.Tender.Project.ContractValue = decision.FinalAwardedAmount;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            decision.Id,
            decision.CouncilDecisionNumber,
            decision.DecisionStatus,
            decision.FinalAwardedAmount,
            tenderStatus = recommendation.Tender.Status.ToString()
        }, _correlationContext.CorrelationId));
    }
}

public class CreateAwardRecommendationDto
{
    public Guid SelectedBidId { get; set; }
    public decimal RecommendedAmount { get; set; }
    public string? Justification { get; set; }
    public DateTime? RecommendationDate { get; set; }
}

public class RecordAwardDecisionDto
{
    public string CouncilDecisionNumber { get; set; } = string.Empty;
    public DateTime? DecisionDate { get; set; }
    public string? DecisionStatus { get; set; } = "APPROVED";
    public decimal FinalAwardedAmount { get; set; }
    public string? Notes { get; set; }
}
