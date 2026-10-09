async function check() {
  const res = await fetch('https://www.youtube.com/playlist?list=PLU7X6UN1WmZ4', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
  const data = JSON.parse(m[1]);
  let firstLockup;
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.lockupViewModel && obj.lockupViewModel.contentId && !firstLockup) {
      firstLockup = obj.lockupViewModel;
    }
    for (const v of Object.values(obj)) walk(v);
  }
  walk(data);
  const overlays = firstLockup.contentImage.thumbnailViewModel.overlays;
  console.log('Overlays length:', overlays.length);
  console.log(JSON.stringify(overlays[0], null, 2));
}
check();
