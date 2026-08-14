import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { playlists, PLAYLIST_KEYS } from '../data/playlists';
import { createBackgroundHeartbeatWorker } from '../utils/backgroundWorker';

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

// Continuous Web Audio + HTML5 Silent Loop to hold Mobile OS Background Audio Session
let mobileAudioContext = null;
let mobileSilentAudio = null;

// 1-second silent WAV base64
const SILENT_WAV_BASE64 = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function acquireMobileAudioLock() {
  if (typeof window === 'undefined') return;

  try {
    if (!mobileSilentAudio) {
      mobileSilentAudio = new Audio(SILENT_WAV_BASE64);
      mobileSilentAudio.loop = true;
      mobileSilentAudio.volume = 0.01;
    }
    mobileSilentAudio.play().catch(() => {});
  } catch (e) {}

  try {
    if (!mobileAudioContext && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      mobileAudioContext = new AudioCtx();
    }
    if (mobileAudioContext && mobileAudioContext.state === 'suspended') {
      mobileAudioContext.resume().catch(() => {});
    }
  } catch (e) {}
}

function releaseMobileAudioLock() {
  if (mobileSilentAudio) {
    try { mobileSilentAudio.pause(); } catch (e) {}
  }
}

function loadYouTubeIframeApi() {
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

function initPlayer(element) {
  if (ytPlayerInstance && isPlayerReady) return Promise.resolve(ytPlayerInstance);

  return loadYouTubeIframeApi().then((YT) => {
    return new Promise((resolve) => {
      new YT.Player(element, {
        host: 'https://www.youtube-nocookie.com',
        width: '64',
        height: '64',
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

  const containerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const activePlaylistKeyRef = useRef(playlistKey);
  const trackIndexRef = useRef(trackIndex);
  const isPlayingRef = useRef(isPlaying);
  const nextTrackHandlerRef = useRef(() => {});
  const pendingActionRef = useRef(null);
  const workerRef = useRef(null);

  const currentPlaylist = playlists[playlistKey] || playlists[PLAYLIST_KEYS[0]];
  const tracks = currentPlaylist?.tracks || [];
  const currentTrack = tracks[trackIndex] ?? tracks[0] ?? {};

  useEffect(() => {
    activePlaylistKeyRef.current = playlistKey;
  }, [playlistKey]);

  useEffect(() => {
    trackIndexRef.current = trackIndex;
  }, [trackIndex]);

  // Manage Web Worker heartbeat for unthrottled background playback
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      acquireMobileAudioLock();
      if (workerRef.current) {
        workerRef.current.start();
      }
    } else {
      releaseMobileAudioLock();
      if (workerRef.current) {
        workerRef.current.stop();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    // Initialize unthrottled worker
    const worker = createBackgroundHeartbeatWorker(() => {
      const player = getPlayer();
      if (!player) return;

      // When tab is hidden / mobile screen is locked:
      if (document.hidden && isPlayingRef.current) {
        acquireMobileAudioLock();
        try {
          if (typeof player.getPlayerState === 'function') {
            const state = player.getPlayerState();
            // If mobile OS suspended the player into paused state (2)
            if (state === YT_PLAYER_STATES.PAUSED) {
              player.playVideo();
            }
          }
        } catch (e) {}
      }

      // Keep position updated
      try {
        if (typeof player.getCurrentTime === 'function') {
          const rawTime = player.getCurrentTime();
          const startTime = currentTrack.start ?? 0;
          const elapsedTime = Math.max(0, rawTime - startTime);
          setCurrentTime(elapsedTime);

          if (currentTrack.end != null && rawTime >= currentTrack.end) {
            goNext();
          }
        }
      } catch (e) {}
    });

    workerRef.current = worker;

    globalReadyHandler = (player) => {
      if (pendingActionRef.current) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        executePlayAction(action.pKey, action.tIndex, action.autoplay, player);
      }
    };

    globalStateChangeHandler = (event) => {
      const player = getPlayer();

      if (event.data === YT_PLAYER_STATES.PLAYING) {
        setIsPlaying(true);
        acquireMobileAudioLock();
        syncPlaylistTrackIndex(player);
      } else if (event.data === YT_PLAYER_STATES.PAUSED) {
        // If mobile OS attempted to pause because tab is minimized / screen is locked, auto-resume
        if (document.hidden && isPlayingRef.current) {
          acquireMobileAudioLock();
          if (player && typeof player.playVideo === 'function') {
            setTimeout(() => {
              try { player.playVideo(); } catch (e) {}
            }, 100);
          }
        } else {
          setIsPlaying(false);
        }
      } else if (event.data === YT_PLAYER_STATES.ENDED) {
        setIsPlaying(false);
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

    return () => {
      if (workerRef.current) {
        workerRef.current.stop();
      }
    };
  }, []);

  // Listen for screen off & tab visibility changes to keep background audio alive
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isPlayingRef.current) {
        acquireMobileAudioLock();
        const player = getPlayer();
        if (player && typeof player.playVideo === 'function') {
          try {
            player.playVideo();
          } catch (e) {}
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
    };
  }, []);

  // Sync YouTube playlist index with React state
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
    } catch (e) {}
  }

  // MediaSession API for Lockscreen and Notification Bar controls
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const title = currentTrack?.title || 'Devi Agomoni';
        const artist = currentTrack?.subtitle || 'Durga Puja Special';
        const videoId = currentTrack?.videoId || currentPlaylist?.youtubeVideoId;
        const coverUrl = videoId
          ? 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'
          : 'https://www.devipaksha.in/thumbnail.png';

        navigator.mediaSession.metadata = new MediaMetadata({
          title: title,
          artist: artist,
          album: 'দেবীপক্ষ — Devi Paksha',
          artwork: [
            { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ],
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => {
          acquireMobileAudioLock();
          togglePlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          togglePlay();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          goPrev();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          goNext();
        });
      } catch (e) {
        console.warn('MediaSession notice:', e);
      }
    }
  }, [currentTrack, isPlaying, playlistKey]);

  // Sync lockscreen position state
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      const calcDur = Math.max(0, (currentTrack.end ?? duration) - (currentTrack.start ?? 0));
      if (calcDur > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: calcDur,
            playbackRate: 1,
            position: Math.min(currentTime, calcDur),
          });
        } catch (e) {}
      }
    }
  }, [currentTime, duration, currentTrack]);

  function executePlayAction(pKey, tIndex, autoplay, playerInstance) {
    const player = playerInstance || getPlayer();
    if (!player) return;

    acquireMobileAudioLock();

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
            setTimeout(() => { try { player.pauseVideo(); } catch (e) {} }, 500);
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
    acquireMobileAudioLock();
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
    acquireMobileAudioLock();
    setPlaylistKey(pKey);
    setTrackIndex(tIndex);
    playTrackAt(pKey, tIndex, { autoplay: true });
  }

  function goNext() {
    acquireMobileAudioLock();
    const plTracks = playlists[activePlaylistKeyRef.current]?.tracks || [];
    if (plTracks.length === 0) return;
    setTrackIndex((prevIndex) => {
      const nextIdx = (prevIndex + 1) % plTracks.length;
      playTrackAt(activePlaylistKeyRef.current, nextIdx, { autoplay: true });
      return nextIdx;
    });
  }

  function goPrev() {
    acquireMobileAudioLock();
    const plTracks = playlists[activePlaylistKeyRef.current]?.tracks || [];
    if (plTracks.length === 0) return;
    setTrackIndex((prevIndex) => {
      const prevIdx = (prevIndex - 1 + plTracks.length) % plTracks.length;
      playTrackAt(activePlaylistKeyRef.current, prevIdx, { autoplay: true });
      return prevIdx;
    });
  }

  useEffect(() => {
    nextTrackHandlerRef.current = goNext;
  });

  function togglePlay() {
    acquireMobileAudioLock();
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
      selectPlaylist,
      selectTrack,
      goNext,
      goPrev,
      togglePlay,
      seekTo,
    }),
    [playlistKey, currentPlaylist, trackIndex, currentTrack, isPlaying, currentTime, calcDuration, canSkip]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* 
        Must have normal non-zero dimensions (64x64) and fixed in viewport so mobile browsers
        (Android Chrome & iOS Safari) do not freeze the YouTube player process when screen locks or minimizes!
      */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '64px',
          height: '64px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -50,
          transform: 'translate3d(0,0,0)',
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
