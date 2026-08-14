const cacheName = "zona7-map-images-v1";
const activeObjectUrls = new Map<string, string>();

function cacheRequest(key: string) {
  return new Request(new URL(`/__zona7_cache__/maps/${encodeURIComponent(key)}`, window.location.origin));
}

function rememberObjectUrl(key: string, blob: Blob) {
  const previous = activeObjectUrls.get(key);
  if (previous) return previous;
  const objectUrl = URL.createObjectURL(blob);
  activeObjectUrls.set(key, objectUrl);
  return objectUrl;
}

export async function resolveCachedMapImage(key: string, sourceUrl?: string | null) {
  if (!key) return sourceUrl ?? null;
  const active = activeObjectUrls.get(key);
  if (active) return active;
  if (!("caches" in window)) return sourceUrl ?? null;
  try {
    const cache = await window.caches.open(cacheName);
    const request = cacheRequest(key);
    const cached = await cache.match(request);
    if (cached) return rememberObjectUrl(key, await cached.blob());
    if (!sourceUrl) return null;
    const response = await fetch(sourceUrl, { cache: "force-cache" });
    if (!response.ok) return sourceUrl;
    const blob = await response.blob();
    await cache.put(
      request,
      new Response(blob, {
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-type": blob.type || "image/webp",
        },
      }),
    );
    return rememberObjectUrl(key, blob);
  } catch {
    return sourceUrl ?? null;
  }
}

export async function storeMapImage(key: string, file: Blob) {
  if (!key) return URL.createObjectURL(file);
  const previous = activeObjectUrls.get(key);
  if (previous) {
    URL.revokeObjectURL(previous);
    activeObjectUrls.delete(key);
  }
  if ("caches" in window) {
    try {
      const cache = await window.caches.open(cacheName);
      await cache.put(
        cacheRequest(key),
        new Response(file, {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": file.type || "image/webp",
          },
        }),
      );
    } catch {
      // O object URL abaixo mantém o mapa disponível na sessão mesmo sem Cache Storage.
    }
  }
  return rememberObjectUrl(key, file);
}
