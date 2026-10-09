async function findWorkingInstances() {
  const playlistId = 'PLU7X6UN1WmZ4';
  const listRes = await fetch('https://api.invidious.io/instances.json');
  const list = await listRes.json();
  console.log('Total invidious entries:', list.length);

  for (const item of list) {
    const domain = item[0];
    const details = item[1];
    if (details.type === 'https') {
      const uri = details.uri || `https://${domain}`;
      try {
        const res = await fetch(`${uri}/api/v1/playlists/${playlistId}`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const cors = res.headers.get('access-control-allow-origin');
          const data = await res.json();
          if (data && data.videos && data.videos.length > 0) {
            console.log(`FOUND WORKING INSTANCE: ${uri} (CORS: ${cors}, videos: ${data.videos.length})`);
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }
}
findWorkingInstances();
