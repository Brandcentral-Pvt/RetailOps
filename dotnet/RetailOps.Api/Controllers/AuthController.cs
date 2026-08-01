using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RetailOps.Api.Middleware;
using RetailOps.Application.Auth;
using RetailOps.Application.Common;
using RetailOps.Infrastructure.Security;

namespace RetailOps.Api.Controllers;

[ApiController]
[Route("api/auth")]
[RateLimit(AuthRateLimits.AuthScope, AuthRateLimits.AuthMax, AuthRateLimits.AuthWindowSeconds, AuthRateLimits.AuthMessageJson)]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest? request)
    {
        if (!AuthValidation.IsValidLogin(request))
        {
            return GenericValidationError();
        }
        return Result(await _auth.LoginAsync(request!, BuildContext()));
    }

    [HttpPost("request-otp")]
    [RateLimit(AuthRateLimits.OtpRequestScope, AuthRateLimits.OtpRequestMax, AuthRateLimits.OtpWindowSeconds, AuthRateLimits.OtpMessageJson)]
    public async Task<IActionResult> RequestOtp([FromBody] RequestOtpRequest? request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Email))
        {
            return Json(new { success = false, message = "Email is required" }, StatusCodes.Status400BadRequest);
        }
        return Result(await _auth.RequestOtpAsync(request, BuildContext()));
    }

    [HttpPost("verify-otp")]
    [RateLimit(AuthRateLimits.OtpScope, AuthRateLimits.OtpMax, AuthRateLimits.OtpWindowSeconds, AuthRateLimits.OtpMessageJson)]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest? request)
    {
        if (!AuthValidation.IsValidVerifyOtp(request))
        {
            return GenericValidationError();
        }
        return Result(await _auth.VerifyOtpAsync(request!, BuildContext()));
    }

    [HttpPost("resend-otp")]
    [RateLimit(AuthRateLimits.OtpScope, AuthRateLimits.OtpMax, AuthRateLimits.OtpWindowSeconds, AuthRateLimits.OtpMessageJson)]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequest? request)
    {
        if (!AuthValidation.IsValidResendOtp(request))
        {
            return GenericValidationError();
        }
        return Result(await _auth.ResendOtpAsync(request!, BuildContext()));
    }

    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest? request)
    {
        if (request is null)
        {
            return Json(new { success = false, message = "Token required" }, StatusCodes.Status400BadRequest);
        }
        return Result(await _auth.RefreshTokenAsync(request));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        return Result(await _auth.LogoutAsync(CurrentUserId!, CurrentAccessToken));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        return Result(await _auth.GetMeAsync(CurrentUserId!));
    }

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest? request)
    {
        return Result(await _auth.UpdateProfileAsync(CurrentUserId!, request ?? new UpdateProfileRequest(null, null, null, null)));
    }

    [HttpPost("request-password-change")]
    [Authorize]
    public async Task<IActionResult> RequestPasswordChange([FromBody] RequestPasswordChangeRequest? request)
    {
        if (request is null)
        {
            return Json(new { success = false, message = "Current password is required" }, StatusCodes.Status400BadRequest);
        }
        return Result(await _auth.RequestPasswordChangeAsync(CurrentUserId!, request, BuildContext()));
    }

    [HttpPut("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest? request)
    {
        if (!AuthValidation.IsValidChangePassword(request))
        {
            return GenericValidationError();
        }
        return Result(await _auth.ChangePasswordAsync(CurrentUserId!, request!));
    }

    [HttpPut("change-password-with-otp")]
    [Authorize]
    public async Task<IActionResult> ChangePasswordWithOtp([FromBody] ChangePasswordWithOtpRequest? request)
    {
        return Result(await _auth.ChangePasswordWithOtpAsync(
            request ?? new ChangePasswordWithOtpRequest(null!, null!, null!), BuildContext()));
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest? request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Email))
        {
            return Json(new { success = false, message = "Email is required" }, StatusCodes.Status400BadRequest);
        }
        return Result(await _auth.ForgotPasswordAsync(request));
    }

    [HttpGet("validate-reset-token")]
    public async Task<IActionResult> ValidateResetToken([FromQuery] string? token)
    {
        return Result(await _auth.ValidateResetTokenAsync(token ?? string.Empty));
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest? request)
    {
        return Result(await _auth.ResetPasswordAsync(request ?? new ResetPasswordRequest(null!, null!)));
    }

    private string? CurrentUserId => User.FindFirst(TokenService.UserIdClaim)?.Value;

    private string? CurrentAccessToken
    {
        get
        {
            var auth = Request.Headers.Authorization.FirstOrDefault();
            if (string.IsNullOrEmpty(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
            return auth["Bearer ".Length..].Trim();
        }
    }

    private RequestContext BuildContext()
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var xff = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        var ua = Request.Headers["User-Agent"].FirstOrDefault();
        var platform = Request.Headers["x-platform"].FirstOrDefault();
        var auth = Request.Headers.Authorization.FirstOrDefault();
        return RequestContextFactory.From(ip, ua, platform, auth, xff);
    }

    private IActionResult Result(AuthResult result) => StatusCode(result.StatusCode, result.Payload);

    private IActionResult GenericValidationError() =>
        Json(new { success = false, message = "Invalid input. Please check your form and try again." }, StatusCodes.Status400BadRequest);

    private static IActionResult Json(object payload, int statusCode) =>
        new JsonResult(payload) { StatusCode = statusCode };
}

public static class AuthRateLimits
{
    public const string AuthScope = "AUTH";
    public const int AuthMax = 20;
    public const int AuthWindowSeconds = 60;
    public const string AuthMessageJson = "{\"success\":false,\"error\":\"Too many requests, please try again later.\",\"code\":\"RATE_LIMITED\"}";

    public const string OtpRequestScope = "OTP_REQUEST";
    public const int OtpRequestMax = 3;
    public const string OtpScope = "OTP";
    public const int OtpMax = 5;
    public const int OtpWindowSeconds = 300;
    public const string OtpMessageJson = "{\"success\":false,\"message\":\"Too many OTP requests, try again later\"}";
}
