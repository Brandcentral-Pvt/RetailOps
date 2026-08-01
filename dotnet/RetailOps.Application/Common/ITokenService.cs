using System.Security.Claims;

namespace RetailOps.Application.Common;

public sealed record TokenPair(string AccessToken, string RefreshToken);

public sealed record TempTokenPayload(string UserId, string Email, string Purpose, string Step);

public interface ITokenService
{
    TokenPair GenerateTokens(string userId, string? fingerprint);
    string GenerateTempToken(string userId, string email, string purpose, string step);
    ClaimsPrincipal? ValidateAccessToken(string token);
    ClaimsPrincipal? ValidateRefreshToken(string token);
    ClaimsPrincipal? ValidateTempToken(string token);
}
