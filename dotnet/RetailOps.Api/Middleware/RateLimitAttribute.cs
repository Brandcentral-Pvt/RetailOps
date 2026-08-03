using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RetailOps.Infrastructure.Security;

namespace RetailOps.Api.Middleware;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RateLimitAttribute : Attribute, IAsyncActionFilter
{
    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> Store = new();

    private readonly string _scope;
    private readonly int _max;
    private readonly TimeSpan _window;
    private readonly string _messageJson;

    public RateLimitAttribute(string scope, int max, int windowSeconds, string messageJson)
    {
        _scope = scope;
        _max = max;
        _window = TimeSpan.FromSeconds(windowSeconds);
        _messageJson = messageJson;
    }

    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        var userId = http.User?.FindFirst(TokenService.UserIdClaim)?.Value;
        var identity = userId ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var key = $"{_scope}:{identity}";
        var now = DateTime.UtcNow;

        var (count, _) = Store.AddOrUpdate(key,
            _ => (1, now),
            (_, entry) => now - entry.WindowStart >= _window ? (1, now) : (entry.Count + 1, entry.WindowStart));

        if (count > _max)
        {
            context.Result = new JsonResult(JsonSerializer.Deserialize<object>(_messageJson)) { StatusCode = 429 };
            return Task.CompletedTask;
        }

        return next();
    }
}
