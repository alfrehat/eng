using Knm.Enterprise.Application.Claims;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Claims;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/claims/{claimId}/certificate")]
[Route("api/claims/{claimId}/certificates")]
public class ClaimCertificatesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IClaimsCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ClaimCertificatesController> _logger;

    public ClaimCertificatesController(
        IApplicationDbContext context,
        IClaimsCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<ClaimCertificatesController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetCertificate(Guid claimId)
    {
        var cert = await _context.PaymentCertificates
            .Include(c => c.Deductions)
            .Include(c => c.RetentionRecords)
            .Include(c => c.AdvanceRecoveries)
            .Include(c => c.PaymentLinks)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ContractClaimId == claimId);

        if (cert == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "شهادة الدفع غير متوفرة لهذا المستخلص بعد", _correlationContext.CorrelationId));

        return Ok(ApiResponse<object>.Ok(cert, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> IssueCertificate(Guid claimId, [FromBody] IssueCertificateRequest request)
    {
        var claim = await _context.ContractClaims
            .Include(c => c.Contract)
            .FirstOrDefaultAsync(c => c.Id == claimId);

        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        var res = await _calcService.GenerateOrUpdatePaymentCertificateAsync(claimId, request.CertifiedBy);
        if (!res.IsSuccess)
            return BadRequest(ApiResponse<object>.Fail(res.Error.Code, res.Error.Message, _correlationContext.CorrelationId));

        var c = res.Value;
        return Ok(ApiResponse<object>.Ok(new
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
        }, _correlationContext.CorrelationId));
    }
}

public class IssueCertificateRequest
{
    public string? CertifiedBy { get; set; } = "رئيس قسم المشاريع ومديرية الأشغال الهندسية";
    public string? Notes { get; set; }
}
