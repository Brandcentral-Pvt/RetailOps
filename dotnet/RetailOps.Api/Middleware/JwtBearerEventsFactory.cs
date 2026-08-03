using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RetailOps.Application.Common;
using RetailOps.Infrastructure.Common;
using RetailOps.Infrastructure.Data;
using RetailOps.Infrastructure.Security;

namespace RetailOps.Api.Middleware;

public static class JwtBearerEventsFactory
{
    public static void Configure(JwtBearerOptions options)
    {
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = OnTokenValidatedAsync,
            OnAuthenticationFailed = OnAuthenticationFailedAsync,
            OnChallenge = OnChallengeAsync
        };
    }

    private static async Task OnTokenValidatedAsync(TokenValidatedContext context)
    {
        var rawToken = (context.SecurityToken as JwtSecurityToken)?.RawData;
        if (string.IsNullOrEmpty(rawToken))
        {
            SetFailure(context, 401, "Invalid token");
            return;
        }

        var services = context.HttpContext.RequestServices;
        var blacklist = services.GetRequiredService<ITokenBlacklistService>();

        if (await blacklist.IsBlacklistedAsync(rawToken, context.HttpContext.RequestAborted))
        {
            SetFailure(context, 401, "Token revoked");
            return;
        }

        var principal = context.Principal;
        var userId = principal?.FindFirst(TokenService.UserIdClaim)?.Value;
        if (userId is null)
        {
            SetFailure(context, 401, "Invalid token");
            return;
        }

        var issuedAt = TokenService.GetIssuedAt(principal!);
        if (await blacklist.IsUserBlacklistedAsync(userId, issuedAt, context.HttpContext.RequestAborted))
        {
            SetFailure(context, 401, "Session invalidated");
            return;
        }

        var db = services.GetRequiredService<RetailOpsDbContext>();
        var user = await (from u in db.Users
                          join r in db.Roles on u.RoleId equals r.Id into rg
                          from r in rg.DefaultIfEmpty()
                          where u.Id == userId
                          select new
                          {
                              U = u,
                              RoleName = r == null ? null : r.Name,
                              RoleDisplayName = r == null ? null : r.DisplayName
                          }).FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        if (user is null)
        {
            SetFailure(context, 401, "User not found");
            return;
        }
        if (user.U.IsActive != true)
        {
            SetFailure(context, 403, "Account is deactivated");
            return;
        }

        var fpClaim = principal!.FindFirst(TokenService.FingerprintClaim)?.Value;
        if (!string.IsNullOrEmpty(fpClaim))
        {
            var xff = context.HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            var remoteIp = context.HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
            var ip = !string.IsNullOrWhiteSpace(xff) ? xff.Split(',')[0].Trim() : remoteIp;
            var ua = context.HttpContext.Request.Headers["User-Agent"].FirstOrDefault();
            var currentFp = DeviceFingerprint.From(ua, ip);
            if (fpClaim != currentFp)
            {
                var env = services.GetRequiredService<IHostEnvironment>();
                if (env.IsProduction())
                {
                    SetFailure(context, 401, "Session invalid: device mismatch");
                    return;
                }
            }
        }

        if (user.U.PasswordExpiresAt is not null && user.U.PasswordExpiresAt < EnvTime.Now())
        {
            context.HttpContext.Items["ForcePasswordReset"] = true;
        }

        var roleName = user.RoleName ?? "viewer";
        var normalizedRole = roleName == "super_admin" ? "admin" : roleName;
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(TokenService.UserIdClaim, userId),
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Name, userId),
            new Claim(ClaimTypes.Role, normalizedRole)
        }, JwtBearerDefaults.AuthenticationScheme);

        context.Principal = new ClaimsPrincipal(identity);
        context.HttpContext.Items["AuthUserId"] = userId;
        context.HttpContext.Items["AuthRoleName"] = roleName;
        context.HttpContext.Items["ForcePasswordReset"] = context.HttpContext.Items.ContainsKey("ForcePasswordReset");
    }

    private static Task OnAuthenticationFailedAsync(AuthenticationFailedContext context)
    {
        context.HttpContext.Items["AuthStatus"] = 401;
        context.HttpContext.Items["AuthError"] =
            context.Exception is SecurityTokenExpiredException
                ? "Token expired. Please login again."
                : "Invalid token";
        return Task.CompletedTask;
    }

    private static async Task OnChallengeAsync(JwtBearerChallengeContext context)
    {
        context.HandleResponse();
        var status = context.HttpContext.Items.TryGetValue("AuthStatus", out var s) && s is int i ? i : 401;
        var message = context.HttpContext.Items.TryGetValue("AuthError", out var m) && m is string str
            ? str
            : "Authentication required";

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new { success = false, message }));
    }

    private static void SetFailure(TokenValidatedContext context, int status, string message)
    {
        context.HttpContext.Items["AuthStatus"] = status;
        context.HttpContext.Items["AuthError"] = message;
        context.Fail(message);
    }
}
