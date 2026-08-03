namespace RetailOps.Application.Common;

public sealed record EmailMessage(string To, string Subject, string Html);

public interface IEmailService
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
