// Web Worker to prevent mobile background timer throttling when screen turns off
export function createBackgroundHeartbeatWorker(onTick) {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return { start: () => {}, stop: () => {} };
  }

  const workerCode = `
    let timer = null;
    self.onmessage = function(e) {
      if (e.data === 'start') {
        if (!timer) {
          timer = setInterval(function() {
            self.postMessage('tick');
          }, 300);
        }
      } else if (e.data === 'stop') {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };
  `;

  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => {
      if (typeof onTick === 'function') onTick();
    };
    return {
      start: () => { try { worker.postMessage('start'); } catch (e) {} },
      stop: () => { try { worker.postMessage('stop'); } catch (e) {} },
    };
  } catch (err) {
    return { start: () => {}, stop: () => {} };
  }
}
