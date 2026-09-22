/**
 * Chat socket handlers — realtime relay for typing indicator.
 *
 * Message delivery and read receipts are pushed server-side via
 * SocketService.emitToUser; typing is client → server → participants.
 * Registered from server.js inside the io.on('connection') block,
 * right after the socket joins its personal room.
 */
const { sql, getPool } = require('../database/db');

async function emitTypingToOtherParticipants(io, socket, conversationId) {
    if (!conversationId || !socket.userId) return;
    const pool = await getPool();
    const result = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('senderId', sql.VarChar, socket.userId)
        .query(`
            SELECT UserId FROM ChatParticipants
            WHERE ConversationId = @convId AND UserId <> @senderId
        `);
    for (const row of result.recordset) {
        io.to(row.UserId.toString()).emit('chat:typing', {
            conversationId,
            senderId: socket.userId,
        });
    }
}

module.exports = {
    register(socket, io) {
        socket.on('chat:typing', (data) => {
            emitTypingToOtherParticipants(io, socket, data?.conversationId).catch((err) => {
                console.error('chat:typing relay error:', err.message);
            });
        });
    },
};