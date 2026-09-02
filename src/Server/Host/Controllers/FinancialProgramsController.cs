using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/financial-programs")]
public class FinancialProgramsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;

    public FinancialProgramsController(IApplicationDbContext context, CorrelationContext correlationContext)
    {
        _context = context;
        _correlationContext = correlationContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetPrograms()
    {
        var programs = await _context.FinancialPrograms
            .Include(fp => fp.Chapters)
                .ThenInclude(c => c.Items)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<FinancialProgram>>.Ok(programs, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateProgram([FromBody] CreateFinancialProgramDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز واسم البرنامج المالي مطلوبان", _correlationContext.CorrelationId));

        var program = new FinancialProgram
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            FiscalYear = dto.FiscalYear > 0 ? dto.FiscalYear : DateTime.UtcNow.Year,
            TotalBudget = dto.TotalBudget
        };

        if (dto.Chapters != null)
        {
            foreach (var ch in dto.Chapters)
            {
                var chapter = new BudgetChapter
                {
                    Code = ch.Code,
                    Name = ch.Name
                };
                if (ch.Items != null)
                {
                    foreach (var it in ch.Items)
                    {
                        chapter.Items.Add(new BudgetItem
                        {
                            Code = it.Code,
                            Name = it.Name,
                            AllocatedAmount = it.AllocatedAmount
                        });
                    }
                }
                program.Chapters.Add(chapter);
            }
        }

        _context.FinancialPrograms.Add(program);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<FinancialProgram>.Ok(program, _correlationContext.CorrelationId));
    }

    [HttpGet("funding-sources")]
    public async Task<IActionResult> GetFundingSources()
    {
        var sources = await _context.FundingSources.AsNoTracking().ToListAsync();
        return Ok(ApiResponse<IEnumerable<FundingSource>>.Ok(sources, _correlationContext.CorrelationId));
    }

    [HttpPost("funding-sources")]
    public async Task<IActionResult> CreateFundingSource([FromBody] CreateFundingSourceDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز واسم مصدر التمويل مطلوبان", _correlationContext.CorrelationId));

        var source = new FundingSource
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            OrganizationName = dto.OrganizationName
        };

        _context.FundingSources.Add(source);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<FundingSource>.Ok(source, _correlationContext.CorrelationId));
    }

    [HttpPost("projects/{projectId}/allocations")]
    public async Task<IActionResult> AddAllocation(Guid projectId, [FromBody] CreateProjectAllocationDto dto)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المحدد غير موجود", _correlationContext.CorrelationId));

        var allocation = new ProjectAllocation
        {
            ProjectId = projectId,
            BudgetItemId = dto.BudgetItemId,
            FundingSourceId = dto.FundingSourceId,
            FiscalYear = dto.FiscalYear > 0 ? dto.FiscalYear : DateTime.UtcNow.Year,
            AllocatedAmount = dto.AllocatedAmount,
            CommittedAmount = dto.CommittedAmount,
            Notes = dto.Notes
        };

        _context.ProjectAllocations.Add(allocation);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            allocation.Id,
            allocation.ProjectId,
            allocation.FiscalYear,
            allocation.AllocatedAmount,
            allocation.CommittedAmount,
            allocation.Notes
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("projects/{projectId}/expenditures")]
    public async Task<IActionResult> AddExpenditure(Guid projectId, [FromBody] CreateProjectExpenditureDto dto)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "المشروع المحدد غير موجود", _correlationContext.CorrelationId));

        var expenditure = new ProjectExpenditure
        {
            ProjectId = projectId,
            ProjectAllocationId = dto.ProjectAllocationId,
            DisbursementDate = dto.DisbursementDate ?? DateTime.UtcNow,
            Amount = dto.Amount,
            VoucherNumber = dto.VoucherNumber,
            Payee = dto.Payee,
            Description = dto.Description
        };

        _context.ProjectExpenditures.Add(expenditure);

        // Automatically update actual expenditure on project
        project.ActualExpenditure += dto.Amount;

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            expenditure.Id,
            expenditure.ProjectId,
            expenditure.Amount,
            expenditure.VoucherNumber,
            expenditure.Payee,
            expenditure.DisbursementDate
        }, _correlationContext.CorrelationId));
    }
}

public class CreateFinancialProgramDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    public decimal TotalBudget { get; set; } = 0;
    public List<CreateBudgetChapterDto>? Chapters { get; set; }
}

public class CreateBudgetChapterDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<CreateBudgetItemDto>? Items { get; set; }
}

public class CreateBudgetItemDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal AllocatedAmount { get; set; } = 0;
}

public class CreateFundingSourceDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? OrganizationName { get; set; }
}

public class CreateProjectAllocationDto
{
    public Guid? BudgetItemId { get; set; }
    public Guid? FundingSourceId { get; set; }
    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    public decimal AllocatedAmount { get; set; } = 0;
    public decimal CommittedAmount { get; set; } = 0;
    public string? Notes { get; set; }
}

public class CreateProjectExpenditureDto
{
    public Guid? ProjectAllocationId { get; set; }
    public DateTime? DisbursementDate { get; set; }
    public decimal Amount { get; set; } = 0;
    public string VoucherNumber { get; set; } = string.Empty;
    public string? Payee { get; set; }
    public string? Description { get; set; }
}
