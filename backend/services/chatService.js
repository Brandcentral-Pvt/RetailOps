/**
 * RetailOps messaging service — the permission-scoped chat engine.
 *
 * Visibility model (tenant-scoped):
 *  - Every conversation is anchored to a `SellerId`.
 *  - Global-role users (admin/super_admin/developer/operational_manager) can
 *    see every conversation.
 *  - Everyone else may only see / participate in conversations whose seller is
 *    among their own assigned sellers (replicated from auth middleware:
 *    their `UserSellers` plus the sellers of brand-managed users).
 *  - A direct chat can only be started between two users who share a seller.
 *
 * Realtime: new messages are pushed to participants over Socket.IO
 * (`chat:message`), reads via `chat:read`, typing via `chat:typing`.
 * Each message also produces an in-app notification per recipient, which the
 * existing notification pipeline delivers over Socket.IO and device push.
 *
 * Tables are auto-created on first use (same pattern as the push tokens table).
 */
const { sql, getPool, generateId, withTransaction } = require('../database/db');
const { isGlobalUserRole } = require('../utils/roleUtils');
const { buildInClause } = require('../utils/sqlHelpers');
const { createNotification } = require('../controllers/notificationController');
const pushService = require('./pushService');
const SocketService = require('../services/socketService');
const logger = require('../utils/logger');

const DIRECT = 'DIRECT';
const GROUP = 'GROUP';

// Every seller a user may access: own UserSellers + sellers of brand-managed users.
// Mirrors the `assignedSellers` logic in middleware/auth.js.
const ACCESS_CTE = `
WITH Access AS (
    SELECT DISTINCT t.UserId, t.SellerId
    FROM (
        SELECT UserId, SellerId FROM UserSellers
        UNION
        SELECT UBM.UserId AS UserId, US.SellerId AS SellerId
        FROM UserBrandManagers UBM
        JOIN UserSellers US ON US.UserId = UBM.BrandManagerId
    ) t
)
`;

let schemaPromise = null;

async function ensureSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            const pool = await getPool();
            await pool.request().query(`
                IF OBJECT_ID(N'dbo.ChatConversations', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.ChatConversations (
                        Id VARCHAR(24) NOT NULL CONSTRAINT PK_ChatConversations PRIMARY KEY,
                        Type NVARCHAR(10) NOT NULL,
                        Title NVARCHAR(200) NULL,
                        SellerId VARCHAR(24) NULL,
                        CreatedById VARCHAR(24) NOT NULL,
                        LastMessageId VARCHAR(24) NULL,
                        LastMessageAt DATETIME2 NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
                    );
                    CREATE INDEX IX_ChatConversations_Seller ON dbo.ChatConversations (SellerId);
                    CREATE INDEX IX_ChatConversations_LastMessage ON dbo.ChatConversations (LastMessageAt DESC);
                END
            `);
            await pool.request().query(`
                IF OBJECT_ID(N'dbo.ChatParticipants', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.ChatParticipants (
                        Id VARCHAR(24) NOT NULL CONSTRAINT PK_ChatParticipants PRIMARY KEY,
                        ConversationId VARCHAR(24) NOT NULL,
                        UserId VARCHAR(24) NOT NULL,
                        LastReadAt DATETIME2 NULL,
                        IsAdmin BIT NOT NULL DEFAULT 0,
                        JoinedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                        CONSTRAINT UQ_ChatParticipants UNIQUE (ConversationId, UserId)
                    );
                    CREATE INDEX IX_ChatParticipants_User ON dbo.ChatParticipants (UserId);
                END
            `);
            await pool.request().query(`
                IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.ChatMessages (
                        Id VARCHAR(24) NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY,
                        ConversationId VARCHAR(24) NOT NULL,
                        SenderId VARCHAR(24) NOT NULL,
                        Type NVARCHAR(10) NOT NULL DEFAULT 'TEXT',
                        Content NVARCHAR(MAX) NULL,
                        AttachmentUrl NVARCHAR(500) NULL,
                        AttachmentName NVARCHAR(255) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
                    );
                    CREATE INDEX IX_ChatMessages_Conversation ON dbo.ChatMessages (ConversationId, CreatedAt);
                END
            `);
        })().catch((err) => {
            schemaPromise = null;
            logger.error('Chat schema setup failed', { error: err.message });
            throw err;
        });
    }
    return schemaPromise;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function roleNameOf(user) {
    const raw = user?.role?.name || user?.role || '';
    return String(raw).toLowerCase();
}

