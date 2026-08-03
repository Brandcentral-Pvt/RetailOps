using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PasswordResets
{
    public string Id { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public DateTime? CreatedAt { get; set; }
}
