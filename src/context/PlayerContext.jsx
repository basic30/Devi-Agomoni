import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { playlists, PLAYLIST_KEYS } from '../data/playlists';
import { fetchLiveYouTubePlaylist } from '../utils/playlistFetcher';

const PlayerContext = createContext(null);

const YT_PLAYER_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

let ytApiPromise = null;
let ytPlayerInstance = null;
let isPlayerReady = false;
let globalStateChangeHandler = null;
let globalReadyHandler = null;

function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }
  return ytApiPromise;
}

function createBackgroundHeartbeatWorker(callback) {
  let timerId = null;
  return {
    start: () => {
      if (!timerId) timerId = setInterval(callback, 2000);
    },
    stop: () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },
  };
}

let nativeAudioElement = null;

function getAudioProxyUrl() {
  if (typeof window !== 'undefined') {
    if (window.__DEVI_AUDIO_PROXY_URL__) return window.__DEVI_AUDIO_PROXY_URL__;
    try {
      const stored = localStorage.getItem('devi_audio_proxy_url');
      if (stored) return stored;
    } catch (e) {}
  }
  return (
    import.meta.env.VITE_AUDIO_PROXY_URL ||
    'https://deviagomoni-audio-proxy.onrender.com'
  );
}

function initNativeAudio() {
  if (typeof window === 'undefined') return null;
  if (!nativeAudioElement) {
    nativeAudioElement = new Audio();
    nativeAudioElement.preload = 'auto';
  }
  return nativeAudioElement;
}

let silentAudioElement = null;

function acquireAudioFocus() {
  if (typeof window === 'undefined') return;
  try {
    if (!silentAudioElement) {
      // Looping silent audio anchor to hold background OS audio focus
      silentAudioElement = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A');
      silentAudioElement.loop = true;
      silentAudioElement.volume = 0.001;
    }
    if (silentAudioElement.paused) {
      silentAudioElement.play().catch(() => {});
    }
  } catch (e) {}
}

function releaseAudioFocus() {
  if (silentAudioElement && !silentAudioElement.paused) {
    try {
      silentAudioElement.pause();
    } catch (e) {}
  }
}

// Eagerly pre-initialize audioFocusElement & preload YouTube API on module load
if (typeof window !== 'undefined') {
  loadYouTubeIframeApi();
}

function initPlayer(element) {
  if (ytPlayerInstance && isPlayerReady) return Promise.resolve(ytPlayerInstance);

  return loadYouTubeIframeApi().then((YT) => {
    return new Promise((resolve) => {
      new YT.Player(element, {
        host: 'https://www.youtube-nocookie.com',
        width: '200',
        height: '200',
        playerVars: {
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            ytPlayerInstance = event.target;
            isPlayerReady = true;

            try {
              const iframe = element.querySelector('iframe') || (element.tagName === 'IFRAME' ? element : null);
              if (iframe) {
                iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; accelerometer; clipboard-write; gyroscope');
                iframe.setAttribute('playsinline', '1');
                iframe.setAttribute('webkit-playsinline', '1');
              }
            } catch (e) { }

            if (globalReadyHandler) {
              globalReadyHandler(event.target);
            }
            resolve(event.target);
          },
          onStateChange: (event) => {
            if (globalStateChangeHandler) {
              globalStateChangeHandler(event);
            }
          },
        },
      });
    });
  });
}

function getPlayer() {
  return isPlayerReady && ytPlayerInstance ? ytPlayerInstance : null;
}

