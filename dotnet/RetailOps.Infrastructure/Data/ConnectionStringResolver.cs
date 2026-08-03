namespace RetailOps.Infrastructure.Data;

public static class ConnectionStringResolver
{
    public static string Resolve()
    {
        string? connectionString = Environment.GetEnvironmentVariable("RetailOps__ConnectionStrings__Default");

        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            return connectionString;
        }

        string server = Environment.GetEnvironmentVariable("DB_SERVER") ?? "31.92.67.95";
        string database = Environment.GetEnvironmentVariable("DB_NAME") ?? "retailops"; 
        string user = Environment.GetEnvironmentVariable("DB_USER") ?? "sa";
        string password = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "YourStrong@Passw0rd";
        string port = Environment.GetEnvironmentVariable("DB_PORT") ?? "1433";
        string encrypt = Environment.GetEnvironmentVariable("DB_ENCRYPT") ?? "false";

        return $"Server={server},{port};Database={database};User Id={user};Password={password};Encrypt={encrypt};TrustServerCertificate=True";
    }
}
