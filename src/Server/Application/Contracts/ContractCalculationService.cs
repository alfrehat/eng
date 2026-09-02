using System.Security.Cryptography;
using System.Text;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Application.Contracts;

public interface IContractCalculationService
{
    Task<Result<bool>> ValidateContractCreationPrerequisitesAsync(Guid projectId, Guid tenderId, Guid? awardDecisionId, CancellationToken cancellationToken = default);
    Task<Result<decimal>> RecalculateCurrentContractValueAsync(Guid contractId, CancellationToken cancellationToken = default);
    Task<Result<DateTime>> RecalculateCurrentCompletionDateAsync(Guid contractId, CancellationToken cancellationToken = default);
    string ComputeDocumentSha256(string content);
}

public class ContractCalculationService : IContractCalculationService
{
    private readonly IApplicationDbContext _context;

    public ContractCalculationService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> ValidateContractCreationPrerequisitesAsync(
        Guid projectId, 
        Guid tenderId, 
        Guid? awardDecisionId, 
        CancellationToken cancellationToken = default)
    {
        // 1. Verify Project exists
        var projectExists = await _context.Projects.AnyAsync(p => p.Id == projectId, cancellationToken);
        if (!projectExists)
            return Result<bool>.Failure(new Error("PROJECT_NOT_FOUND", "المشروع الهندسي المرتبط غير موجود"));

        // 2. Verify Tender exists and belongs to project
        var tender = await _context.Tenders.FirstOrDefaultAsync(t => t.Id == tenderId, cancellationToken);
        if (tender == null)
            return Result<bool>.Failure(new Error("TENDER_NOT_FOUND", "العطاء المرتبط غير موجود"));

        if (tender.ProjectId != projectId)
            return Result<bool>.Failure(new Error("PROJECT_MISMATCH", "العطاء غير مرتبط بالمشروع الهندسي المحدد"));

        // 3. Verify Award Decision exists and is Approved
        if (awardDecisionId.HasValue)
        {
            var awardDecision = await _context.AwardDecisions
                .FirstOrDefaultAsync(d => d.Id == awardDecisionId.Value && d.TenderId == tenderId, cancellationToken);

            if (awardDecision == null)
                return Result<bool>.Failure(new Error("AWARD_DECISION_NOT_FOUND", "قرار الإحالة المحدد غير موجود لهذا العطاء"));

            if (awardDecision.DecisionStatus != "APPROVED")
                return Result<bool>.Failure(new Error("AWARD_NOT_APPROVED", "قرار الإحالة غير معتمد رسمياً من المجلس البلدي"));
        }

        return Result<bool>.Success(true);
    }

    public async Task<Result<decimal>> RecalculateCurrentContractValueAsync(Guid contractId, CancellationToken cancellationToken = default)
    {
        var contract = await _context.Contracts
            .Include(c => c.Variations)
            .FirstOrDefaultAsync(c => c.Id == contractId, cancellationToken);

        if (contract == null)
            return Result<decimal>.Failure(new Error("NOT_FOUND", "العقد غير موجود"));

        var approvedVariationsTotal = contract.Variations
            .Where(v => v.Status == "APPROVED")
            .Sum(v => v.VariationAmount);

        contract.CurrentContractValue = contract.OriginalValue + approvedVariationsTotal;
        await _context.SaveChangesAsync(cancellationToken);

        return Result<decimal>.Success(contract.CurrentContractValue);
    }

    public async Task<Result<DateTime>> RecalculateCurrentCompletionDateAsync(Guid contractId, CancellationToken cancellationToken = default)
    {
        var contract = await _context.Contracts
            .Include(c => c.Extensions)
            .FirstOrDefaultAsync(c => c.Id == contractId, cancellationToken);

        if (contract == null)
            return Result<DateTime>.Failure(new Error("NOT_FOUND", "العقد غير موجود"));

        var approvedDays = contract.Extensions
            .Where(e => e.Status == "APPROVED")
            .Sum(e => e.ExtensionDays);

        contract.CurrentCompletionDate = contract.OriginalCompletionDate.AddDays(approvedDays);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<DateTime>.Success(contract.CurrentCompletionDate);
    }

    public string ComputeDocumentSha256(string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