function isGlobalUser(user) {
    return isGlobalUserRole(roleNameOf(user));
}

function userIdOf(user) {
    return user?.Id || user?._id;
}

function sellerSetOf(user) {
    return new Set((user?.assignedSellers || []).map((s) => (s?._id ?? s).toString()));
}

/** Accessible sellers for an arbitrary user id (any role). */
async function sellerSetForUser(userId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', sql.VarChar, userId)
        .query(`${ACCESS_CTE}
            SELECT DISTINCT SellerId FROM Access WHERE UserId = @userId`);
    return new Set(result.recordset.map((r) => String(r.SellerId)));
}

/** User ids that share a seller with the given user id. */
async function peerIdsForUser(userId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', sql.VarChar, userId)
        .query(`${ACCESS_CTE}
            SELECT DISTINCT aPeer.UserId
            FROM Access aMe
            JOIN Access aPeer ON aPeer.SellerId = aMe.SellerId AND aPeer.UserId <> aMe.UserId
            WHERE aMe.UserId = @userId`);
    return new Set(result.recordset.map((r) => r.UserId));
}

function toMessagePayload(m) {
    return {
        _id: m.Id,
        id: m.Id,
        conversationId: m.ConversationId,
        senderId: m.SenderId,
        senderName: m.SenderName || undefined,
        type: String(m.Type || 'TEXT').toUpperCase(),
        content: m.Content ?? '',
        attachmentUrl: m.AttachmentUrl || undefined,
        attachmentName: m.AttachmentName || undefined,
        createdAt: m.CreatedAt,
        readBy: Array.isArray(m.readBy) ? m.readBy : [],
    };
}

/** Participants of a set of conversations: conversationId -> [{...}] */
async function participantsFor(conversationIds) {
    if (conversationIds.length === 0) return {};
    const pool = await getPool();
    const request = pool.request();
    const inClause = buildInClause(request, 'conv', conversationIds);
    const result = await request.query(`
        SELECT cp.ConversationId, cp.UserId, cp.LastReadAt, cp.IsAdmin,
               u.FirstName, u.LastName, u.Avatar, r.Name AS RoleName
        FROM ChatParticipants cp
        JOIN Users u ON cp.UserId = u.Id
        LEFT JOIN Roles r ON u.RoleId = r.Id
        WHERE cp.ConversationId IN (${inClause})
    `);
    const grouped = {};
    for (const row of result.recordset) {
        if (!grouped[row.ConversationId]) grouped[row.ConversationId] = [];
        grouped[row.ConversationId].push({
            _id: row.UserId,
            name: `${row.FirstName || ''} ${row.LastName || ''}`.trim(),
            avatar: row.Avatar || undefined,
            roleName: row.RoleName || undefined,
            lastReadAt: row.LastReadAt,
            isAdmin: Boolean(row.IsAdmin),
        });
    }
    return grouped;
}

function conversationPayload(c, participants, lastMessageRow) {
    const lastMessage = lastMessageRow
        ? {
              _id: lastMessageRow.Id,
              senderId: lastMessageRow.SenderId,
              senderName: lastMessageRow.SenderName || undefined,
              type: String(lastMessageRow.Type || 'TEXT').toUpperCase(),
              content: lastMessageRow.Content ?? '',
              attachmentUrl: lastMessageRow.AttachmentUrl || undefined,
              attachmentName: lastMessageRow.AttachmentName || undefined,
              createdAt: lastMessageRow.CreatedAt,
          }
        : null;
    return {
        _id: c.Id,
        id: c.Id,
        type: String(c.Type || DIRECT).toUpperCase(),
        title: c.Title || null,
        sellerId: c.SellerId || null,
        createdById: c.CreatedById,
        lastMessage,
        unreadCount: Number(c.UnreadCount || 0),
        participants: participants || [],
        updatedAt: c.LastMessageAt || c.CreatedAt,
        createdAt: c.CreatedAt,
    };
}

