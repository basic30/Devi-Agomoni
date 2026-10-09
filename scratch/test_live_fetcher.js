async function testLiveFetcher() {
  const playlistId = 'PLU7X6UN1WmZ4';
  const instances = [
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
  ];

  for (const domain of instances) {
    try {
      console.log('Fetching live from:', domain);
      const res = await fetch(`${domain}/api/v1/playlists/${playlistId}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const videos = data.videos;
      if (Array.isArray(videos) && videos.length > 0) {
        const tracks = videos.map((v, i) => {
          const duration = v.lengthSeconds || 0;
          const mins = Math.floor(duration / 60);
          const secs = String(duration % 60).padStart(2, '0');
          return {
            id: `old-${v.videoId}`,
            title: v.title,
            subtitle: (v.author || 'Devi Agomoni').replace(/\s*-\s*Topic$/i, '').trim(),
            videoId: v.videoId,
            duration: duration,
            durationLabel: duration > 0 ? `${mins}:${secs}` : 'YouTube Track',
            cover: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
            sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          };
        });
        console.log(`SUCCESS! Live fetched ${tracks.length} songs from ${domain}!`);
        console.log('First track:', tracks[0]);
        console.log('Last track:', tracks[tracks.length - 1]);
        return tracks;
      }
    } catch (e) {
      console.log('Failed domain:', domain, e.message);
    }
  }
}
testLiveFetcher();
