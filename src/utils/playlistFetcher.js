// Helper to dynamically fetch live YouTube playlist tracks without redeploying
export async function fetchLiveYouTubePlaylist(playlistId, existingTracks = []) {
  if (!playlistId) return null;

  // 1. Try public Invidious instances (Returns ALL items in playlist without 15-item limit)
  const invidiousInstances = [
    'https://invidious.flokinet.to',
    'https://invidious.privacydev.net',
    'https://inv.tux.pizza',
    'https://invidious.drgns.space',
    'https://invidious.nerdvpn.de',
  ];

  for (const domain of invidiousInstances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${domain}/api/v1/playlists/${playlistId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      const videos = data.videos;

      if (Array.isArray(videos) && videos.length > 0) {
        return videos.map((v) => ({
          id: `yt-${v.videoId}`,
          title: v.title,
          subtitle: v.author || 'YouTube Music',
          videoId: v.videoId,
          durationLabel: 'YouTube Track',
          sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        }));
      }
    } catch (e) { }
  }

  // 2. Fallback: YouTube RSS feed
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(proxyUrl, {
        cache: 'no-cache',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const xml = await res.text();

      const entries = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(xml)) !== null) {
        const entryXml = match[1];
        const videoIdMatch = /<yt:videoId>(.*?)<\/yt:videoId>/.exec(entryXml);
        const titleMatch = /<title>(.*?)<\/title>/.exec(entryXml);
        const authorMatch = /<name>(.*?)<\/name>/.exec(entryXml);

        if (videoIdMatch && titleMatch) {
          entries.push({
            id: `yt-${videoIdMatch[1]}`,
            title: titleMatch[1],
            subtitle: authorMatch ? authorMatch[1] : 'YouTube Music',
            videoId: videoIdMatch[1],
            durationLabel: 'YouTube Track',
            sourceUrl: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
          });
        }
      }

      if (entries.length > 0) {
        if (existingTracks && existingTracks.length > 0) {
          const fetchedIds = new Set(entries.map((e) => e.videoId));
          const remainingExisting = existingTracks.filter((t) => !fetchedIds.has(t.videoId));
          return [...entries, ...remainingExisting];
        }
        return entries;
      }
    } catch (e) { }
  }

  return null;
}
