using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Messages
{
    public string Id { get; set; } = null!;

    public string ConversationId { get; set; } = null!;

    public string SenderId { get; set; } = null!;

    public string? Type { get; set; }

    public string? Content { get; set; }

    public string? FileUrl { get; set; }

    public string? ReplyToId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? Reactions { get; set; }

    public virtual Conversations Conversation { get; set; } = null!;

    public virtual ICollection<MessageReactions> MessageReactions { get; set; } = new List<MessageReactions>();

    public virtual ICollection<MessageStatus> MessageStatus { get; set; } = new List<MessageStatus>();

    public virtual Users Sender { get; set; } = null!;
}
