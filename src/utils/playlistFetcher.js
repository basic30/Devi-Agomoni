// Dynamic YouTube Playlist Live Fetcher
// Live-fetches tracks directly from YouTube playlist without any manual code edits.

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return total > 0 ? `${mins}:${secs}` : 'YouTube Track';
}

export function getCachedPlaylist(playlistId) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('yt_pl_cache_' + playlistId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { }
  return [];
}

async function fetchFromInvidious(domain, playlistId) {
  const res = await fetch(`${domain}/api/v1/playlists/${playlistId}`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`${domain} responded with HTTP ${res.status}`);
  const data = await res.json();
  const videos = data?.videos;
  if (!Array.isArray(videos) || videos.length === 0) {
    throw new Error(`${domain} returned empty videos`);
  }
  return videos.map((v) => {
    const duration = v.lengthSeconds || 0;
    return {
      id: `yt-${v.videoId}`,
      title: v.title,
      subtitle: (v.author || 'Devi Agomoni').replace(/\s*-\s*Topic$/i, '').trim(),
      videoId: v.videoId,
      duration: duration,
      durationLabel: formatDuration(duration),
      cover: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
      sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
    };
  });
}

async function fetchFromLocalProxy(playlistId) {
  const localRes = await fetch(`/api/playlist-feed?id=${playlistId}`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!localRes.ok) throw new Error('Local dev proxy unavailable');
  const xml = await localRes.text();
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  const feedTracks = [];
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const vIdMatch = /<yt:videoId>(.*?)<\/yt:videoId>/.exec(entryXml);
    const titleMatch = /<title>(.*?)<\/title>/.exec(entryXml);
    const authorMatch = /<name>(.*?)<\/name>/.exec(entryXml);
    if (vIdMatch && titleMatch) {
      const vId = vIdMatch[1];
      feedTracks.push({
        id: `yt-${vId}`,
        title: titleMatch[1],
        subtitle: (authorMatch ? authorMatch[1] : 'YouTube Music').replace(/\s*-\s*Topic$/i, '').trim(),
        videoId: vId,
        duration: 0,
        durationLabel: 'YouTube Track',
        cover: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
        sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
      });
    }
  }
  if (feedTracks.length === 0) throw new Error('Empty RSS feed');
  return feedTracks;
}

export async function fetchLiveYouTubePlaylist(playlistId, existingTracks = []) {
  if (!playlistId) return existingTracks || [];

  const cacheKey = 'yt_pl_cache_' + playlistId;

  // Race multiple healthy live endpoints concurrently for maximum speed and uptime
  const fetchers = [
    fetchFromInvidious('https://invidious.f5.si', playlistId),
    fetchFromInvidious('https://inv.nadeko.net', playlistId),
  ];

  // If local dev server is active, include local dev proxy
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    fetchers.push(fetchFromLocalProxy(playlistId));
  }

  try {
    const liveTracks = await Promise.any(fetchers);
    if (Array.isArray(liveTracks) && liveTracks.length > 0) {
      // Persist to local cache for instant future loads
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(liveTracks));
          localStorage.setItem('yt_pl_time_' + playlistId, String(Date.now()));
        } catch (e) { }
      }
      return liveTracks;
    }
  } catch (err) {
    console.warn('Live YouTube playlist fetch failed, using fallback:', err);
  }

  // Fallback to cached tracks or existing tracks if all network requests fail
  const cached = getCachedPlaylist(playlistId);
  if (cached.length > 0) return cached;
  return existingTracks || [];
}
