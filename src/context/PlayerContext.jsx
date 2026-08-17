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

function acquireAudioFocus() {
  // Audio focus helper
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
  const [playlistKey, setPlaylistKey] = useState(PLAYLIST_KEYS[0]);
  const [trackIndex, setTrackIndex] = useState(0);
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

  const containerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const activePlaylistKeyRef = useRef(playlistKey);
  const trackIndexRef = useRef(trackIndex);
  const isPlayingRef = useRef(isPlaying);
  const nextTrackHandlerRef = useRef(() => { });
  const pendingActionRef = useRef(null);
  const wakeLockRef = useRef(null);

  const currentPlaylist = playlists[playlistKey] || playlists[PLAYLIST_KEYS[0]];
  const tracks = currentPlaylist?.tracks || [];
  const currentTrack = tracks[trackIndex] ?? tracks[0] ?? {};

  const workerRef = useRef(null);

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
      workerRef.current?.start();
    } else {
      workerRef.current?.stop();
    }
  }, [isPlaying]);

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
      if (!pl || !pl.tracks) return;

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
              title: data.title || 'YouTube Track',
              subtitle: data.author_name || 'YouTube Music',
              videoId: vId,
              durationLabel: 'YouTube Track',
              sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
            };
          } catch (e) {
            return {
              id: `yt-${vId}`,
              title: 'YouTube Track',
              subtitle: 'YouTube Music',
              videoId: vId,
              durationLabel: 'YouTube Track',
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
        executePlayAction(action.pKey, action.tIndex, action.autoplay, player);
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
        setIsPlaying(false);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
        const pl = playlists[activePlaylistKeyRef.current];
        if (pl) {
          nextTrackHandlerRef.current();
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
          const player = getPlayer();
          if (player && typeof player.playVideo === 'function') {
            try {
              player.playVideo();
              // Let the player's state change event update isPlaying
              // Don't set it directly - wait for YouTube player to emit PLAYING state
            } catch (e) {
              console.warn('Error playing from notification:', e);
              togglePlay();
            }
          } else {
            togglePlay();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          setIsPlaying(false);
          try {
            navigator.mediaSession.playbackState = 'paused';
          } catch (e) { }
          const player = getPlayer();
          if (player && typeof player.pauseVideo === 'function') {
            try {
              player.pauseVideo();
              // Let the player's state change event update isPlaying
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

        if (currentTrack.end != null && rawTime >= currentTrack.end) {
          goNext();
        }
      } catch (e) { }
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying, playlistKey, trackIndex, currentTrack.start, currentTrack.end]);

  function executePlayAction(pKey, tIndex, autoplay, playerInstance) {
    const player = playerInstance || getPlayer();
    if (!player) return;

    const targetPlaylist = playlists[pKey];
    const targetTrack = targetPlaylist?.tracks?.[tIndex] || targetPlaylist?.tracks?.[0];

    const videoId = targetTrack?.videoId || targetPlaylist?.youtubeVideoId;
    const startSec = targetTrack?.start ?? 0;

    try {
      if (targetPlaylist?.sourceType === 'youtube_playlist' && targetPlaylist?.youtubePlaylistId) {
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
            startSeconds: 0,
          });
          if (!autoplay && typeof player.pauseVideo === 'function') {
            setTimeout(() => { try { player.pauseVideo(); } catch (e) { } }, 500);
          }
          setCurrentTime(0);
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
      setCurrentTime(0);
    } catch (err) {
      console.warn('Error performing player action:', err);
    }
  }

  function playTrackAt(pKey, tIndex, { autoplay }) {
    const player = getPlayer();
    if (!player || typeof player.loadVideoById !== 'function') {
      pendingActionRef.current = { pKey, tIndex, autoplay };
      if (containerRef.current) {
        initPlayer(containerRef.current);
      }
      return;
    }

    executePlayAction(pKey, tIndex, autoplay, player);
  }

  function selectPlaylist(pKey) {
    if (pKey !== playlistKey) {
      setPlaylistKey(pKey);
      setTrackIndex(0);
      playTrackAt(pKey, 0, { autoplay: false });
    }
  }

  function selectTrack(pKey, tIndex) {
    setPlaylistKey(pKey);
    setTrackIndex(tIndex);
    playTrackAt(pKey, tIndex, { autoplay: true });
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

  function goNext() {
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
      return nextIdx;
    });
  }

  function goPrev() {
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
      return prevIdx;
    });
  }

  useEffect(() => {
    nextTrackHandlerRef.current = goNext;
  });

  function togglePlay() {
    const player = getPlayer();
    if (!player || typeof player.playVideo !== 'function') {
      playTrackAt(playlistKey, trackIndex, { autoplay: true });
      return;
    }

    if (isPlaying) {
      if (typeof player.pauseVideo === 'function') player.pauseVideo();
    } else {
      const expectedVideoId = currentTrack.videoId || currentPlaylist.youtubeVideoId;
      if (currentVideoIdRef.current === expectedVideoId) {
        if (typeof player.playVideo === 'function') player.playVideo();
      } else {
        playTrackAt(playlistKey, trackIndex, { autoplay: true });
      }
    }
  }

  function seekTo(fraction) {
    const norm = Math.min(1, Math.max(0, fraction));
    const player = getPlayer();
    if (!player || typeof player.seekTo !== 'function') return;

    const startSec = currentTrack.start ?? 0;
    const endSec = currentTrack.end ?? duration;
    const trackDuration = Math.max(0, endSec - startSec);
    const targetSec = startSec + norm * trackDuration;

    player.seekTo(targetSec, true);
    setCurrentTime(norm * trackDuration);
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

  const calcDuration = Math.max(0, (currentTrack.end ?? duration) - (currentTrack.start ?? 0));
  const canSkip = tracks.length > 1;

  const value = useMemo(
    () => ({
      playlistKey,
      playlist: currentPlaylist,
      trackIndex,
      track: currentTrack,
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
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
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
