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

        return services;
    }
}
