const sseClients = [];

function sendSseEvent(eventName, data) {
  const payload = `data: ${JSON.stringify({ event: eventName, data })}\n\n`;
  sseClients.forEach(res => {
    try { res.write(payload); } catch (e) { }
  });
}

function addSseClient(res) {
  sseClients.push(res);
}

function removeSseClient(res) {
  const idx = sseClients.indexOf(res);
  if (idx !== -1) sseClients.splice(idx, 1);
}

module.exports = { sendSseEvent, addSseClient, removeSseClient };
