export function createSequenceController({ onCancel } = {}) {
  let active = null;
  let sequenceId = 0;

  function cancelActive() {
    if (!active) return;
    active.controller.abort();
    onCancel?.(active.label);
    active = null;
  }

  function start(label = '') {
    cancelActive();
    sequenceId += 1;
    const controller = new AbortController();
    const id = sequenceId;
    active = { id, label, controller };
    return {
      id,
      label,
      signal: controller.signal,
      isCurrent: () => active?.id === id && !controller.signal.aborted
    };
  }

  return {
    start,
    cancel: cancelActive
  };
}

export function wait(ms, signal) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise(resolve => {
    const timeoutId = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId);
          resolve();
        },
        { once: true }
      );
    }
  });
}
