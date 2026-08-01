using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ConversationParticipants
{
    public string ConversationId { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public DateTime? JoinedAt { get; set; }

    public virtual Conversations Conversation { get; set; } = null!;

    public virtual Users User { get; set; } = null!;
}
