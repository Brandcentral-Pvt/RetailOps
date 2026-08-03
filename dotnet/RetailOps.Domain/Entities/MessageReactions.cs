using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class MessageReactions
{
    public long Id { get; set; }

    public string MessageId { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public string Emoji { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public virtual Messages Message { get; set; } = null!;

    public virtual Users User { get; set; } = null!;
}
