using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RetailOps.Application.Common;

namespace RetailOps.Infrastructure.Security;

public sealed class TokenService : ITokenService
{
    public const string UserIdClaim = "userId";
    public const string TypeClaim = "type";
    public const string FingerprintClaim = "fp";
    public const string EmailClaim = "email";
    public const string PurposeClaim = "purpose";
    public const string StepClaim = "step";

    private readonly JwtSettings _settings;
    private readonly TokenValidationParameters _accessValidation;
    private readonly TokenValidationParameters _refreshValidation;

    public TokenService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;

        _accessValidation = CreateValidation(_settings.AccessSecret);
        _refreshValidation = CreateValidation(_settings.RefreshSecret);
    }

    private static TokenValidationParameters CreateValidation(string secret) => new()
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
        ClockSkew = TimeSpan.Zero
    };

    public TokenPair GenerateTokens(string userId, string? fingerprint)
    {
        var accessToken = SignToken(
            new[]
            {
                new Claim(UserIdClaim, userId),
                new Claim(TypeClaim, "access"),
                new Claim(FingerprintClaim, fingerprint ?? string.Empty)
            },
            _settings.AccessSecret,
            ParseDuration(_settings.AccessExpiry));

        var refreshToken = SignToken(
            new[]
            {
                new Claim(UserIdClaim, userId),
                new Claim(TypeClaim, "refresh"),
                new Claim(FingerprintClaim, fingerprint ?? string.Empty)
            },
            _settings.RefreshSecret,
            ParseDuration(_settings.RefreshExpiry));

        return new TokenPair(accessToken, refreshToken);
    }

    public string GenerateTempToken(string userId, string email, string purpose, string step)
    {
        return SignToken(
            new[]
            {
                new Claim(UserIdClaim, userId),
                new Claim(EmailClaim, email),
                new Claim(PurposeClaim, purpose),
                new Claim(StepClaim, step)
            },
            _settings.AccessSecret,
            ParseDuration(_settings.TempExpiry));
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            return handler.ValidateToken(token, _accessValidation, out _);
        }
        catch
        {
            return null;
        }
    }

    public ClaimsPrincipal? ValidateRefreshToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            return handler.ValidateToken(token, _refreshValidation, out _);
        }
        catch
        {
            return null;
        }
    }

    public ClaimsPrincipal? ValidateTempToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            return handler.ValidateToken(token, _accessValidation, out _);
        }
        catch
        {
            return null;
        }
    }

    private static string SignToken(IEnumerable<Claim> claims, string secret, TimeSpan lifetime)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;

        var token = new JwtSecurityToken(
            claims: claims,
            notBefore: now,
            expires: now.Add(lifetime),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static TimeSpan ParseDuration(string value) =>
        value.EndsWith("m") ? TimeSpan.FromMinutes(int.Parse(value.TrimEnd('m')))
        : value.EndsWith("h") ? TimeSpan.FromHours(int.Parse(value.TrimEnd('h')))
        : value.EndsWith("d") ? TimeSpan.FromDays(int.Parse(value.TrimEnd('d')))
        : TimeSpan.FromHours(2);

    public static string? GetUserId(ClaimsPrincipal principal) =>
        principal?.FindFirst(UserIdClaim)?.Value;

    public static string? GetClaim(ClaimsPrincipal principal, string type) =>
        principal?.FindFirst(type)?.Value;

    public static long GetIssuedAt(ClaimsPrincipal principal)
    {
        var iatClaim = principal?.FindFirst(JwtRegisteredClaimNames.Iat)?.Value;
        return long.TryParse(iatClaim, out var value) ? value : 0;
    }
}
