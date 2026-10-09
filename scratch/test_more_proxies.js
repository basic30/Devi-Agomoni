async function testMoreProxies() {
  const rssUrl = 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLU7X6UN1WmZ4';
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://cors-anywhere.herokuapp.com/${rssUrl}`,
    `https://api.allorigins.hexal.org/get?url=${encodeURIComponent(rssUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
    `https://proxy.cors.sh/${rssUrl}`,
    `https://api.scraperapi.com?url=${encodeURIComponent(rssUrl)}`,
    `https://cors.bridged.cc/${rssUrl}`,
    `https://crossorigin.me/${rssUrl}`,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(rssUrl)}`
  ];

  for (const p of proxies) {
    try {
      const res = await fetch(p, { signal: AbortSignal.timeout(3000) });
      console.log(p.slice(0, 35), '->', res.status);
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<entry>')) {
          console.log('SUCCESS with proxy:', p);
          break;
        }
      }
    } catch (e) {
      console.log(p.slice(0, 35), '-> error:', e.message);
    }
  }
}
testMoreProxies();
