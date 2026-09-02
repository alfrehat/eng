using Knm.Enterprise.Application.Common.Interfaces;

namespace Knm.Enterprise.Infrastructure.Services;

public class SystemDateTimeService : IDateTimeService
{
    public DateTime UtcNow => DateTime.UtcNow;
}

public class PasswordHasher : IPasswordHasher
{
    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.EnhancedHashPassword(password, 12);
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        return BCrypt.Net.BCrypt.EnhancedVerify(password, passwordHash);
    }
}
