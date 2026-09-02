using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        IApplicationDbContext context, 
        CorrelationContext correlationContext,
        ILogger<HealthController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet("/health")]
    public async Task<IActionResult> GetHealth()
    {
        var dbConnected = false;
        string? postGisVersion = null;

        try
        {
            await using var command = _context.Database.GetDbConnection().CreateCommand();
            command.CommandText = "SELECT PostGIS_Version();";
            await _context.Database.OpenConnectionAsync();
            var result = await command.ExecuteScalarAsync();
            postGisVersion = result?.ToString();
            dbConnected = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Health check database probe failed.");
            dbConnected = false;
        }

        var healthData = new
        {
            status = dbConnected ? "Healthy" : "Degraded",
            system = "نظام إدارة مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة",
            version = "2.0.0-Enterprise",
            architecture = "ASP.NET Core 8 (.NET 8) + Clean Architecture",
            database = dbConnected ? "PostgreSQL (Connected)" : "PostgreSQL (Disconnected)",
            postgis = postGisVersion ?? "Unavailable",
            timestamp = DateTime.UtcNow
        };

        return Ok(ApiResponse<object>.Ok(healthData, _correlationContext.CorrelationId));
    }

    [HttpGet("/api/v1/system/db-check")]
    public async Task<IActionResult> DatabaseCheck()
    {
        try
        {
            var dbName = _context.Database.GetDbConnection().Database;
            var canConnect = await _context.Database.CanConnectAsync();

            var info = new
            {
                connected = canConnect,
                database = dbName,
                server = _context.Database.GetDbConnection().DataSource,
                state = _context.Database.GetDbConnection().State.ToString()
            };

            return Ok(ApiResponse<object>.Ok(info, _correlationContext.CorrelationId));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.Fail("DB_ERROR", ex.Message, _correlationContext.CorrelationId));
        }
    }
}