/** Throw 403 unless the user may access a conversation anchored to `sellerId`. */
function assertSellerAccess(user, sellerId) {
    if (isGlobalUser(user)) return;
    if (!sellerId) {
        throw Object.assign(new Error('Conversation has no seller scope'), { status: 403 });
    }
    if (!sellerSetOf(user).has(sellerId.toString())) {
        throw Object.assign(new Error('You do not have access to this conversation'), { status: 403 });
    }
    return sellerId.toString();
}

async function fetchMyConversation(user, conversationId, withSeller) {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', sql.VarChar, conversationId)
        .input('me', sql.VarChar, userIdOf(user))
        .query(`
            SELECT c.* FROM ChatConversations c
            WHERE c.Id = @id
              AND EXISTS (SELECT 1 FROM ChatParticipants p
                          WHERE p.ConversationId = c.Id AND p.UserId = @me)
        `);
    const conversation = result.recordset[0];
    if (withSeller && !conversation) {
        throw Object.assign(new Error('Conversation not found'), { status: 404 });
    }
    return conversation;
}

// ── Contacts (permission-based) ─────────────────────────────────────────────

async function getContacts(user, search = '') {
    await ensureSchema();
    const pool = await getPool();
    const request = pool.request();
    const me = userIdOf(user);
    request.input('me', sql.VarChar, me);

    const searchTerm = search.trim();
    let where = '';
    if (searchTerm) {
        request.input('search', sql.NVarChar, `%${searchTerm}%`);
        where = `AND (u.FirstName LIKE @search OR u.LastName LIKE @search OR u.Email LIKE @search)`;
    }

    if (isGlobalUser(user)) {
        const result = await request.query(`
            SELECT DISTINCT u.Id, u.FirstName, u.LastName, u.Email, u.Avatar, r.Name AS RoleName
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId = r.Id
            WHERE u.Id <> @me AND ISNULL(u.IsActive, 1) = 1 ${where}
            ORDER BY u.FirstName, u.LastName
        `);
        return result.recordset.map((r) => ({
            _id: r.Id,
            name: `${r.FirstName || ''} ${r.LastName || ''}`.trim(),
            email: r.Email || undefined,
            avatar: r.Avatar || undefined,
            roleName: r.RoleName || undefined,
        }));
    }

    const result = await request.query(`
        ${ACCESS_CTE}
        SELECT DISTINCT u.Id, u.FirstName, u.LastName, u.Email, u.Avatar, r.Name AS RoleName
        FROM Access aMe
        JOIN Access aPeer ON aPeer.SellerId = aMe.SellerId AND aPeer.UserId <> aMe.UserId
        JOIN Users u ON u.Id = aPeer.UserId
        LEFT JOIN Roles r ON u.RoleId = r.Id
        WHERE aMe.UserId = @me AND ISNULL(u.IsActive, 1) = 1 ${where}
        ORDER BY u.FirstName, u.LastName
    `);
    return result.recordset.map((r) => ({
        _id: r.Id,
        name: `${r.FirstName || ''} ${r.LastName || ''}`.trim(),
        email: r.Email || undefined,
        avatar: r.Avatar || undefined,
        roleName: r.RoleName || undefined,
    }));
}

// ── Conversations ────────────────────────────────────────────────────────────

