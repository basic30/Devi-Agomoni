async function testProxies() {
  const rssUrl = 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLU7X6UN1WmZ4';
  const list = [
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
    `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(rssUrl)}`,
    `https://api.cors.lol/?url=${encodeURIComponent(rssUrl)}`,
    `https://typefully.com/api/proxy?url=${encodeURIComponent(rssUrl)}`,
    `https://thingproxy.freeboard.io/fetch/${rssUrl}`,
  ];

  for (const u of list) {
    try {
      console.log('Testing:', u.slice(0, 45));
      const res = await fetch(u, { signal: AbortSignal.timeout(4000) });
      console.log(' -> status:', res.status);
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<entry>') || text.includes('entry')) {
          console.log(' -> SUCCESS with length:', text.length);
        }
      }
    } catch (e) {
      console.log(' -> failed:', e.message);
    }
  }
}
testProxies();
