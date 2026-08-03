using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class OtpAuditLog
{
    public long Id { get; set; }

    public string? UserId { get; set; }

    public string Email { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? Reason { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime? CreatedAt { get; set; }
}
