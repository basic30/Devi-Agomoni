async function generateTracks() {
  const res = await fetch('https://www.youtube.com/playlist?list=PLU7X6UN1WmZ4', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
  const data = JSON.parse(m[1]);
  const tracks = [];
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.lockupViewModel && obj.lockupViewModel.contentId) {
      const l = obj.lockupViewModel;
      const vId = l.contentId;
      const meta = l.metadata?.lockupMetadataViewModel;
      const title = meta?.title?.content;
      let subtitle = meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || 'Bengali Classic';
      subtitle = subtitle.replace(/\s*-\s*Topic$/i, '').trim();

      let durationLabel = '';
      const overlays = l.contentImage?.thumbnailViewModel?.overlays || [];
      for (const ov of overlays) {
        const text = ov.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text
          || ov.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel?.text
          || ov.thumbnailOverlayTimeStatusRenderer?.text?.simpleText
          || ov.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text;
        if (text) {
          durationLabel = text;
          break;
        }
      }

      let duration = 0;
      if (durationLabel) {
        const parts = durationLabel.split(':').map(Number);
        if (parts.length === 2) duration = parts[0] * 60 + parts[1];
        else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      tracks.push({
        id: `old-${String(tracks.length + 1).padStart(3, '0')}`,
        title: title || 'Pujo Song',
        subtitle: subtitle || 'Devi Agomoni',
        videoId: vId,
        duration: duration || null,
        durationLabel: durationLabel || '',
        cover: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
        sourceUrl: `https://www.youtube.com/watch?v=${vId}`
      });
    }
    for (const v of Object.values(obj)) walk(v);
  }
  walk(data);
  console.log(`Generated ${tracks.length} tracks:`);
  console.log(JSON.stringify(tracks, null, 2));
}
generateTracks();
