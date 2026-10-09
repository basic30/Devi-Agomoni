async function testEndpoints() {
  const playlistId = 'PLU7X6UN1WmZ4';
  
  // Piped instances
  const piped = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacy.com.de',
    'https://piped-api.lunar.icu',
    'https://pipedapi.leptons.xyz',
    'https://api.piped.yt'
  ];

  for (const p of piped) {
    try {
      const res = await fetch(`${p}/playlists/${playlistId}`, { signal: AbortSignal.timeout(3000) });
      console.log('Piped', p, res.status);
      if (res.ok) {
        const d = await res.json();
        console.log('Piped SUCCESS! Items:', d.relatedStreams?.length);
        break;
      }
    } catch (e) {
      console.log('Piped err:', p, e.message);
    }
  }

  // Proxies with RSS
  const rss = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(rss)}`,
    `https://proxy.cors.sh/${rss}`,
    `https://thingproxy.freeboard.io/fetch/${rss}`,
  ];

  for (const pr of proxies) {
    try {
      const res = await fetch(pr, { signal: AbortSignal.timeout(3500) });
      console.log('Proxy', pr.slice(0, 30), res.status);
      if (res.ok) {
        const text = await res.text();
        console.log('Proxy SUCCESS! Len:', text.length);
      }
    } catch (e) {
      console.log('Proxy err:', pr.slice(0, 30), e.message);
    }
  }
}
testEndpoints();
