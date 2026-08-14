// Helper to dynamically fetch live YouTube playlist tracks without redeploying
export async function fetchLiveYouTubePlaylist(playlistId, existingTracks = []) {
  if (!playlistId) return null;

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

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
        // YouTube RSS feed has a hard limit of 15 entries.
        // Merge with existing tracks so tracks #16+ are preserved.
        if (existingTracks && existingTracks.length > 0) {
          const fetchedIds = new Set(entries.map((e) => e.videoId));
          const remainingExisting = existingTracks.filter((t) => !fetchedIds.has(t.videoId));
          return [...entries, ...remainingExisting];
        }
        return entries;
      }
    } catch (e) {}
  }
  return null;
}

