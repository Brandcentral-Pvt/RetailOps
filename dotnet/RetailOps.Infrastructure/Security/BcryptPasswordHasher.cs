using RetailOps.Application.Common;

namespace RetailOps.Infrastructure.Security;

public sealed class BcryptPasswordHasher : IPasswordHasher
{
    public string Hash(string password, int cost = 12) =>
        BCrypt.Net.BCrypt.HashPassword(password, cost);

    public bool Verify(string password, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }
}
