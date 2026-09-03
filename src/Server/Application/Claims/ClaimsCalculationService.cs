using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Claims;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Application.Claims;

public interface IClaimsCalculationService
{
    Task<Result<bool>> ValidateClaimCreationPrerequisitesAsync(
        Guid contractId, 
        DateTime periodFrom, 
        DateTime periodTo, 
        CancellationToken cancellationToken = default);

    Task<Result<bool>> ValidateClaimItemQuantitiesAsync(
        Guid contractItemId, 
        decimal currentQuantity, 
        decimal previousQuantity, 
        CancellationToken cancellationToken = default);

    Task<Result<ContractClaim>> RecalculateClaimFinancialsAsync(
        Guid claimId, 
        decimal retentionRate = 5, 
        decimal advanceRecoveryRate = 0, 
        CancellationToken cancellationToken = default);

    Task<Result<PaymentCertificate>> GenerateOrUpdatePaymentCertificateAsync(
        Guid claimId, 
        string? certifiedBy = null, 
        CancellationToken cancellationToken = default);
}

public class ClaimsCalculationService : IClaimsCalculationService
{
    private readonly IApplicationDbContext _context;

    public ClaimsCalculationService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> ValidateClaimCreationPrerequisitesAsync(
        Guid contractId, 
        DateTime periodFrom, 
        DateTime periodTo, 
        CancellationToken cancellationToken = default)
    {
        if (periodTo < periodFrom)
            return Result<bool>.Failure(new Error("INVALID_PERIOD", "تاريخ نهاية فترة المستخلص يجب ألا يسبق تاريخ البداية"));

        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == contractId, cancellationToken);
        if (contract == null)
            return Result<bool>.Failure(new Error("CONTRACT_NOT_FOUND", "العقد المرتبط غير موجود"));

        if (contract.ContractStatus == ContractWorkflowState.Cancelled || contract.ContractStatus == ContractWorkflowState.Terminated)
            return Result<bool>.Failure(new Error("CONTRACT_INACTIVE", "لا يمكن رفع مستخلص على عقد ملغى أو مفسوخ"));

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> ValidateClaimItemQuantitiesAsync(
        Guid contractItemId, 
        decimal currentQuantity, 
        decimal previousQuantity, 
        CancellationToken cancellationToken = default)
    {
        if (currentQuantity < 0)
            return Result<bool>.Failure(new Error("NEGATIVE_QUANTITY", "لا يسمح بإدخال كميات سالبة في بند المستخلص"));

        var contractItem = await _context.ContractItems.FirstOrDefaultAsync(ci => ci.Id == contractItemId, cancellationToken);
        if (contractItem == null)
            return Result<bool>.Failure(new Error("ITEM_NOT_FOUND", "بند العقد غير موجود"));

        var cumulativeQuantity = previousQuantity + currentQuantity;
        // Check authorized ceiling (CurrentQuantity on ContractItem incorporates any approved variations)
        if (cumulativeQuantity > contractItem.CurrentQuantity)
        {
            return Result<bool>.Failure(new Error("QUANTITY_EXCEEDED", 
                $"الكمية التراكمية ({cumulativeQuantity}) تتجاوز الكمية العقدية المعتمدة للبند ({contractItem.CurrentQuantity}) دون أمر تغييري معتمد"));
        }

        return Result<bool>.Success(true);
    }

