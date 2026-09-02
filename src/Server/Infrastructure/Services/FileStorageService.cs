using System.Security.Cryptography;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Storage;
using Knm.Enterprise.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Knm.Enterprise.Infrastructure.Services;

public class FileStorageService : IFileStorageService
{
    private readonly IApplicationDbContext _context;
    private readonly string _storageBasePath;
    private readonly ILogger<FileStorageService> _logger;

    public FileStorageService(
        IApplicationDbContext context,
        IConfiguration configuration,
        ILogger<FileStorageService> logger)
    {
        _context = context;
        _logger = logger;
        _storageBasePath = configuration["FileStorage:BasePath"] ?? Path.Combine(AppContext.BaseDirectory, "App_Data", "Uploads");

        if (!Directory.Exists(_storageBasePath))
        {
            Directory.CreateDirectory(_storageBasePath);
        }
    }

    public async Task<Result<FileUploadResult>> SaveFileAsync(
        Stream contentStream,
        string fileName,
        string contentType,
        string? module = null,
        string? entityId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var fileExtension = Path.GetExtension(fileName);
            var safeStoredName = $"{Guid.NewGuid():N}{fileExtension}";
            var targetFolder = string.IsNullOrWhiteSpace(module) ? _storageBasePath : Path.Combine(_storageBasePath, module);

            if (!Directory.Exists(targetFolder))
            {
                Directory.CreateDirectory(targetFolder);
            }

            var fullFilePath = Path.Combine(targetFolder, safeStoredName);

            string sha256Hash;
            long sizeBytes;

            using (var fileStream = new FileStream(fullFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            using (var sha256 = SHA256.Create())
            {
                var buffer = new byte[81920];
                int bytesRead;
                sizeBytes = 0;

                while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
                {
                    await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
                    sha256.TransformBlock(buffer, 0, bytesRead, null, 0);
                    sizeBytes += bytesRead;
                }

                sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                sha256Hash = Convert.ToHexString(sha256.Hash ?? Array.Empty<byte>()).ToLowerInvariant();
            }

            var storedFile = new StoredFile
            {
                OriginalFileName = fileName,
                StoredFileName = safeStoredName,
                ContentType = contentType,
                FileSizeBytes = sizeBytes,
                StoragePath = fullFilePath,
                Sha256Hash = sha256Hash,
                ModuleReference = module,
                EntityReferenceId = entityId
            };

            _context.StoredFiles.Add(storedFile);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("File {FileName} stored successfully as {StoredFile} (Hash: {Hash})", fileName, safeStoredName, sha256Hash);

            return Result<FileUploadResult>.Success(new FileUploadResult
            {
                FileId = storedFile.Id,
                OriginalFileName = storedFile.OriginalFileName,
                StoredFileName = storedFile.StoredFileName,
                ContentType = storedFile.ContentType,
                FileSizeBytes = storedFile.FileSizeBytes,
                StoragePath = storedFile.StoragePath,
                Sha256Hash = storedFile.Sha256Hash
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save file: {FileName}", fileName);
            return Result<FileUploadResult>.Failure(Error.Failure("FILE_SAVE_ERROR", "فشل تخزين الملف"));
        }
    }

    public async Task<Result<(Stream Stream, string ContentType, string FileName)>> GetFileAsync(
        Guid fileId,
        CancellationToken cancellationToken = default)
    {
        var record = await _context.StoredFiles.FirstOrDefaultAsync(f => f.Id == fileId, cancellationToken);
        if (record == null)
        {
            return Result<(Stream, string, string)>.Failure(Error.NotFound("FILE_NOT_FOUND", "الملف المطلوب غير موجود في السجلات"));
        }

        if (!File.Exists(record.StoragePath))
        {
            return Result<(Stream, string, string)>.Failure(Error.NotFound("FILE_MISSING_ON_DISK", "الملف الفعلي غير موجود على وحدة التخزين"));
        }

        var stream = new FileStream(record.StoragePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Result<(Stream, string, string)>.Success((stream, record.ContentType, record.OriginalFileName));
    }

    public async Task<Result> DeleteFileAsync(Guid fileId, CancellationToken cancellationToken = default)
    {
        var record = await _context.StoredFiles.FirstOrDefaultAsync(f => f.Id == fileId, cancellationToken);
        if (record == null)
        {
            return Result.Failure(Error.NotFound("FILE_NOT_FOUND", "الملف المطلوب غير موجود"));
        }

        if (File.Exists(record.StoragePath))
        {
            File.Delete(record.StoragePath);
        }

        _context.StoredFiles.Remove(record);
        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
