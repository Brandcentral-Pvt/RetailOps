namespace RetailOps.Application.Common;

public sealed record GenerateResetResult(bool Success, string? Token, string? UserId, string? Email, string? FirstName, string? Message);

public sealed record ValidateResetResult(bool Valid, string? UserId, string? Email, string? FirstName, string Message);

public sealed record ResetPasswordResult(bool Success, string Message);

public interface IPasswordResetService
{
    Task<GenerateResetResult> GenerateResetTokenAsync(string email, CancellationToken ct = default);
    Task<ValidateResetResult> ValidateResetTokenAsync(string token, CancellationToken ct = default);
    Task<ResetPasswordResult> ResetPasswordAsync(string token, string newPassword, CancellationToken ct = default);
}
