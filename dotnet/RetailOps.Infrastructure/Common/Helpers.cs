using System.Security.Cryptography;
using System.Text;

namespace RetailOps.Infrastructure.Common;

public static class IdGenerator
{
    public static string New()
    {
        Span<byte> bytes = stackalloc byte[16];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToHexString(bytes).ToLowerInvariant()[..24];
    }
}

public static class EnvTime
{
    public static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");

    public static DateTime Now()
    {
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Ist);
    }
}

public static class SecurityTokenGenerator
{
    public static string CreateHexToken(int byteLength = 32)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public static class DeviceFingerprint
{
    public static string From(string? userAgent, string? clientIp)
    {
        var raw = $"{userAgent ?? string.Empty}|{clientIp}";
        var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
        return b64[..Math.Min(32, b64.Length)];
    }
}
