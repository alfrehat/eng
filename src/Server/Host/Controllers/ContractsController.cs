using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Contracts;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContractsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IContractCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ContractsController> _logger;

    public ContractsController(
        IApplicationDbContext context,
        IContractCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<ContractsController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetContracts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null,
        [FromQuery] ContractWorkflowState? status = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? tenderId = null,
        [FromQuery] string? contractType = null)
    {
        var query = _context.Contracts
            .Include(c => c.Project)
            .Include(c => c.Tender)
            .Include(c => c.ContractorParty)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => EF.Functions.ILike(c.Title, $"%{search}%") ||
                                     EF.Functions.ILike(c.ContractNumber, $"%{search}%"));
        }

        if (status.HasValue)
        {
            query = query.Where(c => c.ContractStatus == status.Value);
        }

        if (projectId.HasValue)
        {
            query = query.Where(c => c.ProjectId == projectId.Value);
        }

        if (tenderId.HasValue)
        {
            query = query.Where(c => c.TenderId == tenderId.Value);
        }

        if (!string.IsNullOrWhiteSpace(contractType))
        {
            query = query.Where(c => c.ContractTypeCode == contractType.ToUpperInvariant());
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.ContractNumber,
                c.Title,
                c.ProjectId,
                ProjectNumber = c.Project.ProjectNumber,
                ProjectName = c.Project.Name,
                c.TenderId,
                TenderNumber = c.Tender.TenderNumber,
                c.ContractorPartyId,
                ContractorName = c.ContractorParty != null ? c.ContractorParty.Name : null,
                c.ContractTypeCode,
                c.ContractStatus,
                StatusName = c.ContractStatus.ToString(),
                c.OriginalValue,
                c.CurrentContractValue,
                c.Currency,
                c.ContractDate,
                c.StartDate,
                c.OriginalCompletionDate,
                c.CurrentCompletionDate,
                VariationsCount = c.Variations.Count,
                ExtensionsCount = c.Extensions.Count
            })
            .ToListAsync();

        var paged = new PagedResult<object>(items, totalCount, page, pageSize);
        return Ok(ApiResponse<PagedResult<object>>.Ok(paged, _correlationContext.CorrelationId));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetContractById(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.Project)
            .Include(c => c.Tender)
            .Include(c => c.AwardRecommendation)
            .Include(c => c.AwardDecision)
            .Include(c => c.ContractorParty)
            .Include(c => c.PartyRoles)
                .ThenInclude(pr => pr.ContractParty)
            .Include(c => c.Boqs)
                .ThenInclude(b => b.Items.OrderBy(i => i.DisplayOrder))
            .Include(c => c.Guarantees)
            .Include(c => c.Extensions)
            .Include(c => c.Variations)
            .Include(c => c.Milestones)
            .Include(c => c.Notices)
            .Include(c => c.Signatures)
            .Include(c => c.PaymentLinks)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المطلوب غير موجود", _correlationContext.CorrelationId));

        var result = new
        {
            contract.Id,
            contract.ContractNumber,
            contract.Title,
            contract.Description,
            contract.ProjectId,
            Project = new
            {
                contract.Project.Id,
                contract.Project.ProjectNumber,
                contract.Project.Name,
                contract.Project.Status,
                contract.Project.EstimatedCost,
                contract.Project.ContractValue
            },
            contract.TenderId,
            Tender = new
            {
                contract.Tender.Id,
                contract.Tender.TenderNumber,
                contract.Tender.Title,
                contract.Tender.Status,
                contract.Tender.EstimatedValue
            },
            AwardRecommendation = contract.AwardRecommendation != null ? new
            {
                contract.AwardRecommendation.Id,
                contract.AwardRecommendation.RecommendedAmount,
                contract.AwardRecommendation.RecommendationDate,
                contract.AwardRecommendation.Status
            } : null,
            AwardDecision = contract.AwardDecision != null ? new
            {
                contract.AwardDecision.Id,
                contract.AwardDecision.CouncilDecisionNumber,
                contract.AwardDecision.DecisionDate,
                contract.AwardDecision.DecisionStatus,
                contract.AwardDecision.FinalAwardedAmount
            } : null,
            Contractor = contract.ContractorParty != null ? new
            {
                contract.ContractorParty.Id,
                contract.ContractorParty.Name,
                contract.ContractorParty.RegistrationNumber,
                contract.ContractorParty.Phone,
                contract.ContractorParty.ContactPerson
            } : null,
            contract.ContractTypeCode,
            contract.ContractStatus,
            StatusName = contract.ContractStatus.ToString(),
            contract.ContractDate,
            contract.NoticeToProceedDate,
            contract.CommencementDate,
            contract.OriginalCompletionDate,
            contract.CurrentCompletionDate,
            contract.OriginalValue,
            contract.TaxAmount,
            contract.TotalValue,
            contract.CurrentContractValue,
            contract.Currency,
            contract.ProcurementReference,
            contract.ExternalReference,
            contract.Notes,
            Boqs = contract.Boqs.Select(b => new
            {
                b.Id,
                b.Title,
                b.OriginalSubTotal,
                b.CurrentSubTotal,
                b.TaxRatePercent,
                b.TaxAmount,
                b.GrandTotal,
                Items = b.Items.Select(i => new
                {
                    i.Id,
                    i.ItemCode,
                    i.Description,
                    i.Unit,
                    i.OriginalQuantity,
                    i.OriginalUnitPrice,
                    i.OriginalAmount,
                    i.CurrentQuantity,
                    i.CurrentUnitPrice,
                    i.CurrentAmount
                })
            }),
            Guarantees = contract.Guarantees.Select(g => new
            {
                g.Id,
                g.GuaranteeType,
                g.ReferenceNumber,
                g.BankName,
                g.Amount,
                g.Currency,
                g.IssueDate,
                g.ExpiryDate,
                g.Status
            }),
            Extensions = contract.Extensions.Select(e => new
            {
                e.Id,
                e.ExtensionNumber,
                e.PreviousCompletionDate,
                e.ApprovedCompletionDate,
                e.ExtensionDays,
                e.Reason,
                e.Status,
                e.ApprovalDate
            }),
            Variations = contract.Variations.Select(v => new
            {
                v.Id,
                v.VariationNumber,
                v.Reason,
                v.VariationType,
                v.VariationAmount,
                v.Status,
                v.ApprovalDate
            }),
            Milestones = contract.Milestones.Select(m => new
            {
                m.Id,
                m.Name,
                m.MilestoneType,
                m.PlannedDate,
                m.Percentage,
                m.Status
            }),
            Notices = contract.Notices.Select(n => new
            {
                n.Id,
                n.NoticeType,
                n.ReferenceNumber,
                n.NoticeDate,
                n.Subject,
                n.Status
            }),
            Signatures = contract.Signatures.Select(s => new
            {
                s.Id,
                s.SignerName,
                s.SignerRole,
                s.SignatureDate,
                s.SignatureStatus,
                s.HashAlgorithm,
                s.DocumentHash
            }),
            PaymentLinks = contract.PaymentLinks.Select(p => new
            {
                p.Id,
                p.ReferenceType,
                p.PaymentClaimReference,
                p.Amount,
                p.Status
            })
        };

        return Ok(ApiResponse<object>.Ok(result, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> CreateContract([FromBody] CreateContractDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "عنوان العقد مطلوب", _correlationContext.CorrelationId));

        // 1. Mandatory Chain Validation: Project, Tender, Award Decision
        var validation = await _calcService.ValidateContractCreationPrerequisitesAsync(
            dto.ProjectId, 
            dto.TenderId, 
            dto.AwardDecisionId);

        if (!validation.IsSuccess)
        {
            return BadRequest(ApiResponse<object>.Fail(validation.Error.Code, validation.Error.Message, _correlationContext.CorrelationId));
        }

        // 2. Generate Contract Number via Numbering Engine (e.g. CON-2026-0001)
        string contractNumber = dto.ContractNumber;
        if (string.IsNullOrWhiteSpace(contractNumber))
        {
            var numberingDef = await _context.NumberingDefinitions
                .FirstOrDefaultAsync(n => n.Code == "CONTRACT_SEQ" || n.Code == "CON_SEQ");

            if (numberingDef != null)
            {
                contractNumber = numberingDef.GenerateNextFormatted();
            }
            else
            {
                var year = DateTime.UtcNow.Year;
                var count = await _context.Contracts.CountAsync();
                contractNumber = $"CON-{year}-{(count + 1):D4}";
            }
        }

        // 3. Resolve Contractor Party (from Bidder if ContractorPartyId is null)
        Guid? contractorPartyId = dto.ContractorPartyId;
        if (!contractorPartyId.HasValue && dto.BidderId.HasValue)
        {
            var party = await _context.ContractParties
                .FirstOrDefaultAsync(cp => cp.BidderId == dto.BidderId.Value);

            if (party == null)
            {
                var bidder = await _context.Bidders.FindAsync(dto.BidderId.Value);
                if (bidder != null)
                {
                    party = new ContractParty
                    {
                        PartyType = "COMPANY",
                        Name = bidder.Name,
                        RegistrationNumber = bidder.CommercialRegisterNumber,
                        Phone = bidder.Phone,
                        Email = bidder.Email,
                        Address = bidder.Address,
                        ContactPerson = bidder.ContactPerson,
                        BidderId = bidder.Id
                    };
                    _context.ContractParties.Add(party);
                    await _context.SaveChangesAsync();
                }
            }

            if (party != null) contractorPartyId = party.Id;
        }

        var startDate = dto.StartDate ?? DateTime.UtcNow.Date;
        var durationDays = dto.DurationDays > 0 ? dto.DurationDays : 60;
        var completionDate = dto.OriginalCompletionDate ?? startDate.AddDays(durationDays);

        var originalValue = dto.OriginalValue;
        var taxAmount = Math.Round(originalValue * (dto.TaxRatePercent / 100m), 3);
        var totalValue = originalValue + taxAmount;

        var contract = new Contract
        {
            ContractNumber = contractNumber,
            Title = dto.Title.Trim(),
            Description = dto.Description,
            ProjectId = dto.ProjectId,
            TenderId = dto.TenderId,
            AwardRecommendationId = dto.AwardRecommendationId,
            AwardDecisionId = dto.AwardDecisionId,
            ContractorPartyId = contractorPartyId,
            ContractTypeCode = dto.ContractTypeCode?.ToUpperInvariant() ?? "WORKS",
            ContractStatus = ContractWorkflowState.Draft,
            ContractDate = dto.ContractDate ?? DateTime.UtcNow.Date,
            StartDate = startDate,
            OriginalCompletionDate = completionDate,
            CurrentCompletionDate = completionDate,
            OriginalValue = originalValue,
            TaxAmount = taxAmount,
            TotalValue = totalValue,
            CurrentContractValue = totalValue,
            Currency = dto.Currency ?? "JOD",
            ProcurementReference = dto.ProcurementReference,
            ExternalReference = dto.ExternalReference,
            Notes = dto.Notes
        };

        _context.Contracts.Add(contract);

        // 4. Create Controlled Snapshot of Tender BOQ if available
        var tenderBoq = await _context.TenderBoqs
            .Include(tb => tb.Items)
            .FirstOrDefaultAsync(tb => tb.TenderId == dto.TenderId);

        if (tenderBoq != null && tenderBoq.Items.Any())
        {
            var contractBoq = new ContractBoq
            {
                ContractId = contract.Id,
                Title = $"جدول كميات العقد الأساسي (لقطة معتمدة من العطاء {dto.TenderId})",
                OriginalSubTotal = tenderBoq.SubTotal,
                CurrentSubTotal = tenderBoq.SubTotal,
                TaxRatePercent = tenderBoq.TaxRatePercent,
                TaxAmount = tenderBoq.TaxAmount,
                GrandTotal = tenderBoq.GrandTotal
            };

            foreach (var tItem in tenderBoq.Items)
            {
                var cItem = new ContractItem
                {
                    ContractBoqId = contractBoq.Id,
                    ItemCode = $"ITM-{tItem.ItemNumber:D2}",
                    Description = tItem.Description,
                    Unit = tItem.Unit,
                    OriginalQuantity = tItem.Quantity,
                    OriginalUnitPrice = tItem.EstimatedUnitPrice,
                    OriginalAmount = tItem.EstimatedTotal,
                    CurrentQuantity = tItem.Quantity,
                    CurrentUnitPrice = tItem.EstimatedUnitPrice,
                    CurrentAmount = tItem.EstimatedTotal,
                    DisplayOrder = tItem.ItemNumber
                };
                contractBoq.Items.Add(cItem);
            }

            contract.Boqs.Add(contractBoq);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Contract created successfully. Number: {ContractNumber}, ID: {ContractId}",
            contract.ContractNumber, contract.Id);

        return Ok(ApiResponse<object>.Ok(new
        {
            contract.Id,
            contract.ContractNumber,
            contract.Title,
            contract.ProjectId,
            contract.TenderId,
            contract.OriginalValue,
            contract.TotalValue,
            contract.CurrentContractValue,
            contract.ContractStatus,
            StatusName = contract.ContractStatus.ToString()
        }, _correlationContext.CorrelationId));
    }

    [HttpPost("{id}/status")]
    public async Task<IActionResult> TransitionStatus(Guid id, [FromBody] UpdateContractStatusDto dto)
    {
        var contract = await _context.Contracts.FindAsync(id);
        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المطلوب غير موجود", _correlationContext.CorrelationId));

        var oldStatus = contract.ContractStatus;
        contract.ContractStatus = dto.NewStatus;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Contract {ContractNumber} transitioned from {Old} to {New}", contract.ContractNumber, oldStatus, dto.NewStatus);

        return Ok(ApiResponse<string>.Ok($"تم تغيير حالة العقد إلى: {dto.NewStatus}", _correlationContext.CorrelationId));
    }

    [HttpGet("{id}/dashboard")]
    public async Task<IActionResult> GetContractDashboard(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.Project)
            .Include(c => c.Tender)
            .Include(c => c.ContractorParty)
            .Include(c => c.Guarantees)
            .Include(c => c.Extensions)
            .Include(c => c.Variations)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المطلوب غير موجود", _correlationContext.CorrelationId));

        var activeGuaranteesCount = contract.Guarantees.Count(g => g.Status == "ACTIVE");
        var approvedExtensionsDays = contract.Extensions.Where(e => e.Status == "APPROVED").Sum(e => e.ExtensionDays);
        var approvedVariationsTotal = contract.Variations.Where(v => v.Status == "APPROVED").Sum(v => v.VariationAmount);

        var daysRemaining = Math.Max(0, (contract.CurrentCompletionDate.Date - DateTime.UtcNow.Date).Days);
        var contractStart = contract.StartDate?.Date ?? contract.ContractDate.Date;
        var totalDays = Math.Max(1, (contract.CurrentCompletionDate.Date - contractStart).Days);
        var elapsedDays = Math.Max(0, (DateTime.UtcNow.Date - contractStart).Days);
        var timeProgressPercent = Math.Min(100, Math.Round((decimal)elapsedDays / totalDays * 100, 1));

        return Ok(ApiResponse<object>.Ok(new
        {
            contractId = contract.Id,
            contractNumber = contract.ContractNumber,
            title = contract.Title,
            projectNumber = contract.Project.ProjectNumber,
            projectName = contract.Project.Name,
            tenderNumber = contract.Tender.TenderNumber,
            contractorName = contract.ContractorParty?.Name ?? "غير محدد",
            status = contract.ContractStatus.ToString(),
            originalValue = contract.OriginalValue,
            currentContractValue = contract.CurrentContractValue,
            currency = contract.Currency,
            approvedVariationsTotal,
            startDate = contract.StartDate,
            originalCompletionDate = contract.OriginalCompletionDate,
            currentCompletionDate = contract.CurrentCompletionDate,
            approvedExtensionsDays,
            daysRemaining,
            timeProgressPercent,
            activeGuaranteesCount
        }, _correlationContext.CorrelationId));
    }
}

public class CreateContractDto
{
    public string ContractNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ProjectId { get; set; }
    public Guid TenderId { get; set; }
    public Guid? AwardRecommendationId { get; set; }
    public Guid? AwardDecisionId { get; set; }
    public Guid? ContractorPartyId { get; set; }
    public Guid? BidderId { get; set; }
    public string? ContractTypeCode { get; set; }
    public decimal OriginalValue { get; set; } = 0;
    public decimal TaxRatePercent { get; set; } = 16;
    public string? Currency { get; set; }
    public DateTime? ContractDate { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? OriginalCompletionDate { get; set; }
    public int DurationDays { get; set; } = 60;
    public string? ProcurementReference { get; set; }
    public string? ExternalReference { get; set; }
    public string? Notes { get; set; }
}

public class UpdateContractStatusDto
{
    public ContractWorkflowState NewStatus { get; set; }
}
