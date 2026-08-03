namespace RetailOps.Infrastructure.Security;

public sealed class JwtSettings
{
    public const string SectionName = "Jwt";

    public string AccessSecret { get; set; } = string.Empty;
    public string RefreshSecret { get; set; } = string.Empty;
    public string AccessExpiry { get; set; } = "2h";
    public string RefreshExpiry { get; set; } = "7d";
    public string TempExpiry { get; set; } = "10m";
}
