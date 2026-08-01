using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using RetailOps.Application.Common;

namespace RetailOps.Infrastructure.Email;

public sealed class SmtpSettings
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public bool Secure { get; set; } = false;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string From { get; set; } = "RetailOps Security <noreply@brandcentral.in>";
}

public sealed class SmtpEmailService : IEmailService
{
    private readonly SmtpSettings _settings;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IOptions<SmtpSettings> settings, ILogger<SmtpEmailService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        try
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(_settings.Host, _settings.Port, _settings.Secure ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto, cancellationToken);
            await client.AuthenticateAsync(_settings.User, _settings.Password, cancellationToken);

            var mime = new MimeMessage();
            mime.From.Add(MailboxAddress.Parse(_settings.From));
            mime.To.Add(MailboxAddress.Parse(message.To));
            mime.Subject = message.Subject;
            mime.Body = new BodyBuilder { HtmlBody = message.Html }.ToMessageBody();

            await client.SendAsync(mime, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Email delivery failed to {To}", message.To);
            throw;
        }
    }
}
