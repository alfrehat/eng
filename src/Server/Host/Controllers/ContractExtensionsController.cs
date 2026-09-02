using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Contracts;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/contracts/{contractId}/[controller]")]
public class ContractExtensionsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IContractCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ContractExtensionsController> _logger;

    public ContractExtensionsController(
        IApplicationDbContext context,
        IContractCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<ContractExtensionsController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetExtensions(Guid contractId)
    {
        var extensions = await _context.ContractExtensions
            .Where(e => e.ContractId == contractId)
            .OrderBy(e => e.CreatedAt)
            .AsNoTracking()
            .Select(e => new
            {
                e.Id,
                e.ContractId,
                e.ExtensionNumber,
                e.PreviousCompletionDate,
                e.RequestedCompletionDate,
                e.ApprovedCompletionDate,
                e.ExtensionDays,
                e.Reason,
                e.Status,
                e.RequestDate,
                e.ApprovalDate,
                e.DecisionReference
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(extensions, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> RequestExtension(Guid contractId, [FromBody] RequestExtensionDto dto)
    {
        var contract = await _context.Contracts.FindAsync(contractId);
        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المحدد غير موجود", _correlationContext.CorrelationId));

        if (dto.ExtensionDays <= 0)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "عدد أيام التمديد يجب أن يكون أكبر من صفر", _correlationContext.CorrelationId));

        var count = await _context.ContractExtensions.CountAsync(e => e.ContractId == contractId);
        var extNumber = $"EXT-{(count + 1):D2}";

        var requestedDate = contract.CurrentCompletionDate.AddDays(dto.ExtensionDays);

        var extension = new ContractExtension
        {
            ContractId = contractId,
            ExtensionNumber = extNumber,
            PreviousCompletionDate = contract.CurrentCompletionDate,
            RequestedCompletionDate = requestedDate,
            ApprovedCompletionDate = requestedDate,
            ExtensionDays = dto.ExtensionDays,
            Reason = dto.Reason.Trim(),
            Status = "REQUESTED",
            RequestDate = DateTime.UtcNow
        };

        _context.ContractExtensions.Add(extension);
        contract.ContractStatus = ContractWorkflowState.ExtensionRequested;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Extension requested for Contract {ContractNumber}. Days: {Days}", contract.ContractNumber, dto.ExtensionDays);

        return Ok(ApiResponse<object>.Ok(new
        {
            extension.Id,
            extension.ContractId,
            extension.ExtensionNumber,
            extension.ExtensionDays,
            extension.PreviousCompletionDate,
            extension.RequestedCompletionDate,
            extension.Status
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{extensionId}/approve")]
    public async Task<IActionResult> ApproveExtension(Guid contractId, Guid extensionId, [FromBody] ApproveExtensionDto dto)
    {
        var extension = await _context.ContractExtensions
            .FirstOrDefaultAsync(e => e.Id == extensionId && e.ContractId == contractId);

        if (extension == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "طلب التمديد غير موجود", _correlationContext.CorrelationId));

        extension.Status = "APPROVED";
        extension.ApprovalDate = DateTime.UtcNow;
        extension.DecisionReference = dto.DecisionReference?.Trim();
        if (dto.ApprovedDays > 0)
        {
            extension.ExtensionDays = dto.ApprovedDays;
            extension.ApprovedCompletionDate = extension.PreviousCompletionDate.AddDays(dto.ApprovedDays);
        }

        await _context.SaveChangesAsync();

        // Recalculate Contract CurrentCompletionDate while preserving OriginalCompletionDate
        var recalcResult = await _calcService.RecalculateCurrentCompletionDateAsync(contractId);

        var contract = await _context.Contracts.FindAsync(contractId);
        if (contract != null && contract.ContractStatus == ContractWorkflowState.ExtensionRequested)
        {
            contract.ContractStatus = ContractWorkflowState.Active;
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation("Extension approved for Contract {ContractId}. New CurrentCompletionDate: {NewDate}",
            contractId, recalcResult.Value);

        return Ok(ApiResponse<object>.Ok(new
        {
            extension.Id,
            extension.Status,
            extension.ApprovedCompletionDate,
            extension.ExtensionDays,
            originalCompletionDate = contract?.OriginalCompletionDate,
            currentCompletionDate = recalcResult.Value
        }, _correlationContext.CorrelationId));
    }
}

public class RequestExtensionDto
{
    public int ExtensionDays { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class ApproveExtensionDto
{
    public int ApprovedDays { get; set; }
    public string? DecisionReference { get; set; }
}
