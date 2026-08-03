namespace RetailOps.Application.Common;

public interface IPasswordHasher
{
    string Hash(string password, int cost = 12);
    bool Verify(string password, string hash);
}
