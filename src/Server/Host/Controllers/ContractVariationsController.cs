using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Contracts;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/contracts/{contractId}/[controller]")]
public class ContractVariationsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IContractCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ContractVariationsController> _logger;

    public ContractVariationsController(
        IApplicationDbContext context,
        IContractCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<ContractVariationsController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetVariations(Guid contractId)
    {
        var variations = await _context.ContractVariations
            .Where(v => v.ContractId == contractId)
            .OrderBy(v => v.CreatedAt)
            .AsNoTracking()
            .Select(v => new
            {
                v.Id,
                v.ContractId,
                v.VariationNumber,
                v.Reason,
                v.Description,
                v.VariationType,
                v.ContractItemId,
                v.OriginalQuantity,
                v.VariationQuantity,
                v.NewQuantity,
                v.OriginalUnitPrice,
                v.NewUnitPrice,
                v.VariationAmount,
                v.Justification,
                v.Status,
                v.ApprovalDate,
                v.ApprovedBy
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(variations, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateVariation(Guid contractId, [FromBody] CreateVariationDto dto)
    {
        var contract = await _context.Contracts.FindAsync(contractId);
        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المحدد غير موجود", _correlationContext.CorrelationId));

        var count = await _context.ContractVariations.CountAsync(v => v.ContractId == contractId);
        var varNumber = $"VO-{(count + 1):D2}";

        var variation = new ContractVariation
        {
            ContractId = contractId,
            VariationNumber = varNumber,
            Reason = dto.Reason.Trim(),
            Description = dto.Description?.Trim() ?? dto.Reason.Trim(),
            VariationType = dto.VariationType?.ToUpperInvariant() ?? "ADDITIONAL_WORKS",
            ContractItemId = dto.ContractItemId,
            OriginalQuantity = dto.OriginalQuantity,
            VariationQuantity = dto.VariationQuantity,
            NewQuantity = dto.OriginalQuantity + dto.VariationQuantity,
            OriginalUnitPrice = dto.OriginalUnitPrice,
            NewUnitPrice = dto.NewUnitPrice > 0 ? dto.NewUnitPrice : dto.OriginalUnitPrice,
            VariationAmount = dto.VariationAmount,
            Justification = dto.Justification?.Trim() ?? "ضرورة فنية للمشروع",
            RequestedBy = dto.RequestedBy ?? "مهندس المشروع",
            Status = "REQUESTED"
        };

        _context.ContractVariations.Add(variation);
        contract.ContractStatus = ContractWorkflowState.VariationRequested;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Variation order {VarNumber} created for Contract {ContractNumber}. Amount: {Amount}",
            varNumber, contract.ContractNumber, dto.VariationAmount);

        return Ok(ApiResponse<object>.Ok(new
        {
            variation.Id,
            variation.ContractId,
            variation.VariationNumber,
            variation.VariationAmount,
            variation.Status
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{variationId}/approve")]
    public async Task<IActionResult> ApproveVariation(Guid contractId, Guid variationId, [FromBody] ApproveVariationDto dto)
    {
        var variation = await _context.ContractVariations
            .FirstOrDefaultAsync(v => v.Id == variationId && v.ContractId == contractId);

        if (variation == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الأمر التغييري غير موجود", _correlationContext.CorrelationId));

        variation.Status = "APPROVED";
        variation.ApprovalDate = DateTime.UtcNow;
        variation.ApprovedBy = string.IsNullOrWhiteSpace(dto.ApprovedBy) ? "المجلس البلدي" : dto.ApprovedBy.Trim();

        // If variation is linked to a contract item, update item current values
        if (variation.ContractItemId.HasValue)
        {
            var item = await _context.ContractItems.FindAsync(variation.ContractItemId.Value);
            if (item != null)
            {
                item.CurrentQuantity = variation.NewQuantity;
                item.CurrentUnitPrice = variation.NewUnitPrice;
                item.ComputeAmounts();
            }
        }

        await _context.SaveChangesAsync();

        // Recalculate Contract CurrentContractValue while preserving OriginalValue
        var recalcResult = await _calcService.RecalculateCurrentContractValueAsync(contractId);

        var contract = await _context.Contracts.FindAsync(contractId);
        if (contract != null && contract.ContractStatus == ContractWorkflowState.VariationRequested)
        {
            contract.ContractStatus = ContractWorkflowState.Active;
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation("Variation approved for Contract {ContractId}. New CurrentContractValue: {NewValue}",
            contractId, recalcResult.Value);

        return Ok(ApiResponse<object>.Ok(new
        {
            variation.Id,
            variation.Status,
            variation.VariationAmount,
            originalValue = contract?.OriginalValue,
            currentContractValue = recalcResult.Value
        }, _correlationContext.CorrelationId));
    }
}

public class CreateVariationDto
{
    public string Reason { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? VariationType { get; set; }
    public Guid? ContractItemId { get; set; }
    public decimal OriginalQuantity { get; set; }
    public decimal VariationQuantity { get; set; }
    public decimal OriginalUnitPrice { get; set; }
    public decimal NewUnitPrice { get; set; }
    public decimal VariationAmount { get; set; }
    public string? Justification { get; set; }
    public string? RequestedBy { get; set; }
}

public class ApproveVariationDto
{
    public string? ApprovedBy { get; set; }
}