async function listConversations(user) {
    await ensureSchema();
    const pool = await getPool();
    const request = pool.request();
    const me = userIdOf(user);
    request.input('me', sql.VarChar, me);

    let sellerClause = '';
    if (!isGlobalUser(user)) {
        const mine = sellerSetOf(user);
        if (mine.size === 0) return [];
        sellerClause = `AND c.SellerId IN (${buildInClause(request, 'seller', [...mine])})`;
    }

    const result = await request.query(`
        SELECT c.*,
               (SELECT COUNT(*)
                  FROM ChatMessages cm
                  JOIN ChatParticipants cp0 ON cp0.ConversationId = cm.ConversationId
                 WHERE cm.ConversationId = c.Id
                   AND cm.SenderId <> @me
                   AND cp0.UserId = @me
                   AND (cp0.LastReadAt IS NULL OR cm.CreatedAt > cp0.LastReadAt)
               ) AS UnreadCount,
               lm.SenderId AS LastSenderId,
               sender.FirstName AS LastSenderFirstName,
               sender.LastName AS LastSenderLastName,
               lm.Type AS LastType,
               lm.Content AS LastContent,
               lm.AttachmentUrl AS LastAttachmentUrl,
               lm.AttachmentName AS LastAttachmentName,
               lm.CreatedAt AS LastCreatedAt
        FROM ChatConversations c
        JOIN ChatParticipants cpMe ON cpMe.ConversationId = c.Id AND cpMe.UserId = @me
        LEFT JOIN ChatMessages lm ON lm.Id = c.LastMessageId
        LEFT JOIN Users sender ON sender.Id = lm.SenderId
        WHERE 1 = 1 ${sellerClause}
        ORDER BY ISNULL(c.LastMessageAt, c.CreatedAt) DESC
    `);

    const ids = result.recordset.map((r) => r.Id);
    const participantMap = await participantsFor(ids);

    return result.recordset.map((row) => {
        const lastMsg = row.LastMessageId
            ? {
                  Id: row.LastMessageId,
                  SenderId: row.LastSenderId,
                  SenderName: `${row.LastSenderFirstName || ''} ${row.LastSenderLastName || ''}`.trim(),
                  Type: row.LastType,
                  Content: row.LastContent,
                  AttachmentUrl: row.LastAttachmentUrl,
                  AttachmentName: row.LastAttachmentName,
                  CreatedAt: row.LastCreatedAt,
              }
            : null;
        return conversationPayload(row, participantMap[row.Id] || [], lastMsg);
    });
}

async function findExistingDirect(userA, userB) {
    const pool = await getPool();
    const result = await pool.request()
        .input('a', sql.VarChar, userIdOf(userA))
        .input('b', sql.VarChar, userB)
        .query(`
            SELECT c.Id, c.Type, c.Title, c.SellerId, c.CreatedById,
                   c.LastMessageId, c.LastMessageAt, c.CreatedAt
            FROM ChatConversations c
            WHERE c.Type = 'DIRECT'
              AND EXISTS (SELECT 1 FROM ChatParticipants p1
                          WHERE p1.ConversationId = c.Id AND p1.UserId = @a)
              AND EXISTS (SELECT 1 FROM ChatParticipants p2
                          WHERE p2.ConversationId = c.Id AND p2.UserId = @b)
              AND (SELECT COUNT(*) FROM ChatParticipants p3 WHERE p3.ConversationId = c.Id) = 2
        `);
    return result.recordset[0];
}

async function createDirect(user, otherUserId) {
    await ensureSchema();
    const pool = await getPool();

    if (userIdOf(user) === otherUserId) {
        throw Object.assign(new Error('You cannot start a chat with yourself'), { status: 400 });
    }
    const otherResult = await pool.request()
        .input('id', sql.VarChar, otherUserId)
        .query(`SELECT Id, IsActive FROM Users WHERE Id = @id`);
    if (!otherResult.recordset.length) {
        throw Object.assign(new Error('User not found'), { status: 404 });
    }

    // Permission: both sides must share a seller (unless global user).
    const mine = sellerSetOf(user);
    const otherSellers = mine.size > 0
        ? await sellerSetForUser(otherUserId)
        : new Set(); // global user with no own sellers: fall back below
    let sharedSeller = null;

    if (isGlobalUser(user)) {
        const otherSet = await sellerSetForUser(otherUserId);
        sharedSeller = otherSet.values().next().value || null;
    } else {
        for (const s of mine) {
            if (otherSellers.has(s)) { sharedSeller = s; break; }
        }
    }
    if (!sharedSeller) {
        throw Object.assign(
            new Error('You can only message users who share a seller with you'),
            { status: 403 },
        );
    }

    const existing = await findExistingDirect(user, otherUserId);
    if (existing) {
        const participantMap = await participantsFor([existing.Id]);
        return conversationPayload(existing, participantMap[existing.Id] || [], null);
    }

    const conversationId = generateId();
    const myId = userIdOf(user);
    await withTransaction(async (tx) => {
        await tx.request()
            .input('id', sql.VarChar, conversationId)
            .input('type', sql.NVarChar, DIRECT)
            .input('title', sql.NVarChar, null)
            .input('sellerId', sql.VarChar, sharedSeller.toString())
            .input('createdBy', sql.VarChar, myId)
            .query(`
                INSERT INTO ChatConversations (Id, Type, Title, SellerId, CreatedById, CreatedAt)
                VALUES (@id, @type, @title, @sellerId, @createdBy, dbo.GetEnvDate())
            `);
        for (const participant of [myId, otherUserId]) {
            await tx.request()
                .input('pid', sql.VarChar, generateId())
                .input('convId', sql.VarChar, conversationId)
                .input('userId', sql.VarChar, participant)
                .query(`
                    INSERT INTO ChatParticipants (Id, ConversationId, UserId, IsAdmin, JoinedAt)
                    VALUES (@pid, @convId, @userId, 1, dbo.GetEnvDate())
                `);
        }
    });

    const createdResult = await pool.request()
        .input('id', sql.VarChar, conversationId)
        .query('SELECT * FROM ChatConversations WHERE Id = @id');
    const created = createdResult.recordset[0];
    const participantMap = await participantsFor([conversationId]);
    return conversationPayload(created, participantMap[conversationId] || [], null);
}

