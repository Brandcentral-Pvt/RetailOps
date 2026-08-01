using System.Text.RegularExpressions;
using RetailOps.Application.Auth;

namespace RetailOps.Api.Controllers;

public static partial class AuthValidation
{
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^\d{6}$")]
    private static partial Regex OtpRegex();

    private const string EmailMax = "Email must not exceed 255 characters";

    public static bool IsValidLogin(LoginRequest? request) =>
        request is not null &&
        !string.IsNullOrWhiteSpace(request.Email) &&
        request.Email.Length <= 255 &&
        EmailRegex().IsMatch(request.Email) &&
        !string.IsNullOrEmpty(request.Password) &&
        request.Password.Length <= 128;

    public static bool IsValidVerifyOtp(VerifyOtpRequest? request) =>
        request is not null &&
        request.TempToken is not null &&
        request.TempToken.Length is >= 20 and <= 2000 &&
        request.Otp is not null &&
        OtpRegex().IsMatch(request.Otp);

    public static bool IsValidResendOtp(ResendOtpRequest? request) =>
        request is not null &&
        request.TempToken is not null &&
        request.TempToken.Length is >= 20 and <= 2000;

    public static bool IsValidChangePassword(ChangePasswordRequest? request) =>
        request is not null &&
        !string.IsNullOrEmpty(request.CurrentPassword) &&
        request.CurrentPassword.Length <= 128 &&
        request.NewPassword is not null &&
        request.NewPassword.Length is >= 8 and <= 128 &&
        !request.NewPassword.Contains('<');
}
