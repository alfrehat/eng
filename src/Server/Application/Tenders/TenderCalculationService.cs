using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Tenders;
using Knm.Enterprise.Shared;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Application.Tenders;

public interface ITenderCalculationService
{
    Task<Result<TenderBoq>> RecalculateBoqTotalsAsync(Guid boqId, CancellationToken cancellationToken = default);
    Result<bool> ValidateTenderDates(DateTime? publicationDate, DateTime? closingDate, DateTime? openingDate);
}

public class TenderCalculationService : ITenderCalculationService
{
    private readonly IApplicationDbContext _context;

    public TenderCalculationService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<TenderBoq>> RecalculateBoqTotalsAsync(Guid boqId, CancellationToken cancellationToken = default)
    {
        var boq = await _context.TenderBoqs
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == boqId, cancellationToken);

        if (boq == null)
            return Result<TenderBoq>.Failure(new Error("NOT_FOUND", "جدول الكميات المطلوب غير موجود"));

        decimal subTotal = 0;
        foreach (var item in boq.Items)
        {
            if (item.Quantity < 0 || item.EstimatedUnitPrice < 0)
            {
                return Result<TenderBoq>.Failure(new Error("NEGATIVE_VALUES", $"البند {item.ItemNumber} يحتوي على كمية أو سعر سالب"));
            }

            item.ComputeTotal();
            subTotal += item.EstimatedTotal;
        }

        boq.SubTotal = subTotal;
        boq.TaxAmount = Math.Round(subTotal * (boq.TaxRatePercent / 100m), 3);
        boq.GrandTotal = boq.SubTotal + boq.TaxAmount;

        await _context.SaveChangesAsync(cancellationToken);

        return Result<TenderBoq>.Success(boq);
    }

    public Result<bool> ValidateTenderDates(DateTime? publicationDate, DateTime? closingDate, DateTime? openingDate)
    {
        if (publicationDate.HasValue && closingDate.HasValue && closingDate < publicationDate)
        {
            return Result<bool>.Failure(new Error("INVALID_DATE_ORDER", "تاريخ إغلاق العطاء لا يمكن أن يكون قبل تاريخ النشر"));
        }

        if (closingDate.HasValue && openingDate.HasValue && openingDate < closingDate)
        {
            return Result<bool>.Failure(new Error("INVALID_DATE_ORDER", "تاريخ فتح المظاريف لا يمكن أن يكون قبل تاريخ الإغلاق"));
        }

        return Result<bool>.Success(true);
    }
}