async function createGroup(user, { title, sellerId, participantIds = [] }) {
    await ensureSchema();
    const pool = await getPool();

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
        throw Object.assign(new Error('Group title is required'), { status: 400 });
    }
    if (!sellerId) {
        throw Object.assign(new Error('A group must be anchored to a seller'), { status: 400 });
    }
    const sellerKey = sellerId.toString();
    const members = [...new Set([userIdOf(user), ...participantIds.filter((x) => x && x !== userIdOf(user))])];
    if (members.length < 2) {
        throw Object.assign(new Error('A group needs at least one other member'), { status: 400 });
    }

    const creatorId = userIdOf(user);
    if (!isGlobalUser(user) && !sellerSetOf(user).has(sellerKey)) {
        throw Object.assign(new Error('You do not have access to this seller'), { status: 403 });
    }

    // Every member must have access to the anchor seller.
    const memberResult = await pool.request()
        .input('sellerId', sql.VarChar, sellerKey)
        .query(`${ACCESS_CTE}
            SELECT DISTINCT Access.UserId FROM Access WHERE Access.SellerId = @sellerId`);
    const allowed = new Set(memberResult.recordset.map((r) => r.UserId));
    if (!allowed.has(creatorId)) allowed.add(creatorId); // global creator always allowed
    const validMembers = members.filter((m) => allowed.has(m));
    if (validMembers.length < 2) {
        throw Object.assign(new Error('Group members must have access to the seller'), { status: 403 });
    }

    const conversationId = generateId();
    await withTransaction(async (tx) => {
        await tx.request()
            .input('id', sql.VarChar, conversationId)
            .input('type', sql.NVarChar, GROUP)
            .input('title', sql.NVarChar, cleanTitle)
            .input('sellerId', sql.VarChar, sellerKey)
            .input('createdBy', sql.VarChar, creatorId)
            .query(`
                INSERT INTO ChatConversations (Id, Type, Title, SellerId, CreatedById, CreatedAt)
                VALUES (@id, @type, @title, @sellerId, @createdBy, dbo.GetEnvDate())
            `);
        for (const member of validMembers) {
            await tx.request()
                .input('pid', sql.VarChar, generateId())
                .input('convId', sql.VarChar, conversationId)
                .input('userId', sql.VarChar, member)
                .query(`
                    INSERT INTO ChatParticipants (Id, ConversationId, UserId, IsAdmin, JoinedAt)
                    VALUES (@pid, @convId, @userId, 1, dbo.GetEnvDate())
                `);
        }
    });

    const createdResult = await pool.request()
        .input('id', sql.VarChar, conversationId)
        .query('SELECT * FROM ChatConversations WHERE Id = @id');
    const created = createdResult.recordset[0];
    const participantMap = await participantsFor([conversationId]);
    return conversationPayload(created, participantMap[conversationId] || [], null);
}

// ── Messages ────────────────────────────────────────────────────────────────

