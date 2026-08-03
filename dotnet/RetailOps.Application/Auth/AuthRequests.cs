namespace RetailOps.Application.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record RequestOtpRequest(string Email);

public sealed record VerifyOtpRequest(string TempToken, string Otp, bool? TrustDevice);

public sealed record ResendOtpRequest(string TempToken);

public sealed record RefreshTokenRequest(string RefreshToken);

public sealed record UpdateProfileRequest(string? FirstName, string? LastName, string? Phone, Dictionary<string, object?>? Preferences);

public sealed record RequestPasswordChangeRequest(string CurrentPassword);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record ChangePasswordWithOtpRequest(string TempToken, string Otp, string NewPassword);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Token, string NewPassword);
