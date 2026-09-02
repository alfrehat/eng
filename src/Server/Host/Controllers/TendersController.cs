using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Tenders;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TendersController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ITenderCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<TendersController> _logger;

    public TendersController(
        IApplicationDbContext context,
        ITenderCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<TendersController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetTenders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null,
        [FromQuery] TenderLifecycleState? status = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? tenderType = null)
    {
        var query = _context.Tenders
            .Include(t => t.Project)
            .Include(t => t.OrganizationUnit)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(t => EF.Functions.ILike(t.Title, $"%{search}%") || 
                                     EF.Functions.ILike(t.TenderNumber, $"%{search}%"));
        }

        if (status.HasValue)
        {
            query = query.Where(t => t.Status == status.Value);
        }

        if (projectId.HasValue)
        {
            query = query.Where(t => t.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(tenderType))
        {
            query = query.Where(t => t.TenderTypeCode == tenderType.ToUpperInvariant());
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.TenderNumber,
                t.Title,
                t.ProjectId,
                ProjectNumber = t.Project.ProjectNumber,
                ProjectName = t.Project.Name,
                t.TenderTypeCode,
                t.TenderMethodCode,
                t.CategoryCode,
                t.Status,
                StatusName = t.Status.ToString(),
                t.EstimatedValue,
                t.Currency,
                t.PublicationDate,
                t.ClosingDate,
                t.OpeningDate,
                OrganizationName = t.OrganizationUnit != null ? t.OrganizationUnit.Name : null,
                t.ResponsibleEngineer,
                BidsCount = t.Bids.Count
            })
            .ToListAsync();

        var paged = new PagedResult<object>(items, totalCount, page, pageSize);
        return Ok(ApiResponse<PagedResult<object>>.Ok(paged, _correlationContext.CorrelationId));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTenderById(Guid id)
    {
        var tender = await _context.Tenders
            .Include(t => t.Project)
            .Include(t => t.OrganizationUnit)
            .Include(t => t.Documents)
            .Include(t => t.Boqs)
                .ThenInclude(b => b.Items.OrderBy(i => i.ItemNumber))
            .Include(t => t.Bids)
                .ThenInclude(b => b.Bidder)
            .Include(t => t.Bids)
                .ThenInclude(b => b.Guarantees)
            .Include(t => t.Openings)
                .ThenInclude(o => o.Entries)
            .Include(t => t.EvaluationCommittees)
                .ThenInclude(c => c.Members)
            .Include(t => t.AwardRecommendations)
                .ThenInclude(ar => ar.Decisions)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المطلوب غير موجود", _correlationContext.CorrelationId));

        var result = new
        {
            tender.Id,
            tender.TenderNumber,
            tender.Title,
            tender.Description,
            tender.ProjectId,
            Project = new
            {
                tender.Project.Id,
                tender.Project.ProjectNumber,
                tender.Project.Name,
                tender.Project.Status,
                tender.Project.EstimatedCost,
                tender.Project.ContractValue
            },
            tender.TenderTypeCode,
            tender.TenderMethodCode,
            tender.CategoryCode,
            tender.Status,
            StatusName = tender.Status.ToString(),
            tender.EstimatedValue,
            tender.Currency,
            tender.PublicationDate,
            tender.ClosingDate,
            tender.OpeningDate,
            tender.ResponsibleEngineer,
            OrganizationName = tender.OrganizationUnit?.Name,
            tender.Notes,
            Boqs = tender.Boqs.Select(b => new
            {
                b.Id,
                b.Title,
                b.SubTotal,
                b.TaxRatePercent,
                b.TaxAmount,
                b.GrandTotal,
                ItemsCount = b.Items.Count,
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
            }),
            Documents = tender.Documents.Select(d => new
            {
                d.Id,
                d.Title,
                d.DocumentTypeCode,
                d.DocumentVersion,
                d.IsMandatory
            }),
            Bids = tender.Bids.Select(b => new
            {
                b.Id,
                b.BidderId,
                BidderName = b.Bidder.Name,
                BidderRegister = b.Bidder.CommercialRegisterNumber,
                b.OfferedAmount,
                b.SubmissionDate,
                b.Status,
                Guarantees = b.Guarantees.Select(g => new
                {
                    g.Id,
                    g.GuaranteeTypeCode,
                    g.GuaranteeNumber,
                    g.BankName,
                    g.Amount,
                    g.Status,
                    g.ExpiryDate
                })
            }),
            Openings = tender.Openings.Select(o => new
            {
                o.Id,
                o.OpeningDate,
                o.ConductedBy,
                o.IsLocked,
                EntriesCount = o.Entries.Count
            }),
            EvaluationCommittees = tender.EvaluationCommittees.Select(c => new
            {
                c.Id,
                c.CommitteeName,
                c.HeadOfCommittee,
                MembersCount = c.Members.Count
            }),
            AwardRecommendations = tender.AwardRecommendations.Select(ar => new
            {
                ar.Id,
                ar.SelectedBidId,
                ar.RecommendedAmount,
                ar.RecommendationDate,
                ar.Status,
                ar.Justification,
                Decisions = ar.Decisions.Select(d => new
                {
                    d.Id,
                    d.CouncilDecisionNumber,
                    d.DecisionDate,
                    d.DecisionStatus,
                    d.FinalAwardedAmount
                })
            })
        };

        return Ok(ApiResponse<object>.Ok(result, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateTender([FromBody] CreateTenderDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "عنوان العطاء مطلوب", _correlationContext.CorrelationId));

        // 1. Validate that the associated Project exists
        var project = await _context.Projects.FindAsync(dto.ProjectId);
        if (project == null)
            return BadRequest(ApiResponse<object>.Fail("PROJECT_NOT_FOUND", "المشروع الهندسي المرتبط غير موجود في النظام", _correlationContext.CorrelationId));

        // 2. Validate Dates Order
        var dateValidation = _calcService.ValidateTenderDates(dto.PublicationDate, dto.ClosingDate, dto.OpeningDate);
        if (!dateValidation.IsSuccess)
        {
            return BadRequest(ApiResponse<object>.Fail(dateValidation.Error.Code, dateValidation.Error.Message, _correlationContext.CorrelationId));
        }

        // 3. Generate Tender Number using Numbering Engine
        string tenderNumber = dto.TenderNumber;
        if (string.IsNullOrWhiteSpace(tenderNumber))
        {
            var numberingDef = await _context.NumberingDefinitions
                .FirstOrDefaultAsync(n => n.Code == "TENDER_SEQ" || n.Code == "TEN_SEQ");

            if (numberingDef != null)
            {
                tenderNumber = numberingDef.GenerateNextFormatted();
            }
            else
            {
                var year = DateTime.UtcNow.Year;
                var count = await _context.Tenders.CountAsync();
                tenderNumber = $"TEN-{year}-{(count + 1):D4}";
            }
        }

        var tender = new Tender
        {
            TenderNumber = tenderNumber,
            Title = dto.Title.Trim(),
            Description = dto.Description,
            ProjectId = dto.ProjectId,
            TenderTypeCode = dto.TenderTypeCode?.ToUpperInvariant() ?? "WORKS",
            TenderMethodCode = dto.TenderMethodCode?.ToUpperInvariant() ?? "OPEN",
            CategoryCode = dto.CategoryCode?.ToUpperInvariant() ?? "ROADS",
            Status = TenderLifecycleState.Draft,
            OrganizationUnitId = dto.OrganizationUnitId,
            ResponsibleEngineer = dto.ResponsibleEngineer ?? project.ResponsibleEngineer,
            EstimatedValue = dto.EstimatedValue > 0 ? dto.EstimatedValue : project.EstimatedCost,
            Currency = dto.Currency ?? "JOD",
            FinancialProgramId = dto.FinancialProgramId,
            BudgetItemId = dto.BudgetItemId,
            FundingSourceId = dto.FundingSourceId,
            PublicationDate = dto.PublicationDate ?? DateTime.UtcNow.Date,
            ClosingDate = dto.ClosingDate ?? DateTime.UtcNow.Date.AddDays(21),
            OpeningDate = dto.OpeningDate ?? DateTime.UtcNow.Date.AddDays(22),
            Notes = dto.Notes
        };

        _context.Tenders.Add(tender);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Tender created successfully. Number: {TenderNumber}, ID: {TenderId}, Project: {ProjectNumber}",
            tender.TenderNumber, tender.Id, project.ProjectNumber);

        return Ok(ApiResponse<object>.Ok(new
        {
            tender.Id,
            tender.TenderNumber,
            tender.Title,
            tender.ProjectId,
            tender.EstimatedValue,
            tender.Currency,
            tender.Status,
            StatusName = tender.Status.ToString()
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{id}/status")]
    public async Task<IActionResult> TransitionStatus(Guid id, [FromBody] UpdateTenderStatusDto dto)
    {
        var tender = await _context.Tenders.FindAsync(id);
        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المطلوب غير موجود", _correlationContext.CorrelationId));

        var oldStatus = tender.Status;
        tender.Status = dto.NewStatus;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Tender {TenderNumber} transitioned from {Old} to {New}", tender.TenderNumber, oldStatus, dto.NewStatus);

        return Ok(ApiResponse<string>.Ok($"تم تغيير حالة العطاء إلى: {dto.NewStatus}", _correlationContext.CorrelationId));
    }

    [HttpGet("{id}/dashboard")]
    public async Task<IActionResult> GetTenderDashboard(Guid id)
    {
        var tender = await _context.Tenders
            .Include(t => t.Project)
            .Include(t => t.Boqs)
                .ThenInclude(b => b.Items)
            .Include(t => t.Bids)
            .Include(t => t.AwardRecommendations)
                .ThenInclude(ar => ar.Decisions)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tender == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العطاء المطلوب غير موجود", _correlationContext.CorrelationId));

        var primaryBoq = tender.Boqs.FirstOrDefault();
        var boqGrandTotal = primaryBoq?.GrandTotal ?? 0;
        var biddersCount = tender.Bids.Count;
        var awardDecision = tender.AwardRecommendations.SelectMany(ar => ar.Decisions).FirstOrDefault();

        var daysRemaining = tender.ClosingDate.HasValue 
            ? Math.Max(0, (tender.ClosingDate.Value.Date - DateTime.UtcNow.Date).Days)
            : 0;

        return Ok(ApiResponse<object>.Ok(new
        {
            tenderId = tender.Id,
            tenderNumber = tender.TenderNumber,
            title = tender.Title,
            projectNumber = tender.Project.ProjectNumber,
            projectName = tender.Project.Name,
            status = tender.Status.ToString(),
            estimatedValue = tender.EstimatedValue,
            boqGrandTotal,
            biddersCount,
            daysRemaining,
            publicationDate = tender.PublicationDate,
            closingDate = tender.ClosingDate,
            openingDate = tender.OpeningDate,
            isAwarded = tender.Status == TenderLifecycleState.Awarded || awardDecision?.DecisionStatus == "APPROVED",
            awardedAmount = awardDecision?.FinalAwardedAmount ?? 0,
            decisionNumber = awardDecision?.CouncilDecisionNumber
        }, _correlationContext.CorrelationId));
    }
}

public class CreateTenderDto
{
    public string TenderNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ProjectId { get; set; }
    public string? TenderTypeCode { get; set; }
    public string? TenderMethodCode { get; set; }
    public string? CategoryCode { get; set; }
    public Guid? OrganizationUnitId { get; set; }
    public string? ResponsibleEngineer { get; set; }
    public decimal EstimatedValue { get; set; } = 0;
    public string? Currency { get; set; }
    public Guid? FinancialProgramId { get; set; }
    public Guid? BudgetItemId { get; set; }
    public Guid? FundingSourceId { get; set; }
    public DateTime? PublicationDate { get; set; }
    public DateTime? ClosingDate { get; set; }
    public DateTime? OpeningDate { get; set; }
    public string? Notes { get; set; }
}

public class UpdateTenderStatusDto
{
    public TenderLifecycleState NewStatus { get; set; }
}
