using RetailOps.Application.Common;

namespace RetailOps.Application.Auth;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request, RequestContext ctx, CancellationToken ct = default);
    Task<AuthResult> RequestOtpAsync(RequestOtpRequest request, RequestContext ctx, CancellationToken ct = default);
    Task<AuthResult> VerifyOtpAsync(VerifyOtpRequest request, RequestContext ctx, CancellationToken ct = default);
    Task<AuthResult> ResendOtpAsync(ResendOtpRequest request, RequestContext ctx, CancellationToken ct = default);
    Task<AuthResult> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken ct = default);
    Task<AuthResult> LogoutAsync(string userId, string? accessToken, CancellationToken ct = default);
    Task<AuthResult> GetMeAsync(string userId, CancellationToken ct = default);
    Task<AuthResult> UpdateProfileAsync(string userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task<AuthResult> RequestPasswordChangeAsync(string userId, RequestPasswordChangeRequest request, RequestContext ctx, CancellationToken ct = default);
    Task<AuthResult> ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken ct = default);
    Task<AuthResult> ChangePasswordWithOtpAsync(ChangePasswordWithOtpRequest request, RequestContext ctx, CancellationToken ct = default);
    Task<AuthResult> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default);
    Task<AuthResult> ValidateResetTokenAsync(string token, CancellationToken ct = default);
    Task<AuthResult> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
}
