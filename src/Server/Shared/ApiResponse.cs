namespace Knm.Enterprise.Shared;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string CorrelationId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public static ApiResponse<T> Ok(T data, string correlationId = "") => new()
    {
        Success = true,
        Data = data,
        CorrelationId = correlationId,
        Timestamp = DateTime.UtcNow
    };

    public static ApiResponse<T> Fail(string errorCode, string errorMessage, string correlationId = "") => new()
    {
        Success = false,
        ErrorCode = errorCode,
        ErrorMessage = errorMessage,
        CorrelationId = correlationId,
        Timestamp = DateTime.UtcNow
    };

    public static ApiResponse<T> Fail(Error error, string correlationId = "") => new()
    {
        Success = false,
        ErrorCode = error.Code,
        ErrorMessage = error.Message,
        CorrelationId = correlationId,
        Timestamp = DateTime.UtcNow
    };
}
