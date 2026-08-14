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

// Silent WAV audio loop base64 (Grants Mobile OS Audio Focus & keeps Notification Bar visible)
const SILENT_AUDIO_WAV = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let audioFocusElement = null;

function acquireAudioFocus() {
  if (typeof window === 'undefined') return;
  try {
    if (!audioFocusElement) {
      audioFocusElement = new Audio(SILENT_AUDIO_WAV);
      audioFocusElement.loop = true;
      audioFocusElement.volume = 0.05;
    }
    audioFocusElement.play().catch(() => {});
  } catch (e) {}
}

function releaseAudioFocus() {
  if (audioFocusElement) {
    try {
      audioFocusElement.pause();
    } catch (e) {}
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

// Eagerly pre-initialize audioFocusElement & preload YouTube API on module load
if (typeof window !== 'undefined') {
  try {
    audioFocusElement = new Audio(SILENT_AUDIO_WAV);
    audioFocusElement.loop = true;
    audioFocusElement.volume = 0.05;
  } catch (e) {}
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
            } catch (e) {}

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
          } catch (e) {}
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

  useEffect(() => {
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
        acquireAudioFocus();
        syncPlaylistTrackIndex(player);
      } else if (event.data === YT_PLAYER_STATES.PAUSED) {
        if (document.hidden && isPlayingRef.current) {
          acquireAudioFocus();
          setTimeout(() => {
            const p = getPlayer();
            if (p && typeof p.playVideo === 'function') {
              try { p.playVideo(); } catch (e) {}
            }
          }, 60);
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
    } catch (e) {}
  }

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
          artwork: [
            { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
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

        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) {
            const calcDur = Math.max(0, (currentTrack.end ?? duration) - (currentTrack.start ?? 0));
            if (calcDur > 0) {
              seekTo(details.seekTime / calcDur);
            }
          }
        });
      } catch (e) {
        console.warn('MediaSession notice:', e);
      }
    }
  }, [currentTrack, isPlaying, playlistKey, duration]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        // Update playback state
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        
        // Update position state if available
        if ('setPositionState' in navigator.mediaSession) {
          const calcDur = Math.max(0, (currentTrack.end ?? duration) - (currentTrack.start ?? 0));
          if (calcDur > 0 && currentTime >= 0) {
            navigator.mediaSession.setPositionState({
              duration: calcDur,
              playbackRate: isPlaying ? 1 : 0,
              position: Math.min(currentTime, calcDur),
            });
          }
        }
      } catch (e) {
        console.warn('Error updating mediaSession state:', e);
      }
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
      } catch (e) {}
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying, playlistKey, trackIndex, currentTrack.start, currentTrack.end]);

  function executePlayAction(pKey, tIndex, autoplay, playerInstance) {
    const player = playerInstance || getPlayer();
    if (!player) return;

    acquireAudioFocus();

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
    acquireAudioFocus();
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
    acquireAudioFocus();
    setPlaylistKey(pKey);
    setTrackIndex(tIndex);
    playTrackAt(pKey, tIndex, { autoplay: true });
  }

  function goNext() {
    acquireAudioFocus();
    const plTracks = playlists[activePlaylistKeyRef.current]?.tracks || [];
    if (plTracks.length === 0) return;
    setTrackIndex((prevIndex) => {
      const nextIdx = (prevIndex + 1) % plTracks.length;
      playTrackAt(activePlaylistKeyRef.current, nextIdx, { autoplay: true });
      return nextIdx;
    });
  }

  function goPrev() {
    acquireAudioFocus();
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
    acquireAudioFocus();
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