    public async Task<Result<ContractClaim>> RecalculateClaimFinancialsAsync(
        Guid claimId, 
        decimal retentionRate = 5, 
        decimal advanceRecoveryRate = 0, 
        CancellationToken cancellationToken = default)
    {
        var claim = await _context.ContractClaims
            .Include(c => c.Contract)
            .Include(c => c.Items)
            .Include(c => c.Deductions)
            .Include(c => c.Adjustments)
            .FirstOrDefaultAsync(c => c.Id == claimId, cancellationToken);

        if (claim == null)
            return Result<ContractClaim>.Failure(new Error("NOT_FOUND", "المستخلص المطلوب غير موجود"));

        // 1. Calculate Gross Current from Items
        decimal grossCurrent = 0;
        foreach (var item in claim.Items)
        {
            item.ComputeAmounts();
            grossCurrent += item.CurrentAmount;
        }

        claim.GrossAmount = Math.Round(grossCurrent, 3);

        // 2. Previous certified amount from earlier approved certificates on this contract
        var previousClaimsTotal = await _context.ContractClaims
            .Where(c => c.ContractId == claim.ContractId && c.Id != claim.Id && c.Status == ClaimWorkflowState.Certified)
            .SumAsync(c => c.CurrentCertifiedAmount, cancellationToken);

        claim.PreviousCertifiedAmount = previousClaimsTotal;
        claim.CurrentCertifiedAmount = claim.GrossAmount;
        claim.CumulativeCertifiedAmount = claim.PreviousCertifiedAmount + claim.CurrentCertifiedAmount;

        // 3. Enforce Contract Value Ceiling: CumulativeCertified cannot exceed Contract.CurrentContractValue
        if (claim.CumulativeCertifiedAmount > claim.Contract.CurrentContractValue)
        {
            return Result<ContractClaim>.Failure(new Error("CONTRACT_VALUE_EXCEEDED", 
                $"إجمالي المطالبات التراكمية ({claim.CumulativeCertifiedAmount}) يتجاوز سقف القيمة التعاقدية الحالية ({claim.Contract.CurrentContractValue})"));
        }

        // 4. Calculate Dynamic Deductions (Retention & Advance Recovery)
        var existingDeductions = await _context.CertificateDeductions
            .Where(d => d.ContractClaimId == claim.Id)
            .ToListAsync(cancellationToken);
        if (existingDeductions.Any())
        {
            _context.CertificateDeductions.RemoveRange(existingDeductions);
            await _context.SaveChangesAsync(cancellationToken);
        }

        var newDeductions = new List<CertificateDeduction>();
        decimal totalDeductions = 0;
        if (retentionRate > 0)
        {
            var retentionAmount = Math.Round(claim.GrossAmount * (retentionRate / 100m), 3);
            newDeductions.Add(new CertificateDeduction
            {
                ContractClaimId = claim.Id,
                DeductionTypeCode = "RETENTION",
                Description = $"اقتطاع محجوز الضمان بنسبة {retentionRate}%",
                Rate = retentionRate,
                Amount = retentionAmount,
                IsApproved = true
            });
            totalDeductions += retentionAmount;
        }

        if (advanceRecoveryRate > 0)
        {
            var advanceAmount = Math.Round(claim.GrossAmount * (advanceRecoveryRate / 100m), 3);
            newDeductions.Add(new CertificateDeduction
            {
                ContractClaimId = claim.Id,
                DeductionTypeCode = "ADVANCE_RECOVERY",
                Description = $"استرداد دفعة مقدمة بنسبة {advanceRecoveryRate}%",
                Rate = advanceRecoveryRate,
                Amount = advanceAmount,
                IsApproved = true
            });
            totalDeductions += advanceAmount;
        }

        if (newDeductions.Any())
        {
            _context.CertificateDeductions.AddRange(newDeductions);
        }

        claim.Deductions = newDeductions;
        claim.DeductionAmount = totalDeductions;

        // 5. Calculate Net Amount = Gross - Deductions + Adjustments
        var adjustmentsTotal = claim.Adjustments.Where(a => a.IsApproved).Sum(a => a.Amount);
        claim.NetAmount = claim.GrossAmount - claim.DeductionAmount + adjustmentsTotal;

        await _context.SaveChangesAsync(cancellationToken);

        return Result<ContractClaim>.Success(claim);
    }

    public async Task<Result<PaymentCertificate>> GenerateOrUpdatePaymentCertificateAsync(
        Guid claimId, 
        string? certifiedBy = null, 
        CancellationToken cancellationToken = default)
    {
        var claim = await _context.ContractClaims.FindAsync(new object[] { claimId }, cancellationToken);
        if (claim == null)
            return Result<PaymentCertificate>.Failure(new Error("NOT_FOUND", "المستخلص المطلوب غير موجود"));

        var certificate = await _context.PaymentCertificates
            .FirstOrDefaultAsync(c => c.ContractClaimId == claimId, cancellationToken);

        if (certificate == null)
        {
            var year = DateTime.UtcNow.Year;
            var count = await _context.PaymentCertificates.CountAsync(cancellationToken);
            var certNumber = $"CERT-{year}-{(count + 1):D4}";

            certificate = new PaymentCertificate
            {
                ContractClaimId = claim.Id,
                CertificateNumber = certNumber,
                CertificateDate = DateTime.UtcNow,
                Status = "CERTIFIED",
                CertifiedBy = certifiedBy ?? "المهندس المشرف ومديرية الأشغال الهندسية",
                CertificationDate = DateTime.UtcNow
            };
            _context.PaymentCertificates.Add(certificate);
        }

        certificate.GrossCertified = claim.GrossAmount;
        certificate.PreviousCertified = claim.PreviousCertifiedAmount;
        certificate.CurrentCertified = claim.CurrentCertifiedAmount;
        certificate.CumulativeCertified = claim.CumulativeCertifiedAmount;
        certificate.DeductionsTotal = claim.DeductionAmount;
        certificate.NetCertified = claim.NetAmount;
        certificate.Status = "CERTIFIED";
        certificate.CertificationDate = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(certifiedBy)) certificate.CertifiedBy = certifiedBy;

        claim.Status = ClaimWorkflowState.Certified;

        await _context.SaveChangesAsync(cancellationToken);

        return Result<PaymentCertificate>.Success(certificate);
    }
}
