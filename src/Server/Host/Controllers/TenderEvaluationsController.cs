using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/tenders/{tenderId}/[controller]")]
public class TenderEvaluationsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<TenderEvaluationsController> _logger;

    public TenderEvaluationsController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<TenderEvaluationsController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetCommittees(Guid tenderId)
    {
        var committees = await _context.EvaluationCommittees
            .Where(c => c.TenderId == tenderId)
            .Include(c => c.Members)
            .Include(c => c.Criteria)
            .AsNoTracking()
            .Select(c => new
            {
                c.Id,
                c.TenderId,
                c.CommitteeName,
                c.HeadOfCommittee,
                c.FormationDate,
                Members = c.Members.Select(m => new
                {
                    m.Id,
                    m.FullName,
                    m.RoleOrTitle
                }),
                Criteria = c.Criteria.OrderBy(cr => cr.DisplayOrder).Select(cr => new
                {
                    cr.Id,
                    cr.CriterionName,
                    cr.MaxScore,
                    cr.WeightPercentage
                })
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(committees, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> FormCommittee(Guid tenderId, [FromBody] FormCommitteeDto dto)
    {
        var tender = await _context.Tenders.FindAsync(tenderId);
        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المحدد غير موجود", _correlationContext.CorrelationId));

        var committee = new EvaluationCommittee
        {
            TenderId = tenderId,
            CommitteeName = string.IsNullOrWhiteSpace(dto.CommitteeName) ? "لجنة التقييم الفني والمالي" : dto.CommitteeName.Trim(),
            HeadOfCommittee = dto.HeadOfCommittee.Trim(),
            FormationDate = dto.FormationDate ?? DateTime.UtcNow
        };

        _context.EvaluationCommittees.Add(committee);
        tender.Status = TenderLifecycleState.Evaluation;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            committee.Id,
            committee.TenderId,
            committee.CommitteeName,
            committee.HeadOfCommittee
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{committeeId}/members")]
    public async Task<IActionResult> AddMember(Guid tenderId, Guid committeeId, [FromBody] AddCommitteeMemberDto dto)
    {
        var committee = await _context.EvaluationCommittees.FindAsync(committeeId);
        if (committee == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "لجنة التقييم غير موجودة", _correlationContext.CorrelationId));

        var member = new EvaluationMember
        {
            EvaluationCommitteeId = committeeId,
            FullName = dto.FullName.Trim(),
            RoleOrTitle = string.IsNullOrWhiteSpace(dto.RoleOrTitle) ? "عضو لجنة" : dto.RoleOrTitle.Trim()
        };

        _context.EvaluationMembers.Add(member);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            member.Id,
            member.EvaluationCommitteeId,
            member.FullName,
            member.RoleOrTitle
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{committeeId}/criteria")]
    public async Task<IActionResult> AddCriterion(Guid tenderId, Guid committeeId, [FromBody] AddCriterionDto dto)
    {
        var committee = await _context.EvaluationCommittees.FindAsync(committeeId);
        if (committee == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "لجنة التقييم غير موجودة", _correlationContext.CorrelationId));

        var criterion = new EvaluationCriteria
        {
            EvaluationCommitteeId = committeeId,
            CriterionName = dto.CriterionName.Trim(),
            MaxScore = dto.MaxScore > 0 ? dto.MaxScore : 100,
            WeightPercentage = dto.WeightPercentage,
            DisplayOrder = dto.DisplayOrder
        };

        _context.EvaluationCriteriaList.Add(criterion);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            criterion.Id,
            criterion.EvaluationCommitteeId,
            criterion.CriterionName,
            criterion.MaxScore,
            criterion.WeightPercentage
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("scores")]
    public async Task<IActionResult> RecordScore(Guid tenderId, [FromBody] RecordScoreDto dto)
    {
        var criteria = await _context.EvaluationCriteriaList.FindAsync(dto.EvaluationCriteriaId);
        if (criteria == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "معيار التقييم غير موجود", _correlationContext.CorrelationId));

        var bid = await _context.Bids.FindAsync(dto.BidId);
        if (bid == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "عرض المناقص المحدد غير موجود", _correlationContext.CorrelationId));

        var existingResult = await _context.EvaluationResults
            .FirstOrDefaultAsync(r => r.EvaluationCriteriaId == dto.EvaluationCriteriaId && r.BidId == dto.BidId);

        if (existingResult != null)
        {
            existingResult.ScoreGiven = dto.ScoreGiven;
            existingResult.EvaluatorNotes = dto.EvaluatorNotes;
        }
        else
        {
            var result = new EvaluationResult
            {
                EvaluationCriteriaId = dto.EvaluationCriteriaId,
                BidId = dto.BidId,
                ScoreGiven = dto.ScoreGiven,
                EvaluatorNotes = dto.EvaluatorNotes
            };
            _context.EvaluationResults.Add(result);
        }

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("تم تسجيل درجات التقييم بنجاح", _correlationContext.CorrelationId));
    }
}

public class FormCommitteeDto
{
    public string? CommitteeName { get; set; }
    public string HeadOfCommittee { get; set; } = string.Empty;
    public DateTime? FormationDate { get; set; }
}

public class AddCommitteeMemberDto
{
    public string FullName { get; set; } = string.Empty;
    public string? RoleOrTitle { get; set; }
}

public class AddCriterionDto
{
    public string CriterionName { get; set; } = string.Empty;
    public decimal MaxScore { get; set; } = 100;
    public decimal WeightPercentage { get; set; } = 25;
    public int DisplayOrder { get; set; } = 1;
}

public class RecordScoreDto
{
    public Guid EvaluationCriteriaId { get; set; }
    public Guid BidId { get; set; }
    public decimal ScoreGiven { get; set; }
    public string? EvaluatorNotes { get; set; }
}
