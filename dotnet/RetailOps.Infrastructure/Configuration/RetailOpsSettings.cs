namespace RetailOps.Infrastructure.Configuration;

public sealed class RetailOpsSettings
{
    public const string SectionName = "RetailOps";

    public string DashboardUrl { get; set; } = "https://data.brandcentral.in";
}
