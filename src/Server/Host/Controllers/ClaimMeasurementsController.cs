using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Claims;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/claims/{claimId}/measurements")]
[Route("api/claims/{claimId}/claimmeasurements")]
public class ClaimMeasurementsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ClaimMeasurementsController> _logger;

    public ClaimMeasurementsController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<ClaimMeasurementsController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetMeasurements(Guid claimId)
    {
        var records = await _context.MeasurementRecords
            .Include(m => m.Items)
                .ThenInclude(i => i.ContractItem)
            .Where(m => m.ClaimId == claimId)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(records, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateMeasurement(Guid claimId, [FromBody] CreateMeasurementRequest request)
    {
        var claim = await _context.ContractClaims.FindAsync(claimId);
        if (claim == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المستخلص غير موجود", _correlationContext.CorrelationId));

        var year = DateTime.UtcNow.Year;
        var seq = await _context.MeasurementRecords.CountAsync() + 1;
        var measNumber = $"MEAS-{year}-{seq:D4}";

        var record = new MeasurementRecord
        {
            MeasurementNumber = measNumber,
            ContractId = claim.ContractId,
            ClaimId = claim.Id,
            MeasurementDate = request.MeasurementDate.HasValue 
                ? DateTime.SpecifyKind(request.MeasurementDate.Value, DateTimeKind.Utc) 
                : DateTime.UtcNow,
            Location = request.Location.Trim(),
            Engineer = request.Engineer.Trim(),
            Status = "DRAFT",
            Notes = request.Notes
        };

        if (request.Items != null && request.Items.Any())
        {
            foreach (var item in request.Items)
            {
                record.Items.Add(new MeasurementItem
                {
                    ContractItemId = item.ContractItemId,
                    Description = item.Description.Trim(),
                    MeasuredQuantity = item.MeasuredQuantity,
                    Unit = item.Unit ?? "م2",
                    MeasurementDate = record.MeasurementDate,
                    Reference = item.Reference
                });
            }
        }

        _context.MeasurementRecords.Add(record);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Measurement Record {MeasNumber} created for Claim {ClaimId}", record.MeasurementNumber, claimId);

        return Ok(ApiResponse<object>.Ok(record, _correlationContext.CorrelationId));
    }

    [HttpPost("{measurementId}/approve")]
    public async Task<IActionResult> ApproveMeasurement(Guid claimId, Guid measurementId)
    {
        var record = await _context.MeasurementRecords
            .Include(m => m.Items)
            .FirstOrDefaultAsync(m => m.Id == measurementId && m.ClaimId == claimId);

        if (record == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "دفتر القياس غير موجود", _correlationContext.CorrelationId));

        record.Status = "APPROVED";
        await _context.SaveChangesAsync();

        _logger.LogInformation("Measurement Record {MeasNumber} approved", record.MeasurementNumber);

        return Ok(ApiResponse<object>.Ok(new { record.Id, record.MeasurementNumber, record.Status }, _correlationContext.CorrelationId));
    }
}

public class CreateMeasurementRequest
{
    public string Location { get; set; } = string.Empty;
    public string Engineer { get; set; } = string.Empty;
    public DateTime? MeasurementDate { get; set; }
    public string? Notes { get; set; }
    public List<CreateMeasurementItemDto>? Items { get; set; }
}

public class CreateMeasurementItemDto
{
    public Guid ContractItemId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal MeasuredQuantity { get; set; }
    public string? Unit { get; set; }
    public string? Reference { get; set; }
}
