const listeners = {};

export function emit(event) {
  (listeners[event] || []).forEach((fn) => fn());
}

export function onEvent(event, fn) {
  listeners[event] = listeners[event] || [];
  listeners[event].push(fn);
  return () => {
    listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
  };
}
