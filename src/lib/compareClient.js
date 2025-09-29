// src/lib/compareClient.js
const cache = new Map();      // key -> { price, url, image_url, reliablePrice, reliableStock, offer_id, ... } | null
const inflight = new Map();   // key -> Promise
const queue = [];
let running = 0;
const MAX_CONCURRENCY = 6;

export function getCachedCompare(key) {
  return cache.get(key);
}

export function prewarmCompare(key, fetcher) {
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const job = () =>
    fetcher(key)
      .then((res) => {
        cache.set(key, res);
        return res;
      })
      .catch(() => {
        cache.set(key, null);
        return null;
      })
      .finally(() => {
        running--;
        runQueue(fetcher);
      });

  const p = new Promise((resolve) => {
    queue.push({ key, resolve, job });
    runQueue(fetcher);
  });
  inflight.set(key, p);
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

