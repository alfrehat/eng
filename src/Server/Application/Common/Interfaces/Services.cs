using Knm.Enterprise.Shared;

namespace Knm.Enterprise.Application.Common.Interfaces;

public interface ICurrentUserService
{
    string? UserId { get; }
    string? Username { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
}

public interface IDateTimeService
{
    DateTime UtcNow { get; }
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

public class FileUploadResult
{
    public Guid FileId { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public string Sha256Hash { get; set; } = string.Empty;
}

public interface IFileStorageService
{
    Task<Result<FileUploadResult>> SaveFileAsync(
        Stream contentStream, 
        string fileName, 
        string contentType, 
        string? module = null, 
        string? entityId = null, 
        CancellationToken cancellationToken = default);

    Task<Result<(Stream Stream, string ContentType, string FileName)>> GetFileAsync(
        Guid fileId, 
        CancellationToken cancellationToken = default);

    Task<Result> DeleteFileAsync(
        Guid fileId, 
        CancellationToken cancellationToken = default);
}
