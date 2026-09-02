using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Knm.Enterprise.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IDateTimeService, SystemDateTimeService>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IFileStorageService, FileStorageService>();
        services.AddScoped<Knm.Enterprise.Application.Projects.ICpmCalculationService, Knm.Enterprise.Application.Projects.CpmCalculationService>();
        services.AddScoped<Knm.Enterprise.Application.Projects.IProjectPriorityService, Knm.Enterprise.Application.Projects.ProjectPriorityService>();
        services.AddScoped<Knm.Enterprise.Application.Tenders.ITenderCalculationService, Knm.Enterprise.Application.Tenders.TenderCalculationService>();

        return services;
    }
}
