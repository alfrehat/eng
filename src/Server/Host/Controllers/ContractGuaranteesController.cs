using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/contracts/{contractId}/[controller]")]
public class ContractGuaranteesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ContractGuaranteesController> _logger;

    public ContractGuaranteesController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<ContractGuaranteesController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetGuarantees(Guid contractId)
    {
        var guarantees = await _context.ContractGuarantees
            .Where(g => g.ContractId == contractId)
            .OrderBy(g => g.CreatedAt)
            .AsNoTracking()
            .Select(g => new
            {
                g.Id,
                g.ContractId,
                g.GuaranteeType,
                g.ReferenceNumber,
                g.BankName,
                g.Amount,
                g.Currency,
                g.IssueDate,
                g.ExpiryDate,
                g.Status,
                g.Notes
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(guarantees, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> AddGuarantee(Guid contractId, [FromBody] CreateContractGuaranteeDto dto)
    {
        var contract = await _context.Contracts.FindAsync(contractId);
        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المحدد غير موجود", _correlationContext.CorrelationId));

        if (dto.Amount <= 0)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "مبلغ الكفالة يجب أن يكون أكبر من صفر", _correlationContext.CorrelationId));

        var guarantee = new ContractGuarantee
        {
            ContractId = contractId,
            GuaranteeType = dto.GuaranteeType?.ToUpperInvariant() ?? "PERFORMANCE_BOND",
            ReferenceNumber = dto.ReferenceNumber.Trim(),
            BankName = dto.BankName.Trim(),
            Amount = dto.Amount,
            Currency = dto.Currency ?? "JOD",
            IssueDate = dto.IssueDate ?? DateTime.UtcNow,
            ExpiryDate = dto.ExpiryDate ?? DateTime.UtcNow.AddDays(180),
            Status = "ACTIVE",
            Notes = dto.Notes
        };

        _context.ContractGuarantees.Add(guarantee);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Guarantee {Ref} added to Contract {ContractNumber}", dto.ReferenceNumber, contract.ContractNumber);

        return Ok(ApiResponse<object>.Ok(new
        {
            guarantee.Id,
            guarantee.ContractId,
            guarantee.GuaranteeType,
            guarantee.ReferenceNumber,
            guarantee.Amount,
            guarantee.Status
        }, _correlationContext.CorrelationId));
    }
}

public class CreateContractGuaranteeDto
{
    public string? GuaranteeType { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public DateTime? IssueDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? Notes { get; set; }
}
