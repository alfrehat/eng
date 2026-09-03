using Knm.Enterprise.Application.Claims;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Claims;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClaimsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IClaimsCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ClaimsController> _logger;

    public ClaimsController(
        IApplicationDbContext context,
        IClaimsCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<ClaimsController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetClaims(
        [FromQuery] Guid? contractId,
        [FromQuery] Guid? projectId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _context.ContractClaims
            .Include(c => c.Contract)
                .ThenInclude(co => co.Project)
            .AsNoTracking()
            .AsQueryable();

        if (contractId.HasValue)
            query = query.Where(c => c.ContractId == contractId.Value);

        if (projectId.HasValue)
            query = query.Where(c => c.Contract.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ClaimWorkflowState>(status, true, out var parsedStatus))
            query = query.Where(c => c.Status == parsedStatus);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.ClaimNumber.ToLower().Contains(s) ||
                                     c.Contract.ContractNumber.ToLower().Contains(s) ||
                                     c.Contract.Title.ToLower().Contains(s));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.ClaimNumber,
                c.ContractId,
                ContractNumber = c.Contract.ContractNumber,
                ContractTitle = c.Contract.Title,
                ProjectId = c.Contract.ProjectId,
                ProjectName = c.Contract.Project.Name,
                c.ClaimTypeCode,
                c.ClaimPeriodFrom,
                c.ClaimPeriodTo,
                c.SubmissionDate,
                Status = c.Status.ToString(),
                c.GrossAmount,
                c.DeductionAmount,
                c.NetAmount,
                c.PreviousCertifiedAmount,
                c.CurrentCertifiedAmount,
                c.CumulativeCertifiedAmount,
                c.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { total, page, pageSize, items }, _correlationContext.CorrelationId));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetClaimById(Guid id)
    {
        var claim = await _context.ContractClaims
            .Include(c => c.Contract)
                .ThenInclude(co => co.Project)
            .Include(c => c.Contract)
                .ThenInclude(co => co.ContractorParty)
            .Include(c => c.Items)
                .ThenInclude(i => i.ContractItem)
            .Include(c => c.Measurements)
                .ThenInclude(m => m.Items)
            .Include(c => c.ProgressRecords)
            .Include(c => c.Certificates)
            .Include(c => c.Deductions)
            .Include(c => c.Adjustments)
            .Include(c => c.PaymentLinks)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        var result = new
        {
            claim.Id,
            claim.ClaimNumber,
            claim.ContractId,
            Contract = new
            {
                claim.Contract.Id,
                claim.Contract.ContractNumber,
                claim.Contract.Title,
                claim.Contract.OriginalValue,
                claim.Contract.CurrentContractValue,
                Project = new
                {
                    claim.Contract.Project.Id,
                    claim.Contract.Project.ProjectNumber,
                    claim.Contract.Project.Name
                },
                ContractorParty = claim.Contract.ContractorParty != null ? new
                {
                    claim.Contract.ContractorParty.Id,
                    claim.Contract.ContractorParty.Name
                } : null
            },
            claim.ClaimTypeCode,
            claim.ClaimPeriodFrom,
            claim.ClaimPeriodTo,
            claim.SubmissionDate,
            Status = claim.Status.ToString(),
            claim.GrossAmount,
            claim.DeductionAmount,
            claim.NetAmount,
            claim.PreviousCertifiedAmount,
            claim.CurrentCertifiedAmount,
            claim.CumulativeCertifiedAmount,
            claim.Notes,
            Items = claim.Items.Select(i => new
            {
                i.Id,
                i.ContractItemId,
                ContractItem = i.ContractItem != null ? new
                {
                    i.ContractItem.Id,
                    i.ContractItem.ItemCode,
                    i.ContractItem.Description,
                    i.ContractItem.Unit,
                    i.ContractItem.CurrentQuantity,
                    i.ContractItem.CurrentUnitPrice
                } : null,
                i.PreviousQuantity,
                i.CurrentQuantity,
                i.CumulativeQuantity,
                i.Unit,
                i.UnitPrice,
                i.CurrentAmount,
                i.CumulativeAmount,
                i.DisplayOrder
            }).ToList(),
            Measurements = claim.Measurements.Select(m => new
            {
                m.Id,
                m.MeasurementNumber,
                m.MeasurementDate,
                m.Location,
                m.Engineer,
                m.Status,
                m.Notes
            }).ToList(),
            ProgressRecords = claim.ProgressRecords.Select(p => new
            {
                p.Id,
                p.PeriodFrom,
                p.PeriodTo,
                p.PhysicalProgress,
                p.FinancialProgress,
                p.OverallProgress,
                p.Status
            }).ToList(),
            Certificates = claim.Certificates.Select(c => new
            {
                c.Id,
                c.CertificateNumber,
                c.CertificateDate,
                c.GrossCertified,
                c.PreviousCertified,
                c.CurrentCertified,
                c.CumulativeCertified,
                c.DeductionsTotal,
                c.NetCertified,
                c.Status,
                c.CertifiedBy,
                c.CertificationDate
            }).ToList(),
            Deductions = claim.Deductions.Select(d => new
            {
                d.Id,
                d.DeductionTypeCode,
                d.Description,
                d.Rate,
                d.Amount,
                d.IsApproved
            }).ToList(),
            Adjustments = claim.Adjustments.Select(a => new
            {
                a.Id,
                a.AdjustmentType,
                a.Description,
                a.Amount,
                a.Reason,
                a.IsApproved
            }).ToList(),
            PaymentLinks = claim.PaymentLinks.Select(pl => new
            {
                pl.Id,
                pl.Reference,
                pl.Amount,
                pl.PaymentStatus,
                pl.ReferredDate,
                pl.Notes
            }).ToList()
        };

        return Ok(ApiResponse<object>.Ok(result, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateClaim([FromBody] CreateClaimRequest request)
    {
        var prereq = await _calcService.ValidateClaimCreationPrerequisitesAsync(
            request.ContractId, request.ClaimPeriodFrom, request.ClaimPeriodTo);

        if (!prereq.IsSuccess)
            return BadRequest(ApiResponse<object>.Fail(prereq.Error.Code, prereq.Error.Message, _correlationContext.CorrelationId));

        var contract = await _context.Contracts.FindAsync(request.ContractId);
        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("CONTRACT_NOT_FOUND", "العقد غير موجود", _correlationContext.CorrelationId));

        var year = DateTime.UtcNow.Year;
        var seq = await _context.ContractClaims.CountAsync() + 1;
        var claimNumber = $"CLM-{year}-{seq:D4}";

        var claim = new ContractClaim
        {
            ClaimNumber = claimNumber,
            ContractId = request.ContractId,
            ClaimTypeCode = string.IsNullOrWhiteSpace(request.ClaimTypeCode) ? "INTERIM_PAYMENT" : request.ClaimTypeCode.Trim(),
            ClaimPeriodFrom = DateTime.SpecifyKind(request.ClaimPeriodFrom, DateTimeKind.Utc),
            ClaimPeriodTo = DateTime.SpecifyKind(request.ClaimPeriodTo, DateTimeKind.Utc),
            Status = ClaimWorkflowState.Draft,
            Notes = request.Notes
        };

        _context.ContractClaims.Add(claim);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Claim {ClaimNumber} created for Contract {ContractNumber}", claim.ClaimNumber, contract.ContractNumber);

        return Ok(ApiResponse<object>.Ok(new { claim.Id, claim.ClaimNumber, claim.Status }, _correlationContext.CorrelationId));
    }

    [HttpPost("{id}/items")]
    public async Task<IActionResult> AddClaimItem(Guid id, [FromBody] AddClaimItemRequest request)
    {
        var claim = await _context.ContractClaims
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        var val = await _calcService.ValidateClaimItemQuantitiesAsync(
            request.ContractItemId, request.CurrentQuantity, request.PreviousQuantity);

        if (!val.IsSuccess)
            return BadRequest(ApiResponse<object>.Fail(val.Error.Code, val.Error.Message, _correlationContext.CorrelationId));

        var contractItem = await _context.ContractItems.FindAsync(request.ContractItemId);
        if (contractItem == null)
            return NotFound(ApiResponse<object>.Fail("ITEM_NOT_FOUND", "بند العقد غير موجود", _correlationContext.CorrelationId));

        var item = new ClaimItem
        {
            ClaimId = claim.Id,
            ContractItemId = request.ContractItemId,
            PreviousQuantity = request.PreviousQuantity,
            CurrentQuantity = request.CurrentQuantity,
            Unit = contractItem.Unit,
            UnitPrice = request.UnitPrice > 0 ? request.UnitPrice : contractItem.CurrentUnitPrice,
            DisplayOrder = claim.Items.Count + 1
        };

        item.ComputeAmounts();
        _context.ClaimItems.Add(item);
        await _context.SaveChangesAsync();

        // Recalculate totals
        await _calcService.RecalculateClaimFinancialsAsync(claim.Id);

        return Ok(ApiResponse<object>.Ok(item, _correlationContext.CorrelationId));
    }

    [HttpPost("{id}/calculate")]
    public async Task<IActionResult> CalculateFinancials(
        Guid id, 
        [FromQuery] decimal retentionRate = 5, 
        [FromQuery] decimal advanceRecoveryRate = 0)
    {
        var res = await _calcService.RecalculateClaimFinancialsAsync(id, retentionRate, advanceRecoveryRate);
        if (!res.IsSuccess)
            return BadRequest(ApiResponse<object>.Fail(res.Error.Code, res.Error.Message, _correlationContext.CorrelationId));

        var c = res.Value;
        var dto = new
        {
            c.Id,
            c.ClaimNumber,
            c.GrossAmount,
            c.DeductionAmount,
            c.NetAmount,
            c.PreviousCertifiedAmount,
            c.CurrentCertifiedAmount,
            c.CumulativeCertifiedAmount,
            Deductions = c.Deductions.Select(d => new
            {
                d.Id,
                d.DeductionTypeCode,
                d.Description,
                d.Rate,
                d.Amount,
                d.IsApproved
            }).ToList()
        };

        return Ok(ApiResponse<object>.Ok(dto, _correlationContext.CorrelationId));
    }

    [HttpPost("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateClaimStatusRequest request)
    {
        var claim = await _context.ContractClaims.FindAsync(id);
        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        if (!Enum.TryParse<ClaimWorkflowState>(request.TargetStatus, true, out var target))
            return BadRequest(ApiResponse<object>.Fail("INVALID_STATUS", "الحالة المستهدفة غير صحيحة", _correlationContext.CorrelationId));

        // Enforce Workflow Rules: DRAFT cannot skip directly to PAID
        if (claim.Status == ClaimWorkflowState.Draft && target == ClaimWorkflowState.Paid)
            return BadRequest(ApiResponse<object>.Fail("INVALID_TRANSITION", "لا يمكن الانتقال من مسودة إلى مدفوع مباشرة", _correlationContext.CorrelationId));

        if (target == ClaimWorkflowState.Submitted)
            claim.SubmissionDate = DateTime.UtcNow;

        var prev = claim.Status;
        claim.Status = target;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Claim {ClaimNumber} transitioned from {Prev} to {Target}", claim.ClaimNumber, prev, target);

        return Ok(ApiResponse<object>.Ok(new { claim.Id, claim.ClaimNumber, Status = claim.Status.ToString() }, _correlationContext.CorrelationId));
    }

    [HttpGet("{id}/dashboard")]
    public async Task<IActionResult> GetClaimDashboard(Guid id)
    {
        var claim = await _context.ContractClaims
            .Include(c => c.Contract)
                .ThenInclude(co => co.Project)
            .Include(c => c.Certificates)
            .Include(c => c.Deductions)
            .Include(c => c.PaymentLinks)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        var contract = claim.Contract;

        var certTotal = await _context.ContractClaims
            .Where(c => c.ContractId == contract.Id && c.Status == ClaimWorkflowState.Certified)
            .SumAsync(c => c.CurrentCertifiedAmount);

        var paymentReferredTotal = await _context.ClaimPaymentLinks
            .Where(l => l.PaymentCertificate.ContractClaim.ContractId == contract.Id)
            .SumAsync(l => l.Amount);

        return Ok(ApiResponse<object>.Ok(new
        {
            claim.ClaimNumber,
            Status = claim.Status.ToString(),
            ContractNumber = contract.ContractNumber,
            ContractTitle = contract.Title,
            contract.OriginalValue,
            contract.CurrentContractValue,
            GrossClaim = claim.GrossAmount,
            TotalDeductions = claim.DeductionAmount,
            NetClaim = claim.NetAmount,
            ContractCumulativeCertified = certTotal,
            ContractRemainingValue = contract.CurrentContractValue - certTotal,
            PaymentReferredTotal = paymentReferredTotal,
            IsPaymentReferred = claim.PaymentLinks.Any(),
            IsPaid = claim.Status == ClaimWorkflowState.Paid
        }, _correlationContext.CorrelationId));
    }
}

public class CreateClaimRequest
{
    public Guid ContractId { get; set; }
    public string? ClaimTypeCode { get; set; } = "INTERIM_PAYMENT";
    public DateTime ClaimPeriodFrom { get; set; }
    public DateTime ClaimPeriodTo { get; set; }
    public string? Notes { get; set; }
}

public class AddClaimItemRequest
{
    public Guid ContractItemId { get; set; }
    public decimal PreviousQuantity { get; set; } = 0;
    public decimal CurrentQuantity { get; set; } = 0;
    public decimal UnitPrice { get; set; } = 0;
}

public class UpdateClaimStatusRequest
{
    public string TargetStatus { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
