using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/contracts/{contractId}/[controller]")]
public class ContractMilestonesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public ContractMilestonesController(
        IApplicationDbContext context,
        CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetMilestones(Guid contractId)
    {
        var milestones = await _context.ContractMilestones
            .Where(m => m.ContractId == contractId)
            .OrderBy(m => m.PlannedDate)
            .AsNoTracking()
            .Select(m => new
            {
                m.Id,
                m.ContractId,
                m.Name,
                m.Description,
                m.MilestoneType,
                m.PlannedDate,
                m.ActualDate,
                m.Percentage,
                m.Status
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(milestones, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> AddMilestone(Guid contractId, [FromBody] CreateContractMilestoneDto dto)
    {
        var contract = await _context.Contracts.FindAsync(contractId);
        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المحدد غير موجود", _correlationContext.CorrelationId));

        var milestone = new ContractMilestone
        {
            ContractId = contractId,
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            MilestoneType = dto.MilestoneType?.ToUpperInvariant() ?? "TECHNICAL",
            PlannedDate = dto.PlannedDate ?? DateTime.UtcNow.AddDays(30),
            Percentage = dto.Percentage,
            Status = "PENDING"
        };

        _context.ContractMilestones.Add(milestone);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            milestone.Id,
            milestone.ContractId,
            milestone.Name,
            milestone.Percentage,
            milestone.Status
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{milestoneId}/status")]
    public async Task<IActionResult> UpdateStatus(Guid contractId, Guid milestoneId, [FromBody] UpdateMilestoneStatusDto dto)
    {
        var milestone = await _context.ContractMilestones
            .FirstOrDefaultAsync(m => m.Id == milestoneId && m.ContractId == contractId);

        if (milestone == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المعلم غير موجود", _correlationContext.CorrelationId));

        milestone.Status = dto.Status.ToUpperInvariant();
        if (milestone.Status == "ACHIEVED")
        {
            milestone.ActualDate = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok($"تم تحديث حالة المعلم إلى {dto.Status}", _correlationContext.CorrelationId));
    }
}

public class CreateContractMilestoneDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? MilestoneType { get; set; }
    public DateTime? PlannedDate { get; set; }
    public decimal Percentage { get; set; }
}

public class UpdateMilestoneStatusDto
{
    public string Status { get; set; } = "ACHIEVED";
}
