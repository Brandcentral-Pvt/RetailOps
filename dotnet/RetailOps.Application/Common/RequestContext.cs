namespace RetailOps.Application.Common;

public sealed record RequestContext(
    string ClientIp,
    string? UserAgent,
    string? Platform,
    string? Authorization,
    string? XForwardedFor);

public static class RequestContextFactory
{
    public static RequestContext From(
        string? clientIp,
        string? userAgent,
        string? platform,
        string? authorization,
        string? xForwardedFor)
    {
        string resolvedIp = ResolveClientIp(xForwardedFor, clientIp);
        return new RequestContext(resolvedIp, userAgent, platform, authorization, xForwardedFor);
    }

    public static string ResolveClientIp(string? xForwardedFor, string? remoteIp)
    {
        var ip = !string.IsNullOrWhiteSpace(xForwardedFor)
            ? xForwardedFor.Split(',')[0].Trim()
            : remoteIp ?? "unknown";
        return ip;
    }
}
