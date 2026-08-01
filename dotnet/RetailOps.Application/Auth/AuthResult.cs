using System.Collections;
using System.Reflection;

namespace RetailOps.Application.Auth;

public sealed class AuthResult
{
    public int StatusCode { get; init; } = 200;
    public bool Success { get; init; }
    public object? Payload { get; init; }

    public static AuthResult Ok(object payload) => new() { StatusCode = 200, Success = true, Payload = payload };

    public static AuthResult Fail(string message, int statusCode = 400) =>
        new() { StatusCode = statusCode, Success = false, Payload = new { success = false, message } };

    public static AuthResult Fail(string message, int statusCode, object? extra) =>
        new()
        {
            StatusCode = statusCode,
            Success = false,
            Payload = Merge(new { success = false, message }, extra)
        };

    private static Dictionary<string, object?> Merge(object baseObj, object? extra)
    {
        var dict = new Dictionary<string, object?>();
        foreach (var prop in baseObj.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            dict[prop.Name] = prop.GetValue(baseObj);
        }
        if (extra is not null)
        {
            foreach (var prop in extra.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                dict[prop.Name] = prop.GetValue(extra);
            }
        }
        return dict;
    }
}
