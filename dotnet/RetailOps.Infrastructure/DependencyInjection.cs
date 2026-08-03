using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RetailOps.Application.Auth;
using RetailOps.Application.Common;
using RetailOps.Infrastructure.Auth;
using RetailOps.Infrastructure.Configuration;
using RetailOps.Infrastructure.Data;
using RetailOps.Infrastructure.Email;
using RetailOps.Infrastructure.Security;

namespace RetailOps.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.Configure<RetailOpsSettings>(configuration.GetSection(RetailOpsSettings.SectionName));
        services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));

        services.AddDbContext<RetailOpsDbContext>(options =>
            options.UseSqlServer(ConnectionStringResolver.Resolve()));

        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<ITokenBlacklistService, TokenBlacklistService>();
        services.AddScoped<ILoginRateLimiter, InMemoryLoginRateLimiter>();
        services.AddScoped<IOtpService, OtpService>();
        services.AddScoped<ITrustedDeviceService, TrustedDeviceService>();
        services.AddScoped<IPasswordResetService, PasswordResetService>();
        services.AddScoped<IEmailService, SmtpEmailService>();
        services.AddScoped<ISystemLogService, SystemLogService>();
        services.AddScoped<IAuthService, AuthService>();

        return services;
    }
}
