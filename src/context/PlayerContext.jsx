import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { playlists, PLAYLIST_KEYS } from '../data/playlists';

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

// Improved silent audio implementation for better browser compatibility
// This creates a small silent MP3/WAV that grants audio focus on mobile
const SILENT_AUDIO_DATA = () => {
  // Create a silent audio using Web Audio API as fallback
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = audioContext.createBuffer(2, audioContext.sampleRate * 0.5, audioContext.sampleRate);
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (e) {
    // Fallback: return data URL for silent WAV
    return 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
  }
};

let audioFocusElement = null;
let audioFocusActive = false;

function acquireAudioFocus() {
  if (typeof window === 'undefined') return;
  try {
    if (!audioFocusElement) {
      const audioData = SILENT_AUDIO_DATA();
      audioFocusElement = new Audio(audioData);
      audioFocusElement.loop = true;
      audioFocusElement.muted = false;
      audioFocusElement.volume = 0.01; // Very low volume - just for audio focus
      audioFocusElement.preload = 'auto';
    }
    if (!audioFocusActive) {
      const playPromise = audioFocusElement.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          audioFocusActive = true;
          console.log('Audio focus acquired');
        }).catch((err) => {
          console.warn('Could not acquire audio focus:', err.message);
        });
      } else {
        audioFocusActive = true;
      }
    }
  } catch (e) {
    console.warn('Error acquiring audio focus:', e);
  }
}

function releaseAudioFocus() {
  if (audioFocusElement && audioFocusActive) {
    try {
      audioFocusElement.pause();
      audioFocusElement.currentTime = 0;
      audioFocusActive = false;
      console.log('Audio focus released');
    } catch (e) {
      console.warn('Error releasing audio focus:', e);
    }
  }
}

function loadYouTubeIframeApi() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('YouTube API failed to load within 15 seconds'));
      }, 15000);

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        if (prevCallback) prevCallback();
        resolve(window.YT);
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load YouTube API script'));
      };
      document.head.appendChild(script);
    });
  }
  return ytApiPromise;
}

