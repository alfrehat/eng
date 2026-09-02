using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Application.Contracts;
using Knm.Enterprise.Domain.Contracts;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/contracts/{contractId}/[controller]")]
public class ContractSignaturesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IContractCalculationService _calcService;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<ContractSignaturesController> _logger;

    public ContractSignaturesController(
        IApplicationDbContext context,
        IContractCalculationService calcService,
        CorrelationContext correlationContext,
        ILogger<ContractSignaturesController> logger)
    {
        _context = context;
        _calcService = calcService;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetSignatures(Guid contractId)
    {
        var signatures = await _context.ContractSignatures
            .Where(s => s.ContractId == contractId)
            .OrderBy(s => s.SignatureDate)
            .AsNoTracking()
            .Select(s => new
            {
                s.Id,
                s.ContractId,
                s.SignerName,
                s.SignerRole,
                s.SignatureDate,
                s.SignatureStatus,
                s.HashAlgorithm,
                s.DocumentHash,
                s.SignatureReference
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(signatures, _correlationContext.CorrelationId));
    }

    [HttpPost]
    public async Task<IActionResult> SignContract(Guid contractId, [FromBody] SignContractDto dto)
    {
        var contract = await _context.Contracts
            .Include(c => c.Project)
            .Include(c => c.ContractorParty)
            .FirstOrDefaultAsync(c => c.Id == contractId);

        if (contract == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "العقد المحدد غير موجود", _correlationContext.CorrelationId));

        // Generate Document Integrity Hash using SHA-256
        var contentToHash = $"{contract.ContractNumber}|{contract.Title}|{contract.OriginalValue}|{contract.StartDate:yyyy-MM-dd}|{contract.OriginalCompletionDate:yyyy-MM-dd}|{contract.ContractorParty?.Name}";
        var documentHash = _calcService.ComputeDocumentSha256(contentToHash);

        var signature = new ContractSignature
        {
            ContractId = contractId,
            SignerName = dto.SignerName.Trim(),
            SignerRole = dto.SignerRole?.ToUpperInvariant() ?? "MAYOR",
            SignatureDate = DateTime.UtcNow,
            SignatureStatus = "VERIFIED",
            CertificateReference = dto.CertificateReference ?? "MUNICIPAL_PKI_CA_2026",
            HashAlgorithm = "SHA-256",
            DocumentHash = documentHash,
            SignatureReference = $"SIG-{Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()}"
        };

        _context.ContractSignatures.Add(signature);

        // Update contract status to Signed
        contract.ContractStatus = ContractWorkflowState.Signed;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Contract {ContractNumber} signed by {Signer}. SHA-256: {Hash}",
            contract.ContractNumber, dto.SignerName, documentHash);

        return Ok(ApiResponse<object>.Ok(new
        {
            signature.Id,
            signature.ContractId,
            signature.SignerName,
            signature.SignerRole,
            signature.SignatureDate,
            signature.HashAlgorithm,
            signature.DocumentHash,
            signature.SignatureReference,
            contractStatus = contract.ContractStatus.ToString()
        }, _correlationContext.CorrelationId));
    }
}

public class SignContractDto
{
    public string SignerName { get; set; } = string.Empty;
    public string? SignerRole { get; set; }
    public string? CertificateReference { get; set; }
}
