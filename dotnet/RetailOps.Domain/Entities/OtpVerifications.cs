using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class OtpVerifications
{
    public int Id { get; set; }

    public string UserId { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string OtpHash { get; set; } = null!;

    public string Purpose { get; set; } = null!;

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public int? Attempts { get; set; }

    public int? MaxAttempts { get; set; }

    public bool? IsUsed { get; set; }

    public DateTime? UsedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? CreatedAt { get; set; }
}