async function listMessages(user, conversationId, { beforeId, beforeAt, limit = 50 } = {}) {
    await ensureSchema();
    const conversation = await fetchMyConversation(user, conversationId, true);
    assertSellerAccess(user, conversation.SellerId);

    const pool = await getPool();
    const request = pool.request();
    request.input('convId', sql.VarChar, conversationId);
    request.input('msgLimit', sql.Int, Math.min(Math.max(parseInt(limit) || 50, 1), 200));

    let cursorWhere = '';
    if (beforeId && beforeAt) {
        request.input('beforeId', sql.VarChar, beforeId);
        request.input('beforeAt', sql.DateTime2, new Date(beforeAt));
        cursorWhere = 'AND (m.CreatedAt < @beforeAt OR (m.CreatedAt = @beforeAt AND m.Id < @beforeId))';
    } else if (beforeId) {
        request.input('beforeId', sql.VarChar, beforeId);
        cursorWhere = 'AND m.Id < @beforeId';
    }

    const result = await request.query(`
        SELECT TOP (@msgLimit) m.*, u.FirstName, u.LastName
        FROM ChatMessages m
        LEFT JOIN Users u ON u.Id = m.SenderId
        WHERE m.ConversationId = @convId ${cursorWhere}
        ORDER BY m.CreatedAt DESC, m.Id DESC
    `);
    const rows = result.recordset.reverse();

    const participantMap = await participantsFor([conversationId]);
    const participants = participantMap[conversationId] || [];
    const messages = rows.map((m) => {
        const readBy = participants
            .filter((p) => p._id !== m.SenderId && p.lastReadAt && new Date(m.CreatedAt) <= new Date(p.lastReadAt))
            .map((p) => p._id);
        return toMessagePayload({ ...m, SenderName: `${m.FirstName || ''} ${m.LastName || ''}`.trim(), readBy });
    });

    return { messages, participants, hasMore: rows.length >= Math.min(Math.max(parseInt(limit) || 50, 1), 200) };
}

async function sendMessage(user, conversationId, { content, type, attachmentUrl, attachmentName }) {
    await ensureSchema();
    const conversation = await fetchMyConversation(user, conversationId, true);
    assertSellerAccess(user, conversation.SellerId);

    const cleanContent = String(content || '');
    let resolvedType = (type || '').toString().toUpperCase();
    if (resolvedType !== 'TEXT' && resolvedType !== 'IMAGE' && resolvedType !== 'FILE') {
        resolvedType = attachmentUrl ? 'IMAGE' : 'TEXT';
    }
    if (resolvedType === 'TEXT' && !cleanContent.trim()) {
        throw Object.assign(new Error('Message cannot be empty'), { status: 400 });
    }
    if (resolvedType !== 'TEXT' && !attachmentUrl) {
        throw Object.assign(new Error('Attachment URL is required'), { status: 400 });
    }

    const pool = await getPool();
    const messageId = generateId();
    const senderId = userIdOf(user);
    await withTransaction(async (tx) => {
        await tx.request()
            .input('id', sql.VarChar, messageId)
            .input('convId', sql.VarChar, conversationId)
            .input('senderId', sql.VarChar, senderId)
            .input('type', sql.NVarChar, resolvedType)
            .input('content', sql.NVarChar, cleanContent)
            .input('attachmentUrl', sql.NVarChar, attachmentUrl || null)
            .input('attachmentName', sql.NVarChar, attachmentName || null)
            .query(`
                INSERT INTO ChatMessages (Id, ConversationId, SenderId, Type, Content, AttachmentUrl, AttachmentName, CreatedAt)
                VALUES (@id, @convId, @senderId, @type, @content, @attachmentUrl, @attachmentName, dbo.GetEnvDate())
            `);
        await tx.request()
            .input('mid', sql.VarChar, messageId)
            .input('convId', sql.VarChar, conversationId)
            .query('UPDATE ChatConversations SET LastMessageId = @mid, LastMessageAt = dbo.GetEnvDate() WHERE Id = @convId');
        // Sender's own LastReadAt follows the send.
        await tx.request()
            .input('convId', sql.VarChar, conversationId)
            .input('senderId', sql.VarChar, senderId)
            .query('UPDATE ChatParticipants SET LastReadAt = dbo.GetEnvDate() WHERE ConversationId = @convId AND UserId = @senderId');
    });

    const senderName = `${user.FirstName || user.firstName || ''} ${user.LastName || user.lastName || ''}`.trim() || 'Someone';

    const msgResult = await pool.request()
        .input('id', sql.VarChar, messageId)
        .query('SELECT * FROM ChatMessages WHERE Id = @id');
    const payload = toMessagePayload({ ...msgResult.recordset[0], SenderName: senderName, readBy: [] });

    const participantResult = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('senderId', sql.VarChar, senderId)
        .query('SELECT UserId FROM ChatParticipants WHERE ConversationId = @convId AND UserId <> @senderId');

    for (const row of participantResult.recordset) {
        SocketService.emitToUser(row.UserId, 'chat:message', { conversationId, message: payload });

        try {
            await createNotification(
                row.UserId,
                'CHAT',
                'ChatMessage',
                conversationId,
                `${senderName}: ${cleanContent.slice(0, 140) || (resolvedType === 'IMAGE' ? 'Image' : 'Attachment')}`,
            );
        } catch (notifErr) {
            logger.warn('Chat notification failed', { error: notifErr.message });
        }

        // Device push (Expo Push Service) for the recipient.
        try {
            await pushService.sendPush(row.UserId, {
                title: senderName,
                body: cleanContent.slice(0, 140) || (resolvedType === 'IMAGE' ? 'Image' : 'Attachment'),
                data: { type: 'message', conversationId, messageId, senderId },
            });
        } catch (pushErr) {
            logger.warn('Chat push failed', { error: pushErr.message });
        }
    }

    return payload;
}

