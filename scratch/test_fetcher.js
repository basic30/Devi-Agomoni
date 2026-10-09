async function testFetcher() {
  const playlistId = 'PLU7X6UN1WmZ4';
  
  // 1. Test Invidious instances
  const invidiousInstances = [
    'https://invidious.flokinet.to',
    'https://invidious.privacydev.net',
    'https://inv.tux.pizza',
    'https://invidious.drgns.space',
    'https://invidious.nerdvpn.de',
    'https://yt.artemislena.eu',
    'https://invidious.projectsegfau.lt',
    'https://iv.ggtyler.dev',
    'https://invidious.protokolla.fi'
  ];

  for (const domain of invidiousInstances) {
    try {
      console.log('Testing invidious:', domain);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${domain}/api/v1/playlists/${playlistId}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      console.log(domain, 'status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Invidious SUCCESS!', domain, 'video count:', data.videos?.length);
        break;
      }
    } catch (e) {
      console.log(domain, 'error:', e.message);
    }
  }

  // 2. Test Proxies for YouTube playlist page & RSS feed
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const ytUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
  
  const testProxies = [
    { name: 'allorigins_raw_rss', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}` },
    { name: 'allorigins_get_rss', url: `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}` },
    { name: 'codetabs_rss', url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}` },
    { name: 'allorigins_raw_html', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(ytUrl)}` },
    { name: 'codetabs_html', url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(ytUrl)}` },
  ];

  for (const p of testProxies) {
    try {
      console.log('Testing proxy:', p.name);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(p.url, { signal: controller.signal });
      clearTimeout(timeoutId);
      console.log(p.name, 'status:', res.status);
      if (res.ok) {
        const text = await res.text();
        console.log(p.name, 'length:', text.length);
      }
    } catch (e) {
      console.log(p.name, 'error:', e.message);
    }
  }
}
testFetcher();
