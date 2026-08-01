using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class TrustedDevices
{
    public int Id { get; set; }

    public string UserId { get; set; } = null!;

    public string DeviceFingerprint { get; set; } = null!;

    public string? DeviceName { get; set; }

    public string? IpAddress { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public bool? IsRevoked { get; set; }
}
