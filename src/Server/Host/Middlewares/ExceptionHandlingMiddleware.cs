using System.Net;
using System.Text.Json;
using Knm.Enterprise.Shared;

namespace Knm.Enterprise.Host.Middlewares;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, CorrelationContext correlationContext)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ExceptionMiddleware] Unhandled exception occurred. CorrelationId: {CorrelationId}", correlationContext.CorrelationId);
            await HandleExceptionAsync(context, ex, correlationContext.CorrelationId);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception, string correlationId)
    {
        var statusCode = HttpStatusCode.InternalServerError;
        var errorCode = "INTERNAL_SERVER_ERROR";
        var errorMessage = "حدث خطأ داخلي في الخادم. يرجى مراجعة الدعم الفني.";

        switch (exception)
        {
            case KeyNotFoundException:
                statusCode = HttpStatusCode.NotFound;
                errorCode = "NOT_FOUND";
                errorMessage = "المورد المطلوب غير موجود.";
                break;
            case InvalidOperationException:
                statusCode = HttpStatusCode.BadRequest;
                errorCode = "INVALID_OPERATION";
                errorMessage = exception.Message;
                break;
            case UnauthorizedAccessException:
                statusCode = HttpStatusCode.Unauthorized;
                errorCode = "UNAUTHORIZED";
                errorMessage = "غير مصرح بالوصول إلى هذا المورد.";
                break;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var response = ApiResponse<object>.Fail(errorCode, errorMessage, correlationId);
        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
    }
}
