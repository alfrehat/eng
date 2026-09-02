using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Host.Middlewares;
using Knm.Enterprise.Host.Services;
using Knm.Enterprise.Infrastructure;
using Knm.Enterprise.Persistence;
using Knm.Enterprise.Shared;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// 1. Centralized Structured Logging (Serilog)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

builder.Host.UseSerilog();

// 2. Foundation Services Registration
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CorrelationContext>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// 3. Layer Registrations
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddPersistenceServices(builder.Configuration);

// 4. API Controllers & Routing
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Knm.Enterprise Platform API",
        Version = "v2.0",
        Description = "نظام إدارة مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة - الإصدار المعماري المؤسسي"
    });
});

// 5. CORS Policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("EnterpriseCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 6. Health Checks
builder.Services.AddHealthChecks();

var app = builder.Build();

// 7. Middlewares Pipeline
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Knm.Enterprise API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors("EnterpriseCorsPolicy");

app.UseRouting();

app.MapControllers();

app.MapHealthChecks("/health/ready");

try
{
    Log.Information("Starting KNM Enterprise Host on port 5050...");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "KNM Enterprise Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