export function PlayerProvider({ children }) {
  const [playlistKey, setPlaylistKey] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('devi_last_player_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.playlistKey && playlists[parsed.playlistKey]) return parsed.playlistKey;
        }
      } catch (e) {}
    }
    return PLAYLIST_KEYS[0];
  });

  const [trackIndex, setTrackIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('devi_last_player_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.trackIndex === 'number') return parsed.trackIndex;
        }
      } catch (e) {}
    }
    return 0;
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlistVersion, setPlaylistVersion] = useState(0);

  const [volume, setVolumeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('devi_player_volume');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
      }
    }
    return 100;
  });
  const [isMuted, setIsMuted] = useState(false);
  const prevVolumeRef = useRef(volume > 0 ? volume : 100);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const containerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const activePlaylistKeyRef = useRef(playlistKey);
  const trackIndexRef = useRef(trackIndex);
  const isPlayingRef = useRef(isPlaying);
  const nextTrackHandlerRef = useRef(() => { });
  const pendingActionRef = useRef(null);
  const wakeLockRef = useRef(null);
  const lastLoadedTimeRef = useRef(0);

  const persistPlayerState = useCallback((pk, ti, isPlay, pos) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('devi_last_player_state', JSON.stringify({
        playlistKey: pk ?? activePlaylistKeyRef.current,
        trackIndex: ti ?? trackIndexRef.current,
        isPlaying: isPlay ?? isPlayingRef.current,
        position: pos ?? currentTimeRef.current,
        timestamp: Date.now(),
      }));
    } catch (e) {}
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (e) {}
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch (e) {}
      wakeLockRef.current = null;
    }
  }, []);

  const currentPlaylist = playlists[playlistKey] || playlists[PLAYLIST_KEYS[0]];
  const tracks = currentPlaylist?.tracks || [];
  const currentTrack = tracks[trackIndex] ?? tracks[0] ?? {};

  const workerRef = useRef(null);


  // Native HTML5 Audio event wiring (Provides 100% background play with screen locked)
  useEffect(() => {
    const audio = initNativeAudio();
    if (!audio) return;

    const onTimeUpdate = () => {
      if (getAudioProxyUrl()) {
        setCurrentTime(audio.currentTime);
      }
    };
    const onDurationChange = () => {
      if (getAudioProxyUrl() && audio.duration) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => {
      if (getAudioProxyUrl()) {
        setIsPlaying(true);
        acquireAudioFocus();
      }
    };
    const onPause = () => {
      if (getAudioProxyUrl()) {
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      if (getAudioProxyUrl()) {
        setIsPlaying(false);
        nextTrackHandlerRef.current({ isManual: false });
      }
    };

    const onError = (e) => {
      console.warn('Native audio stream error or network timeout, falling back to YouTube iframe:', e);
      const player = getPlayer();
      const vId = currentVideoIdRef.current;
      if (player && vId && typeof player.loadVideoById === 'function') {
        const resumeSec = audio.currentTime || 0;
        player.loadVideoById({ videoId: vId, startSeconds: resumeSec });
        if (isPlayingRef.current && typeof player.playVideo === 'function') {
          try { player.playVideo(); } catch (err) {}
        }
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Background Web Worker heartbeat (prevents main thread timer throttling on Android Chrome screen off)
  useEffect(() => {
    workerRef.current = createBackgroundHeartbeatWorker(() => {
      if (isPlayingRef.current) {
        acquireAudioFocus();
        const player = getPlayer();
        if (player && typeof player.getPlayerState === 'function') {
          try {
            const state = player.getPlayerState();
            if (state === YT_PLAYER_STATES.PAUSED || state === YT_PLAYER_STATES.CUED) {
              if (typeof player.playVideo === 'function') {
                player.playVideo();
              }
            }
          } catch (e) { }
        }
      }
    });

    return () => {
      if (workerRef.current) workerRef.current.stop();
    };
  }, []);

  // Handle visibility changes when screen is locked or tab minimized
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isPlayingRef.current) {
          acquireAudioFocus();
        }
      } else {
        if (isPlayingRef.current) {
          requestWakeLock();
          const player = getPlayer();
          if (player && typeof player.getPlayerState === 'function') {
            try {
              const state = player.getPlayerState();
              if (state === YT_PLAYER_STATES.PAUSED || state === YT_PLAYER_STATES.BUFFERING) {
                player.playVideo();
              }
            } catch (e) {}
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock]);

  useEffect(() => {
    activePlaylistKeyRef.current = playlistKey;
  }, [playlistKey]);

  useEffect(() => {
    trackIndexRef.current = trackIndex;
  }, [trackIndex]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      acquireAudioFocus();
      requestWakeLock();
      workerRef.current?.start();
    } else {
      releaseAudioFocus();
      releaseWakeLock();
      workerRef.current?.stop();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // Auto-sync live YouTube Music playlists on load
  useEffect(() => {
    Object.values(playlists).forEach((pl) => {
      if (pl.sourceType === 'youtube_playlist' && pl.youtubePlaylistId) {
        fetchLiveYouTubePlaylist(pl.youtubePlaylistId, pl.tracks).then((liveTracks) => {
          if (liveTracks && liveTracks.length > 0) {
            pl.tracks = liveTracks;
            setPlaylistVersion((v) => v + 1);
          }
        });
      }
    });
  }, []);

  async function syncLivePlaylistFromPlayer(player) {
    if (!player || typeof player.getPlaylist !== 'function') return;
    try {
      const videoIds = player.getPlaylist();
      if (!Array.isArray(videoIds) || videoIds.length === 0) return;

      const pKey = activePlaylistKeyRef.current;
      const pl = playlists[pKey];
      if (!pl || !pl.tracks || pl.sourceType !== 'youtube_playlist') return;

      const existingMap = new Map(pl.tracks.map((t) => [t.videoId, t]));
      const missingIds = videoIds.filter((id) => id && !existingMap.has(id));

      if (missingIds.length === 0) return;

      const fetchedNewTracks = await Promise.all(
        missingIds.map(async (vId) => {
          try {
            const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            return {
              id: `yt-${vId}`,
              title: data.title || 'Bengali Pujo Song',
              subtitle: (data.author_name || 'YouTube Music').replace(/\s*-\s*Topic$/i, '').trim(),
              videoId: vId,
              durationLabel: 'YouTube Track',
              cover: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
              sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
            };
          } catch (e) {
            return {
              id: `yt-${vId}`,
              title: 'Bengali Pujo Song',
              subtitle: 'YouTube Music',
              videoId: vId,
              durationLabel: 'YouTube Track',
              cover: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
              sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
            };
          }
        })
      );

      const allTrackMap = new Map([
        ...pl.tracks.map((t) => [t.videoId, t]),
        ...fetchedNewTracks.map((t) => [t.videoId, t]),
      ]);

      const orderedTracks = videoIds
        .map((vId) => allTrackMap.get(vId))
        .filter(Boolean);

      pl.tracks.forEach((t) => {
        if (!orderedTracks.some((ot) => ot.videoId === t.videoId)) {
          orderedTracks.push(t);
        }
      });

      pl.tracks = orderedTracks;
      setPlaylistVersion((v) => v + 1);
    } catch (e) {
      console.warn('Error syncing live playlist from player:', e);
    }
  }

  function syncPlaylistTrackIndex(player) {
    if (!player) return;
    try {
      if (typeof player.getPlaylistIndex === 'function') {
        const ytIdx = player.getPlaylistIndex();
        if (ytIdx != null && ytIdx >= 0 && ytIdx !== trackIndexRef.current) {
          const pl = playlists[activePlaylistKeyRef.current];
          if (pl && pl.tracks && pl.tracks[ytIdx]) {
            setTrackIndex(ytIdx);
          }
        }
      }
    } catch (e) { }
  }

  useEffect(() => {
    globalReadyHandler = (player) => {
      try {
        if (player && typeof player.setVolume === 'function') {
          player.setVolume(volumeRef.current);
          if (volumeRef.current === 0 && typeof player.mute === 'function') {
            player.mute();
          }
        }
      } catch (e) { }
      if (pendingActionRef.current) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        executePlayAction(action.pKey, action.tIndex, action.autoplay, player, action.customStartSec);
      }
      syncLivePlaylistFromPlayer(player);
    };

    globalStateChangeHandler = (event) => {
      const player = getPlayer();

      if (event.data === YT_PLAYER_STATES.PLAYING) {
        setIsPlaying(true);
        acquireAudioFocus();
        syncPlaylistTrackIndex(player);
        syncLivePlaylistFromPlayer(player);
      } else if (event.data === YT_PLAYER_STATES.PAUSED) {
        if (document.hidden && isPlayingRef.current) {
          acquireAudioFocus();
          setTimeout(() => {
            const p = getPlayer();
            if (p && typeof p.playVideo === 'function') {
              try { p.playVideo(); } catch (e) { }
            }
          }, 60);
        } else {
          setIsPlaying(false);
        }
      } else if (event.data === YT_PLAYER_STATES.ENDED) {
        // Guard against premature or false ENDED events during video loading, unmounting, or remote sync
        if (isRemoteSyncRef.current || Date.now() - lastLoadedTimeRef.current < 4000) {
          return;
        }

        const rawCurTime = player?.getCurrentTime?.() || currentTimeRef.current;
        const totalDur = player?.getDuration?.() || 0;
        // If track duration is known and player hasn't reached within 3 seconds of end, ignore false ENDED
        if (totalDur > 10 && rawCurTime < totalDur - 3.5) {
          return;
        }

        setIsPlaying(false);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
        const pl = playlists[activePlaylistKeyRef.current];
        if (pl) {
          nextTrackHandlerRef.current({ isManual: false });
        }
      }

      if (player && typeof player.getDuration === 'function') {
        const dur = player.getDuration();
        if (dur) {
          setDuration(dur);
        }
      }
    };

    if (containerRef.current) {
      initPlayer(containerRef.current);
    }
  }, []);

  function syncPlaylistTrackIndex(player) {
    if (!player) return;
    try {
      if (typeof player.getPlaylistIndex === 'function') {
        const ytIdx = player.getPlaylistIndex();
        if (ytIdx != null && ytIdx >= 0 && ytIdx !== trackIndexRef.current) {
          const pl = playlists[activePlaylistKeyRef.current];
          if (pl && pl.tracks && pl.tracks[ytIdx]) {
            setTrackIndex(ytIdx);
          }
        }
      }
    } catch (e) { }
  }

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const title = currentTrack?.title || 'Devi Agomoni';
        const artist = currentTrack?.subtitle || 'Durga Puja Special';
        const videoId = currentTrack?.videoId || currentPlaylist?.youtubeVideoId;
        const coverUrl = videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : 'https://www.devipaksha.in/thumbnail.png';

        navigator.mediaSession.metadata = new MediaMetadata({
          title: title,
          artist: artist,
          album: currentPlaylist?.label || 'Devi Agomoni',
          artwork: [
            { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
            { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
          ],
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => {
          acquireAudioFocus();
          const proxyBase = getAudioProxyUrl();
          const audio = initNativeAudio();
          if (proxyBase && audio && audio.src) {
            audio.play().then(() => {
              setIsPlaying(true);
            }).catch((e) => {
              console.warn('Native audio play error from notification:', e);
              togglePlay();
            });
            return;
          }
          const player = getPlayer();
          if (player && typeof player.playVideo === 'function') {
            try {
              player.playVideo();
            } catch (e) {
              console.warn('Error playing from notification:', e);
              togglePlay();
            }
          } else {
            togglePlay();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          const proxyBase = getAudioProxyUrl();
          const audio = initNativeAudio();
          if (proxyBase && audio && audio.src) {
            audio.pause();
            setIsPlaying(false);
            try {
              navigator.mediaSession.playbackState = 'paused';
            } catch (e) {}
            return;
          }
          setIsPlaying(false);
          try {
            navigator.mediaSession.playbackState = 'paused';
          } catch (e) { }
          const player = getPlayer();
          if (player && typeof player.pauseVideo === 'function') {
            try {
              player.pauseVideo();
            } catch (e) {
              console.warn('Error pausing from notification:', e);
              togglePlay();
            }
          } else {
            togglePlay();
          }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          goPrev();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          goNext();
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) {
            const startSec = currentTrack.start ?? 0;
            const calcDur = Math.max(0, (currentTrack.end ?? duration) - startSec);
            if (calcDur > 0) {
              seekTo(details.seekTime / calcDur);
            }
          }
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const step = details.seekOffset || 10;
          const startSec = currentTrack.start ?? 0;
          const calcDur = Math.max(0, (currentTrack.end ?? duration) - startSec);
          if (calcDur > 0) {
            seekTo(Math.min(calcDur, currentTime + step) / calcDur);
          }
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const step = details.seekOffset || 10;
          const startSec = currentTrack.start ?? 0;
          const calcDur = Math.max(0, (currentTrack.end ?? duration) - startSec);
          if (calcDur > 0) {
            seekTo(Math.max(0, currentTime - step) / calcDur);
          }
        });
      } catch (e) {
        console.warn('MediaSession error:', e);
      }
    }
  }, [currentTrack, isPlaying, playlistKey, duration, currentTime]);

  // Position state for lock-screen seek scrubber
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        if ('setPositionState' in navigator.mediaSession) {
          const startSec = currentTrack.start ?? 0;
          const calcDur = Math.max(0, (currentTrack.end ?? duration) - startSec);
          if (calcDur > 0 && currentTime >= 0) {
            navigator.mediaSession.setPositionState({
              duration: calcDur,
              playbackRate: isPlaying ? 1 : 0,
              position: Math.min(currentTime, calcDur),
            });
          }
        }
      } catch (e) { }
    }
  }, [currentTime, duration, currentTrack, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const player = getPlayer();
      if (!player || typeof player.getCurrentTime !== 'function') return;

      try {
        syncPlaylistTrackIndex(player);
        const rawTime = player.getCurrentTime();
        const startTime = currentTrack.start ?? 0;
        const elapsedTime = Math.max(0, rawTime - startTime);
        setCurrentTime(elapsedTime);

        if (currentTrack.end != null && rawTime >= currentTrack.end && !isRemoteSyncRef.current && Date.now() - lastLoadedTimeRef.current > 4000) {
          goNext({ isManual: false });
        }
      } catch (e) { }
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying, playlistKey, trackIndex, currentTrack.start, currentTrack.end]);

  const onGroupSyncCallbackRef = useRef(null);
  const isRemoteSyncRef = useRef(false);

  function notifyGroupSync(action, pKey, tIndex, isPlay, pos) {
    if (isRemoteSyncRef.current) return;
    if (typeof onGroupSyncCallbackRef.current === 'function') {
      try {
        const pk = pKey ?? activePlaylistKeyRef.current;
        const ti = tIndex ?? trackIndexRef.current;
        const curPl = playlists[pk];
        const curTrk = curPl?.tracks?.[ti] || curPl?.tracks?.[0] || {};
        onGroupSyncCallbackRef.current({
          action,
          playlistKey: pk,
          trackIndex: ti,
          trackTitle: curTrk.title || 'Pujo Song',
          videoId: curTrk.videoId || curPl?.youtubeVideoId,
          isPlaying: isPlay ?? isPlayingRef.current,
          position: pos != null ? pos : currentTime,
          sentAt: Date.now(),
        });
      } catch (e) {
        console.warn('Group sync broadcast error:', e);
      }
    }
  }

  function executePlayAction(pKey, tIndex, autoplay, playerInstance, customStartSec) {
    lastLoadedTimeRef.current = Date.now();
    const targetPlaylist = playlists[pKey];
    const targetTrack = targetPlaylist?.tracks?.[tIndex] || targetPlaylist?.tracks?.[0];
    const videoId = targetTrack?.videoId || targetPlaylist?.youtubeVideoId;
    const startSec = customStartSec != null ? customStartSec : (targetTrack?.start ?? 0);

    const proxyBase = getAudioProxyUrl();
    if (proxyBase && videoId) {
      const streamUrl = `${proxyBase.replace(/\/$/, '')}/api/stream/${videoId}`;
      const audio = initNativeAudio();
      if (audio) {
        if (currentVideoIdRef.current !== videoId || audio.src !== streamUrl) {
          currentVideoIdRef.current = videoId;
          audio.src = streamUrl;
        }
        if (startSec > 0 && Math.abs(audio.currentTime - startSec) > 1.5) {
          try { audio.currentTime = startSec; } catch (e) {}
        }
        audio.volume = (volumeRef.current || 100) / 100;
        audio.muted = !!isMutedRef.current;
        if (autoplay) {
          audio.play().then(() => {
            setIsPlaying(true);
            acquireAudioFocus();
          }).catch((err) => {
            console.warn('Native audio play error, falling back to YouTube iframe:', err);
            const player = playerInstance || getPlayer();
            if (player && typeof player.loadVideoById === 'function') {
              player.loadVideoById({ videoId, startSeconds: startSec });
            }
          });
        } else {
          audio.pause();
          setIsPlaying(false);
        }
        setCurrentTime(startSec || 0);
        return;
      }
    }

    const player = playerInstance || getPlayer();
    if (!player || typeof player.loadVideoById !== 'function') {
      pendingActionRef.current = { pKey, tIndex, autoplay, customStartSec };
      if (containerRef.current) initPlayer(containerRef.current);
      return;
    }

    try {
      if (targetPlaylist?.sourceType === 'youtube_playlist' && targetPlaylist?.youtubePlaylistId && !targetTrack?.videoId) {
        if (typeof player.loadPlaylist === 'function') {
          if (currentVideoIdRef.current === targetPlaylist.youtubePlaylistId) {
            if (typeof player.playVideoAt === 'function') {
              player.playVideoAt(tIndex);
              return;
            }
          }
          currentVideoIdRef.current = targetPlaylist.youtubePlaylistId;
          player.loadPlaylist({
            list: targetPlaylist.youtubePlaylistId,
            listType: 'playlist',
            index: tIndex || 0,
            startSeconds: startSec || 0,
          });
          if (!autoplay && typeof player.pauseVideo === 'function') {
            setTimeout(() => { try { player.pauseVideo(); } catch (e) { } }, 500);
          }
          setCurrentTime(startSec || 0);
          return;
        }
      }

      if (currentVideoIdRef.current === videoId) {
        if (typeof player.seekTo === 'function') {
          player.seekTo(startSec, true);
        }
        if (autoplay) {
          if (typeof player.playVideo === 'function') player.playVideo();
        } else {
          if (typeof player.pauseVideo === 'function') player.pauseVideo();
        }
      } else {
        currentVideoIdRef.current = videoId;
        if (autoplay) {
          if (typeof player.loadVideoById === 'function') {
            player.loadVideoById({ videoId, startSeconds: startSec });
          }
        } else {
          if (typeof player.cueVideoById === 'function') {
            player.cueVideoById({ videoId, startSeconds: startSec });
          }
        }
      }
      setCurrentTime(startSec || 0);
    } catch (err) {
      console.warn('Error performing player action:', err);
    }
  }

  function playTrackAt(pKey, tIndex, { autoplay, startSeconds } = {}) {
    const player = getPlayer();
    if (!player || typeof player.loadVideoById !== 'function') {
      pendingActionRef.current = { pKey, tIndex, autoplay, customStartSec: startSeconds };
      if (containerRef.current) {
        initPlayer(containerRef.current);
      }
      return;
    }

    executePlayAction(pKey, tIndex, autoplay, player, startSeconds);
  }

  function selectPlaylist(pKey) {
    if (pKey !== playlistKey) {
      setPlaylistKey(pKey);
      setTrackIndex(0);
      playTrackAt(pKey, 0, { autoplay: false });
      notifyGroupSync('MANUAL_TRACK_CHANGE', pKey, 0, false, 0);
    }
  }

  function selectTrack(pKey, tIndex) {
    setPlaylistKey(pKey);
    setTrackIndex(tIndex);
    playTrackAt(pKey, tIndex, { autoplay: true });
    notifyGroupSync('MANUAL_TRACK_CHANGE', pKey, tIndex, true, 0);
  }

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const isShuffleRef = useRef(isShuffle);
  const isRepeatRef = useRef(isRepeat);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setIsRepeat((prev) => !prev);
  }, []);

  function goNext(options = {}) {
    const isManual = options?.isManual !== false;
    const plTracks = playlists[activePlaylistKeyRef.current]?.tracks || [];
    if (plTracks.length === 0) return;

    if (isRepeatRef.current) {
      playTrackAt(activePlaylistKeyRef.current, trackIndexRef.current, { autoplay: true });
      return;
    }

    setTrackIndex((prevIndex) => {
      let nextIdx;
      if (isShuffleRef.current && plTracks.length > 1) {
        do {
          nextIdx = Math.floor(Math.random() * plTracks.length);
        } while (nextIdx === prevIndex);
      } else {
        nextIdx = (prevIndex + 1) % plTracks.length;
      }
      playTrackAt(activePlaylistKeyRef.current, nextIdx, { autoplay: true });
      notifyGroupSync(isManual ? 'MANUAL_TRACK_CHANGE' : 'AUTO_NEXT', activePlaylistKeyRef.current, nextIdx, true, 0);
      return nextIdx;
    });
  }

  function goPrev(options = {}) {
    const isManual = options?.isManual !== false;
    const plTracks = playlists[activePlaylistKeyRef.current]?.tracks || [];
    if (plTracks.length === 0) return;

    if (isRepeatRef.current) {
      playTrackAt(activePlaylistKeyRef.current, trackIndexRef.current, { autoplay: true });
      return;
    }

    setTrackIndex((prevIndex) => {
      let prevIdx;
      if (isShuffleRef.current && plTracks.length > 1) {
        do {
          prevIdx = Math.floor(Math.random() * plTracks.length);
        } while (prevIdx === prevIndex);
      } else {
        prevIdx = (prevIndex - 1 + plTracks.length) % plTracks.length;
      }
      playTrackAt(activePlaylistKeyRef.current, prevIdx, { autoplay: true });
      notifyGroupSync(isManual ? 'MANUAL_TRACK_CHANGE' : 'AUTO_NEXT', activePlaylistKeyRef.current, prevIdx, true, 0);
      return prevIdx;
    });
  }

  useEffect(() => {
    nextTrackHandlerRef.current = goNext;
  });

  function togglePlay() {
    const proxyBase = getAudioProxyUrl();
    const audio = initNativeAudio();
    if (proxyBase && audio && audio.src) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        notifyGroupSync('PAUSE', playlistKey, trackIndex, false, audio.currentTime || currentTime);
      } else {
        audio.play().then(() => {
          setIsPlaying(true);
          acquireAudioFocus();
        }).catch((err) => {
          console.warn('Native audio play error, trying iframe:', err);
          const player = getPlayer();
          if (player && typeof player.playVideo === 'function') player.playVideo();
        });
        notifyGroupSync('PLAY', playlistKey, trackIndex, true, audio.currentTime || currentTime);
      }
      return;
    }

    const player = getPlayer();
    if (!player || typeof player.playVideo !== 'function') {
      playTrackAt(playlistKey, trackIndex, { autoplay: true });
      notifyGroupSync('PLAY', playlistKey, trackIndex, true, 0);
      return;
    }

    if (isPlaying) {
      if (typeof player.pauseVideo === 'function') player.pauseVideo();
      notifyGroupSync('PAUSE', playlistKey, trackIndex, false, (player?.getCurrentTime?.() || currentTime));
    } else {
      const expectedVideoId = currentTrack.videoId || currentPlaylist.youtubeVideoId;
      if (currentVideoIdRef.current === expectedVideoId) {
        if (typeof player.playVideo === 'function') player.playVideo();
      } else {
        playTrackAt(playlistKey, trackIndex, { autoplay: true });
      }
      notifyGroupSync('PLAY', playlistKey, trackIndex, true, (player?.getCurrentTime?.() || currentTime));
    }
  }

  function seekTo(fraction) {
    const norm = Math.min(1, Math.max(0, fraction));
    const startSec = currentTrack.start ?? 0;
    const endSec = currentTrack.end ?? duration;
    const trackDuration = Math.max(0, endSec - startSec);
    const targetSec = startSec + norm * trackDuration;

    const proxyBase = getAudioProxyUrl();
    const audio = initNativeAudio();
    if (proxyBase && audio && audio.src) {
      try {
        audio.currentTime = targetSec;
      } catch (e) {}
      setCurrentTime(norm * trackDuration);
      notifyGroupSync('SEEK', playlistKey, trackIndex, isPlaying, targetSec);
      return;
    }

    const player = getPlayer();
    if (!player || typeof player.seekTo !== 'function') return;

    player.seekTo(targetSec, true);
    setCurrentTime(norm * trackDuration);
    notifyGroupSync('SEEK', playlistKey, trackIndex, isPlaying, targetSec);
  }

  const [isDhakPlaying, setIsDhakPlaying] = useState(false);
  const dhakAudioRef = useRef(null);

  const setVolume = useCallback((newVol) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVol)));
    setVolumeState(clamped);
    if (clamped > 0) {
      prevVolumeRef.current = clamped;
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('devi_player_volume', String(clamped));
      } catch (e) { }
    }

    const audio = initNativeAudio();
    if (audio) {
      audio.volume = clamped / 100;
      audio.muted = (clamped === 0);
    }

    const player = getPlayer();
    if (player) {
      try {
        if (typeof player.setVolume === 'function') {
          player.setVolume(clamped);
        }
        if (clamped === 0 && typeof player.mute === 'function') {
          player.mute();
        } else if (clamped > 0 && typeof player.unMute === 'function') {
          player.unMute();
        }
      } catch (e) { }
    }

    if (dhakAudioRef.current) {
      dhakAudioRef.current.volume = clamped / 100;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMutedRef.current || volumeRef.current === 0) {
      const targetVol = prevVolumeRef.current > 0 ? prevVolumeRef.current : 100;
      setVolume(targetVol);
    } else {
      prevVolumeRef.current = volumeRef.current;
      setVolume(0);
    }
  }, [setVolume]);

  useEffect(() => {
    const audio = new Audio('/dhak.mp3');
    audio.loop = true;
    audio.volume = volumeRef.current / 100;
    audio.onplay = () => setIsDhakPlaying(true);
    audio.onpause = () => setIsDhakPlaying(false);
    audio.onended = () => {
      if (isRepeatRef.current || audio.loop) {
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Dhak repeat error:', err));
      } else {
        setIsDhakPlaying(false);
      }
    };
    dhakAudioRef.current = audio;

    return () => {
      audio.pause();
      dhakAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (dhakAudioRef.current) {
      dhakAudioRef.current.loop = true;
    }
  }, [isRepeat]);

  const toggleDhak = useCallback(() => {
    if (!dhakAudioRef.current) return;
    if (dhakAudioRef.current.paused) {
      dhakAudioRef.current.currentTime = 0;
      dhakAudioRef.current.volume = volumeRef.current / 100;
      dhakAudioRef.current.play().catch((err) => console.warn('Dhak playback error:', err));
    } else {
      dhakAudioRef.current.pause();
    }
  }, []);

  const refreshLivePlaylist = useCallback(async (pKey) => {
    const pl = playlists[pKey];
    if (pl && pl.sourceType === 'youtube_playlist' && pl.youtubePlaylistId) {
      try {
        const liveTracks = await fetchLiveYouTubePlaylist(pl.youtubePlaylistId, pl.tracks);
        if (liveTracks && liveTracks.length > 0) {
          pl.tracks = liveTracks;
          setPlaylistVersion((v) => v + 1);
          return liveTracks;
        }
      } catch (e) {
        console.warn('refreshLivePlaylist failed:', e);
      }
    }
    return pl?.tracks || [];
  }, []);

  const registerGroupSync = useCallback((callback) => {
    onGroupSyncCallbackRef.current = callback;
    return () => {
      onGroupSyncCallbackRef.current = null;
    };
  }, []);

  const unlockAudio = useCallback(() => {
    acquireAudioFocus();
    const proxyBase = getAudioProxyUrl();
    const audio = initNativeAudio();
    if (proxyBase && audio && audio.src && audio.paused) {
      audio.play().catch(() => {});
    }
    const player = getPlayer();
    if (player) {
      try {
        if (typeof player.unMute === 'function') {
          player.unMute();
        }
        if (typeof player.setVolume === 'function') {
          player.setVolume(volumeRef.current || 100);
        }
      } catch (e) {}
    } else if (containerRef.current) {
      initPlayer(containerRef.current);
    }
  }, []);

  const getCurrentPlayerState = useCallback(() => {
    const proxyBase = getAudioProxyUrl();
    const audio = initNativeAudio();
    let curTime = currentTimeRef.current;
    if (proxyBase && audio && audio.src && !isNaN(audio.currentTime) && audio.currentTime > 0) {
      curTime = audio.currentTime;
    } else {
      const player = getPlayer();
      if (player && typeof player.getCurrentTime === 'function') {
        curTime = player.getCurrentTime();
      }
    }
    const player = getPlayer();
    const pk = activePlaylistKeyRef.current;
    const ti = trackIndexRef.current;
    const curPl = playlists[pk];
    const curTrk = curPl?.tracks?.[ti] || curPl?.tracks?.[0] || {};
    return {
      playlistKey: pk,
      trackIndex: ti,
      trackTitle: curTrk.title || 'Pujo Song',
      videoId: curTrk.videoId || curPl?.youtubeVideoId,
      isPlaying: isPlayingRef.current,
      position: curTime,
      sentAt: Date.now(),
    };
  }, []);

  const applyRemoteSync = useCallback((syncEvent) => {
    if (!syncEvent) return;
    const player = getPlayer();
    const { playlistKey: remotePKey, trackIndex: remoteTIndex, position = 0, isPlaying: remoteIsPlaying, sentAt } = syncEvent;

    isRemoteSyncRef.current = true;
    lastLoadedTimeRef.current = Date.now();

    // Latency compensation
    const latencySec = sentAt ? Math.max(0, (Date.now() - sentAt) / 1000) : 0;
    const targetSec = remoteIsPlaying ? (position + latencySec) : position;

    const targetPlaylist = playlists[remotePKey];
    const targetTrack = targetPlaylist?.tracks?.[remoteTIndex] || targetPlaylist?.tracks?.[0];
    const videoId = targetTrack?.videoId || targetPlaylist?.youtubeVideoId;

    const proxyBase = getAudioProxyUrl();
    const audio = initNativeAudio();

    if (proxyBase && audio) {
      if (remotePKey && (remotePKey !== activePlaylistKeyRef.current || remoteTIndex !== trackIndexRef.current || currentVideoIdRef.current !== videoId)) {
        setPlaylistKey(remotePKey);
        setTrackIndex(remoteTIndex);
        executePlayAction(remotePKey, remoteTIndex, remoteIsPlaying, player, targetSec);
      } else {
        if (Math.abs(audio.currentTime - targetSec) > 1.8) {
          try { audio.currentTime = targetSec; } catch (e) {}
        }
        if (remoteIsPlaying) {
          audio.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
          audio.pause();
          setIsPlaying(false);
        }
      }
      setCurrentTime(targetSec);
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 3500);
      return;
    }

    if (!player || typeof player.loadVideoById !== 'function') {
      // YouTube player is still initializing! Store in pendingActionRef and update React state immediately
      pendingActionRef.current = {
        pKey: remotePKey,
        tIndex: remoteTIndex,
        autoplay: remoteIsPlaying,
        customStartSec: targetSec,
      };
      if (remotePKey) setPlaylistKey(remotePKey);
      if (remoteTIndex != null) setTrackIndex(remoteTIndex);
      setCurrentTime(targetSec);
      if (remoteIsPlaying) {
        setIsPlaying(true);
        acquireAudioFocus();
      }
      if (containerRef.current) {
        initPlayer(containerRef.current);
      }
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 3500);
      return;
    }

    if (remotePKey && (remotePKey !== activePlaylistKeyRef.current || remoteTIndex !== trackIndexRef.current || currentVideoIdRef.current !== videoId)) {
      setPlaylistKey(remotePKey);
      setTrackIndex(remoteTIndex);
      executePlayAction(remotePKey, remoteTIndex, remoteIsPlaying, player, targetSec);
      setCurrentTime(targetSec);
      if (remoteIsPlaying) {
        setIsPlaying(true);
        acquireAudioFocus();
      }
    } else if (player) {
      if (Math.abs((player.getCurrentTime?.() || 0) - targetSec) > 1.8) {
        try { player.seekTo(targetSec, true); } catch (e) {}
      }
      setCurrentTime(targetSec);
      if (remoteIsPlaying) {
        try { player.playVideo(); } catch (e) {}
        setIsPlaying(true);
        acquireAudioFocus();
      } else {
        try { player.pauseVideo(); } catch (e) {}
        setIsPlaying(false);
      }
    }

    setTimeout(() => {
      isRemoteSyncRef.current = false;
    }, 3500);
  }, []);

  const calcDuration = Math.max(0, (currentTrack.end ?? duration) - (currentTrack.start ?? 0));
  const canSkip = tracks.length > 1;

  const value = useMemo(
    () => ({
      playlistKey,
      playlist: currentPlaylist,
      currentPlaylist,
      trackIndex,
      track: currentTrack,
      currentTrack,
      isPlaying,
      currentTime,
      duration: calcDuration,
      canSkip,
      isShuffle,
      isRepeat,
      isDhakPlaying,
      volume,
      isMuted,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      toggleDhak,
      selectPlaylist,
      selectTrack,
      goNext,
      goPrev,
      togglePlay,
      seekTo,
      refreshLivePlaylist,
      registerGroupSync,
      getCurrentPlayerState,
      applyRemoteSync,
      playlistVersion,
    }),
    [
      playlistKey,
      currentPlaylist,
      trackIndex,
      currentTrack,
      isPlaying,
      currentTime,
      calcDuration,
      canSkip,
      isShuffle,
      isRepeat,
      isDhakPlaying,
      volume,
      isMuted,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      toggleDhak,
      refreshLivePlaylist,
      registerGroupSync,
      getCurrentPlayerState,
      applyRemoteSync,
      playlistVersion,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '200px',
          height: '200px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
          transform: 'translate3d(0, 0, 0)',
        }}
        aria-hidden="true"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a <PlayerProvider>');
  }
  return context;
}
