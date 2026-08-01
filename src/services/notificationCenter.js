const listeners = new Map();
let idCounter = 0;

const notificationCenter = {
  subscribe(event, callback) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
    return () => {
      const arr = listeners.get(event);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  },

  notify({ type, taskId, message, data }) {
    const id = ++idCounter;
    const entry = { id, type, taskId, message, data, timestamp: new Date().toISOString() };
    const cbs = listeners.get(type) || [];
    cbs.forEach(cb => cb(entry));
    const allCbs = listeners.get('*') || [];
    allCbs.forEach(cb => cb(entry));
    return id;
  },

  getListeners() {
    return listeners;
  },
};

export default notificationCenter;
