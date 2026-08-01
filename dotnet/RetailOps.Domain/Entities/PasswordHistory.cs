using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PasswordHistory
{
    public string Id { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public DateTime? ChangedAt { get; set; }
}