function initPlayer(element) {
  if (ytPlayerInstance && isPlayerReady) return Promise.resolve(ytPlayerInstance);

  return loadYouTubeIframeApi().then((YT) => {
    return new Promise((resolve, reject) => {
      try {
        new YT.Player(element, {
          host: 'https://www.youtube-nocookie.com',
          width: '300',
          height: '300',
          playerVars: {
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            autoplay: 1,
          },
          events: {
            onReady: (event) => {
              ytPlayerInstance = event.target;
              isPlayerReady = true;
              console.log('YouTube player ready');
              if (globalReadyHandler) {
                globalReadyHandler(event.target);
              }
              resolve(event.target);
            },
            onError: (event) => {
              console.error('YouTube player error:', event.data);
              reject(new Error(`YouTube player error: ${event.data}`));
            },
            onStateChange: (event) => {
              if (globalStateChangeHandler) {
                globalStateChangeHandler(event);
              }
            },
          },
        });
      } catch (err) {
        console.error('Error initializing YouTube player:', err);
        reject(err);
      }
    });
  }).catch((err) => {
    console.error('Failed to load YouTube API:', err);
    throw err;
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
    } else {
      releaseAudioFocus();
    }
  }, [isPlaying]);

  // Initialize player on component mount and set up user interaction listeners
  useEffect(() => {
    let userInteracted = false;
    
    function handleUserInteraction() {
      if (!userInteracted) {
        userInteracted = true;
        console.log('User interacted - initializing YouTube player');
        if (containerRef.current) {
          initPlayer(containerRef.current).catch(err => {
            console.warn('Failed to initialize player on user interaction:', err);
          });
        }
      }
    }

    // Initialize player immediately (it will load the API)
    if (containerRef.current) {
      initPlayer(containerRef.current).catch(err => {
        console.warn('Failed to initialize player on mount:', err);
      });
    }

    // Add user interaction listeners for browser autoplay policies
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

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
        // If mobile OS attempted to pause because tab is minimized / screen is locked, auto-resume
        if (document.hidden && isPlayingRef.current) {
          acquireAudioFocus();
          if (player && typeof player.playVideo === 'function') {
            setTimeout(() => {
              try { 
                player.playVideo(); 
              } catch (e) {
                console.warn('Error resuming video:', e);
              }
            }, 200);
          }
        } else {
          setIsPlaying(false);
          // Only release audio focus if user explicitly paused
          if (!document.hidden) {
            releaseAudioFocus();
          }
        }
      } else if (event.data === YT_PLAYER_STATES.ENDED) {
        setIsPlaying(false);
        releaseAudioFocus();
        const pl = playlists[activePlaylistKeyRef.current];
        if (pl) {
          nextTrackHandlerRef.current();
        }
      }

      if (player && typeof player.getDuration === 'function') {
        const dur = player.getDuration();
        if (dur > 0) {
          setDuration(dur);
        }
      }
    };

    if (containerRef.current) {
      initPlayer(containerRef.current);
    }
  }, []);

  // When returning to website or unlocking screen, auto-resume if expected to play
  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden && isPlayingRef.current) {
        acquireAudioFocus();
        const player = getPlayer();
        if (player && typeof player.playVideo === 'function') {
          try {
            if (typeof player.getPlayerState === 'function') {
              const state = player.getPlayerState();
              if (state === YT_PLAYER_STATES.PAUSED || state === YT_PLAYER_STATES.CUED || state === YT_PLAYER_STATES.UNSTARTED) {
                setTimeout(() => {
                  try {
                    player.playVideo();
                  } catch (e) {
                    console.warn('Error auto-resuming playback:', e);
                  }
                }, 100);
              }
            }
          } catch (e) {
            console.warn('Error in visibility change handler:', e);
          }
        }
      } else if (document.hidden && isPlayingRef.current) {
        // Ensure audio focus is maintained when tab is hidden
        acquireAudioFocus();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
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
          acquireAudioFocus();
          const player = getPlayer();
          if (player && typeof player.playVideo === 'function') {
            player.playVideo();
          } else {
            togglePlay();
          }
          setIsPlaying(true);
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          const player = getPlayer();
          if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
          } else {
            togglePlay();
          }
          setIsPlaying(false);
          releaseAudioFocus();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          goPrev();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          goNext();
        });

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

  // Sync lockscreen position state
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      const calcDur = Math.max(0, (currentTrack.end ?? duration) - (currentTrack.start ?? 0));
      if (calcDur > 0 && currentTime >= 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: calcDur,
            playbackRate: isPlaying ? 1 : 0,
            position: Math.min(currentTime, calcDur),
          });
        } catch (e) {}
      }
    }
  }, [currentTime, duration, currentTrack, isPlaying]);

  // Time update loop
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
    if (!player) {
      console.warn('Player instance not available for play action');
      return;
    }

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
              if (autoplay && typeof player.playVideo === 'function') {
                setTimeout(() => player.playVideo(), 100);
              }
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
          if (autoplay && typeof player.playVideo === 'function') {
            setTimeout(() => player.playVideo(), 500);
          } else if (!autoplay && typeof player.pauseVideo === 'function') {
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
          if (typeof player.playVideo === 'function') {
            setTimeout(() => player.playVideo(), 100);
          }
        } else {
          if (typeof player.pauseVideo === 'function') {
            player.pauseVideo();
          }
        }
      } else {
        currentVideoIdRef.current = videoId;
        if (autoplay) {
          if (typeof player.loadVideoById === 'function') {
            player.loadVideoById({ videoId, startSeconds: startSec });
            setTimeout(() => {
              if (typeof player.playVideo === 'function') {
                try {
                  player.playVideo();
                } catch (e) {
                  console.warn('Error playing video:', e);
                }
              }
            }, 500);
          }
        } else {
          if (typeof player.cueVideoById === 'function') {
            player.cueVideoById({ videoId, startSeconds: startSec });
          }
        }
      }
      setCurrentTime(0);
    } catch (err) {
      console.error('Error performing player action:', err);
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
    // Ensure player loads and plays with a small delay to allow state update
    setTimeout(() => {
      playTrackAt(pKey, tIndex, { autoplay: true });
    }, 50);
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
      console.log('Player not ready, initializing and playing...');
      playTrackAt(playlistKey, trackIndex, { autoplay: true });
      return;
    }

    if (isPlaying) {
      if (typeof player.pauseVideo === 'function') {
        try {
          player.pauseVideo();
        } catch (e) {
          console.warn('Error pausing video:', e);
        }
      }
    } else {
      const expectedVideoId = currentTrack.videoId || currentPlaylist.youtubeVideoId;
      if (currentVideoIdRef.current === expectedVideoId) {
        if (typeof player.playVideo === 'function') {
          try {
            player.playVideo();
          } catch (e) {
            console.warn('Error resuming video:', e);
            playTrackAt(playlistKey, trackIndex, { autoplay: true });
          }
        }
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
        id="youtube-player-container"
        style={{
          position: 'fixed',
          bottom: '-350px',
          right: '-350px',
          width: '300px',
          height: '300px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -50,
          visibility: 'hidden',
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
