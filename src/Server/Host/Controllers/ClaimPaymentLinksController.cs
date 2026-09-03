using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Claims;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/claims/{claimId}/payment-link")]
public class ClaimPaymentLinksController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ClaimPaymentLinksController> _logger;

    public ClaimPaymentLinksController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<ClaimPaymentLinksController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetPaymentLinks(Guid claimId)
    {
        var links = await _context.ClaimPaymentLinks
            .Include(l => l.PaymentCertificate)
            .Where(l => l.PaymentCertificate.ContractClaimId == claimId)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(links, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreatePaymentLink(Guid claimId, [FromBody] CreateClaimPaymentLinkRequest request)
    {
        var claim = await _context.ContractClaims
            .Include(c => c.Certificates)
            .Include(c => c.Contract)
            .FirstOrDefaultAsync(c => c.Id == claimId);

        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        var cert = claim.Certificates.FirstOrDefault();
        if (cert == null)
            return BadRequest(ApiResponse<object>.Fail("CERTIFICATE_REQUIRED", "يجب إصدار شهادة دفع معتمدة أولاً قبل الربط بالبرنامج المالي", _correlationContext.CorrelationId));

        var link = new ClaimPaymentLink
        {
            PaymentCertificateId = cert.Id,
            FinancialProgramId = request.FinancialProgramId,
            ProjectId = claim.Contract.ProjectId,
            BudgetItemId = request.BudgetItemId,
            FundingSourceId = request.FundingSourceId,
            Amount = request.Amount > 0 ? request.Amount : cert.NetCertified,
            Reference = string.IsNullOrWhiteSpace(request.Reference) ? $"REF-FIN-{DateTime.UtcNow.Year}-{(await _context.ClaimPaymentLinks.CountAsync() + 1):D4}" : request.Reference.Trim(),
            PaymentStatus = "REFERRED", // Crucial rule: REFERRED, NOT PAID!
            ReferredDate = DateTime.UtcNow,
            Notes = request.Notes
        };

        _context.ClaimPaymentLinks.Add(link);
        
        // Update claim workflow status to PaymentReferred
        claim.Status = ClaimWorkflowState.PaymentReferred;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Claim {ClaimNumber} referred for payment via Link {Reference}. Amount: {Amount}", 
            claim.ClaimNumber, link.Reference, link.Amount);

        return Ok(ApiResponse<object>.Ok(new
        {
            link.Id,
            link.Reference,
            link.Amount,
            link.PaymentStatus,
            ClaimStatus = claim.Status.ToString(),
            IsPaid = false // Explicitly proven false
        }, _correlationContext.CorrelationId));
    }
}

public class CreateClaimPaymentLinkRequest
{
    public Guid? FinancialProgramId { get; set; }
    public Guid? BudgetItemId { get; set; }
    public Guid? FundingSourceId { get; set; }
    public decimal Amount { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
}
