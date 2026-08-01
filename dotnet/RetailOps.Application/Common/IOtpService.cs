namespace RetailOps.Application.Common;

public sealed record OtpMetadata(string? IpAddress, string? UserAgent, string? Source);

public sealed record OtpSendResult(bool Success, int ExpiresIn, string Destination, int AttemptsRemaining);

public interface IOtpService
{
    Task<OtpSendResult> SendOtpAsync(string userId, string email, string purpose, OtpMetadata metadata, CancellationToken ct = default);
    Task VerifyOtpAsync(string userId, string otp, string purpose, OtpMetadata metadata, CancellationToken ct = default);
}
