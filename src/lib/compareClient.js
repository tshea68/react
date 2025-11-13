// src/lib/compareClient.js

// Normalize MPN the same way backend expects.
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const cache = new Map();      // normKey -> result | null
const inflight = new Map();   // normKey -> Promise
const queue = [];
let running = 0;
const MAX_CONCURRENCY = 6;

export function getCachedCompare(key) {
  const k = norm(key);
  return cache.get(k);
}

export function prewarmCompare(key, fetcher) {
  const normKey = norm(key);
  if (!normKey) return Promise.resolve(null);

  // Hit cache → immediate result
  if (cache.has(normKey)) return Promise.resolve(cache.get(normKey));

  // Already fetching → return its promise
  if (inflight.has(normKey)) return inflight.get(normKey);

  // Build job
  const job = () =>
    fetcher(normKey)
      .then((res) => {
        cache.set(normKey, res);
        return res;
      })
      .catch(() => {
        cache.set(normKey, null);
        return null;
      })
      .finally(() => {
        running--;
        runQueue(fetcher);
      });

  // Wrap in promise for queue coordination
  const p = new Promise((resolve) => {
    queue.push({
      key: normKey,
      resolve,
      job,
    });
    runQueue(fetcher);
  });

  inflight.set(normKey, p);
  return p;
}

function runQueue(fetcher) {
  while (running < MAX_CONCURRENCY && queue.length) {
    const { key, resolve, job } = queue.shift();
    running++;

    job().then((res) => {
      inflight.delete(key);
      resolve(res);
    });
  }
}