async function markRead(user, conversationId) {
    await ensureSchema();
    const pool = await getPool();
    const me = userIdOf(user);

    await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('me', sql.VarChar, me)
        .query('UPDATE ChatParticipants SET LastReadAt = dbo.GetEnvDate() WHERE ConversationId = @convId AND UserId = @me');

    const unreadResult = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('me', sql.VarChar, me)
        .query(`
            SELECT COUNT(*) AS Unread
            FROM ChatMessages cm
            JOIN ChatParticipants cp ON cp.ConversationId = cm.ConversationId
            WHERE cm.ConversationId = @convId
              AND cm.SenderId <> @me
              AND cp.UserId = @me
              AND (cp.LastReadAt IS NULL OR cm.CreatedAt > cp.LastReadAt)
        `);
    const unreadCount = Number(unreadResult.recordset[0]?.Unread || 0);

    const lastReadResult = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('me', sql.VarChar, me)
        .query('SELECT LastReadAt FROM ChatParticipants WHERE ConversationId = @convId AND UserId = @me');
    const lastReadAt = lastReadResult.recordset[0]?.LastReadAt || new Date();

    const notifyResult = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('me', sql.VarChar, me)
        .query('SELECT UserId FROM ChatParticipants WHERE ConversationId = @convId AND UserId <> @me');

    for (const row of notifyResult.recordset) {
        SocketService.emitToUser(row.UserId, 'chat:read', {
            conversationId,
            userId: me,
            lastReadAt,
        });
    }

    return { unreadCount, lastReadAt };
}

async function getUnreadTotal(user) {
    await ensureSchema();
    const pool = await getPool();
    const request = pool.request();
    const me = userIdOf(user);
    request.input('me', sql.VarChar, me);

    let sellerClause = '';
    if (!isGlobalUser(user)) {
        const mine = sellerSetOf(user);
        if (mine.size === 0) return 0;
        sellerClause = `AND c.SellerId IN (${buildInClause(request, 'seller', [...mine])})`;
    }

    const result = await request.query(`
        SELECT ISNULL(SUM(c.Unread), 0) AS Total
        FROM (
            SELECT c.Id,
                   (SELECT COUNT(*)
                      FROM ChatMessages cm
                      JOIN ChatParticipants cp0 ON cp0.ConversationId = cm.ConversationId
                     WHERE cm.ConversationId = c.Id
                       AND cm.SenderId <> @me
                       AND cp0.UserId = @me
                       AND (cp0.LastReadAt IS NULL OR cm.CreatedAt > cp0.LastReadAt)
                   ) AS Unread
            FROM ChatConversations c
            JOIN ChatParticipants cpMe ON cpMe.ConversationId = c.Id AND cpMe.UserId = @me
            WHERE 1 = 1 ${sellerClause}
        ) c
    `);
    return Number(result.recordset[0]?.Total || 0);
}

module.exports = {
    ensureSchema,
    getContacts,
    listConversations,
    createDirect,
    createGroup,
    listMessages,
    sendMessage,
    markRead,
    getUnreadTotal,
};