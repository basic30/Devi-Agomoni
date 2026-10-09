import React, { useState, useEffect, useRef } from 'react';
import { useFriendGroup } from '../context/FriendGroupContext';
import { usePlayer } from '../context/PlayerContext';
import { CloseIcon } from './Icons';
import { getTrackCoverUrl, handleImageFallback } from './PlayerBar';

const QUICK_EMOJIS = ['🌺', '🥁', '🪔', '🎵', '✨', '❤️', '💃', '🙌'];

function formatMemberLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline';
  const diffSec = Math.floor((Date.now() - lastSeen) / 1000);
  if (diffSec < 45) return 'Just went offline';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  return `Last seen ${Math.floor(diffHours / 24)}d ago`;
}

export function FriendGroupModal({ open, onClose, onOpenPlaylist, initialCode = '' }) {
  const {
    activeGroup,
    isInGroup,
    isCurrentUserAdmin,
    members,
    onlineMembers,
    offlineMembers,
    onlineCount,
    isMemberOnline,
    nowTick,
    messages,
    nickname,
    deviceId,
    updateNickname,
    createGroup,
    joinGroup,
    leaveGroup,
    disbandGroup,
    sendChatMessage,
    sendReaction,
    isSyncConnected,
    activateGroupSync,
    isBroadcaster,
    broadcasterName,
  } = useFriendGroup();

  // Activate group audio sync when user opens the group modal
  useEffect(() => {
    if (open && isInGroup && activateGroupSync) {
      activateGroupSync();
    }
  }, [open, isInGroup, activateGroupSync]);

  const {
    playlist,
    track,
    currentPlaylist,
    currentTrack,
    playlistKey,
    trackIndex,
    isPlaying,
    togglePlay,
    goNext,
    goPrev,
  } = usePlayer();

  // Navigation tab inside modal when in group: 'chat' | 'members'
  const [activeTab, setActiveTab] = useState('chat');
  const [memberFilter, setMemberFilter] = useState('all'); // 'all' | 'online' | 'offline'

  // Initial form states (Create vs Join)
  const [mode, setMode] = useState(initialCode ? 'join' : 'create');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState(nickname || '');
  const [inviteCodeInput, setInviteCodeInput] = useState(initialCode || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [syncToast, setSyncToast] = useState('');

  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (initialCode) {
      setInviteCodeInput(initialCode.toUpperCase());
      setMode('join');
    }
  }, [initialCode]);

  useEffect(() => {
    if (nickname) {
      setNicknameInput(nickname);
    }
  }, [nickname]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCreate = (e) => {
    e.preventDefault();
    setErrorMessage('');
    const name = groupNameInput.trim() || 'Pujo Night Adda';
    const nick = nicknameInput.trim() || nickname || 'Pujo Lover';
    try {
      createGroup(name, nick);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create group.');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (activateGroupSync) activateGroupSync();
    setErrorMessage('');
    const code = inviteCodeInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) {
      setErrorMessage('Please enter an invite code.');
      return;
    }
    const nick = nicknameInput.trim() || nickname || 'Pujo Friend';
    setIsVerifying(true);
    try {
      const res = await joinGroup(code, nick);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    } catch (err) {
      setErrorMessage('Failed to join group.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeGroup?.inviteCode) return;
    navigator.clipboard.writeText(activeGroup.inviteCode).then(() => {
      setCopyStatus('Code copied! 📋');
      setTimeout(() => setCopyStatus(''), 2500);
    });
  };

  const handleCopyShareLink = () => {
    if (!activeGroup?.inviteCode) return;
    const url = `${window.location.origin}/?group=${activeGroup.inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyStatus('Share link copied! 🔗');
      setTimeout(() => setCopyStatus(''), 2500);
    });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    sendChatMessage(text);
    setChatInput('');
  };

  const activeTrack = track || currentTrack || playlist?.tracks?.[trackIndex] || {};
  const activePlaylist = playlist || currentPlaylist || {};
  const coverUrl = getTrackCoverUrl(activeTrack, activePlaylist);
  const videoId = activeTrack?.videoId || activePlaylist?.youtubeVideoId;

  // Sort members: current user (You) first, then online members, then offline members
  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === deviceId) return -1;
    if (b.id === deviceId) return 1;
    const aOnline = isMemberOnline ? isMemberOnline(a) : (a.id === deviceId || Date.now() - (a.lastSeen || 0) < 20000);
    const bOnline = isMemberOnline ? isMemberOnline(b) : (b.id === deviceId || Date.now() - (b.lastSeen || 0) < 20000);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const displayedMembers = sortedMembers.filter((m) => {
    if (memberFilter === 'online') {
      return isMemberOnline ? isMemberOnline(m) : (m.id === deviceId || Date.now() - (m.lastSeen || 0) < 20000);
    }
    if (memberFilter === 'offline') {
      return isMemberOnline ? !isMemberOnline(m) : (m.id !== deviceId && Date.now() - (m.lastSeen || 0) >= 20000);
    }
    return true; // 'all'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xl animate-overlay-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="
          relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden
          rounded-[32px] border border-white/15 bg-[#121016]/90
          backdrop-blur-2xl backdrop-saturate-150
          shadow-[0_24px_90px_rgba(0,0,0,0.7)]
          animate-overlay-scale-in text-white
        "
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1d449]/20 text-[#f1d449]">
              <span className="text-base">👥</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">
                {isInGroup ? activeGroup.groupName : 'Pujo Adda (Friend Group)'}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-white/50">
                {isInGroup ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-emerald-400 font-medium">
                      {onlineCount} {onlineCount === 1 ? 'member' : 'members'} online
                    </span>
                    <span className="text-white/40">
                      • {members.length} {members.length === 1 ? 'member' : 'members'} total
                    </span>
                    {isCurrentUserAdmin && (
                      <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                        Admin 👑
                      </span>
                    )}
                  </>
                ) : (
                  <span>Listen to music together in real-time</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
          >
            <CloseIcon />
          </button>
        </div>

        {/* BODY */}
        {!isInGroup ? (
          /* ================= VIEW 1: CREATE OR JOIN GROUP ================= */
          <div className="flex-1 overflow-y-auto p-5 space-y-5 playlist-scroll">
            {/* Mode Tabs */}
            <div className="flex rounded-full bg-white/10 p-1">
              <button
                type="button"
                onClick={() => { setMode('create'); setErrorMessage(''); }}
                className={`flex-1 rounded-full py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  mode === 'create'
                    ? 'bg-[#f1d449] text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Create Group 👑
              </button>
              <button
                type="button"
                onClick={() => { setMode('join'); setErrorMessage(''); }}
                className={`flex-1 rounded-full py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  mode === 'join'
                    ? 'bg-[#f1d449] text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Join Group 🔑
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            {mode === 'create' ? (
              /* CREATE GROUP FORM */
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3.5">
                  <h3 className="text-xs font-semibold text-amber-300/90 uppercase tracking-widest">
                    Group Details
                  </h3>
                  <div>
                    <label className="block text-[11px] font-medium text-white/60 mb-1">
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      placeholder="e.g. Kolkata Pujo Night Adda"
                      maxLength={40}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-white/30 focus:border-[#f1d449] focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-white/60 mb-1">
                      Your Nickname (Admin)
                    </label>
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="e.g. Snahasish"
                      maxLength={25}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-white/30 focus:border-[#f1d449] focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-white/60 leading-relaxed">
                  <span className="font-semibold text-white">How it works:</span> You become the group <span className="text-[#f1d449]">Admin 👑</span>. You get a unique invite code to share with friends. When anyone plays, pauses, or changes a song, it syncs instantly on everyone's phone/laptop!
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-gradient-to-r from-[#f1d449] to-[#dfb828] py-3 text-xs font-bold uppercase tracking-wider text-black shadow-[0_4px_20px_rgba(241,212,73,0.35)] transition hover:brightness-110 active:scale-[0.98]"
                >
                  Create Group & Get Code 👑
                </button>
              </form>
            ) : (
              /* JOIN GROUP FORM */
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3.5">
                  <h3 className="text-xs font-semibold text-amber-300/90 uppercase tracking-widest">
                    Enter Group Code
                  </h3>
                  <div>
                    <label className="block text-[11px] font-medium text-white/60 mb-1">
                      Invite Code
                    </label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="e.g. PUJA-8472 or 8472"
                      maxLength={15}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck="false"
                      style={{ textTransform: 'uppercase' }}
                      disabled={isVerifying}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-base font-mono font-semibold tracking-wider text-center text-[#f1d449] placeholder-white/25 focus:border-[#f1d449] focus:outline-none transition uppercase disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-white/60 mb-1">
                      Your Nickname
                    </label>
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="e.g. Priya / Rahul"
                      maxLength={25}
                      disabled={isVerifying}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-white/30 focus:border-[#f1d449] focus:outline-none transition disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-white/60 leading-relaxed">
                  <span className="font-semibold text-white">Late Joiner Sync:</span> Even if you join in the middle of a song, the player will start right from the current playing timestamp — never from the start!
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full rounded-full bg-gradient-to-r from-[#f1d449] to-[#dfb828] py-3 text-xs font-bold uppercase tracking-wider text-black shadow-[0_4px_20px_rgba(241,212,73,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isVerifying ? 'Connecting to Group... ⏳' : 'Join Group & Sync Music 🎵'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ================= VIEW 2: INSIDE ACTIVE GROUP ROOM ================= */
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top Share & Controls Banner */}
            <div className="border-b border-white/10 bg-black/30 px-5 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Invite Code:</span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-[#f1d449] ring-1 ring-white/15">
                    {activeGroup.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/20 transition"
                    title="Copy code"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/20 transition hidden sm:inline-block"
                    title="Copy link"
                  >
                    Share Link
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {isCurrentUserAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to disband this group for everyone?')) {
                          disbandGroup();
                        }
                      }}
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition"
                      title="Disband group"
                    >
                      Disband
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Leave this group? You can join or create another group anytime.')) {
                        leaveGroup();
                      }
                    }}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70 hover:bg-red-500/20 hover:text-red-300 transition"
                  >
                    Leave
                  </button>
                </div>
              </div>

              {copyStatus && (
                <div className="text-[11px] font-medium text-emerald-400 animate-fadeIn">
                  {copyStatus}
                </div>
              )}
              {syncToast && (
                <div className="text-[11px] font-medium text-amber-300 animate-fadeIn">
                  {syncToast}
                </div>
              )}
            </div>

            {/* Now Playing Synced Live Radio Stream Bar */}
            <div className="border-b border-white/10 bg-gradient-to-r from-amber-950/40 via-black/50 to-black/30 px-5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageFallback(e, videoId)}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        {isBroadcaster ? '🎙️ YOUR LIVE BROADCAST' : '📻 LIVE RADIO STREAM'}
                      </span>
                      {isPlaying && (
                        <div className="flex items-center gap-0.5">
                          <span className="h-2 w-0.5 animate-pulse bg-emerald-400" />
                          <span className="h-3 w-0.5 animate-pulse bg-emerald-400 delay-75" />
                          <span className="h-1.5 w-0.5 animate-pulse bg-emerald-400 delay-150" />
                        </div>
                      )}
                    </div>
                    <p className="truncate text-xs font-semibold text-white">
                      {activeTrack?.title || 'No song selected'}
                    </p>
                    <p className="truncate text-[10px] text-white/50">
                      {isBroadcaster ? 'You have full DJ control over the stream' : `Streaming live from ${broadcasterName || 'Radio Host'}`}
                    </p>
                  </div>
                </div>

                {/* Synced playback controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isBroadcaster ? (
                    <>
                      <button
                        type="button"
                        onClick={goPrev}
                        aria-label="Previous"
                        className="grid h-7 w-7 place-items-center rounded-full text-white/70 hover:bg-white/15 transition"
                        title="Previous Track"
                      >
                        ⏮
                      </button>
                      <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="grid h-8 w-8 place-items-center rounded-full bg-[#f1d449] text-black shadow-md transition hover:scale-105 active:scale-95"
                        title={isPlaying ? 'Pause broadcast for all' : 'Play broadcast for all'}
                      >
                        {isPlaying ? '⏸' : '▶'}
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        aria-label="Next"
                        className="grid h-7 w-7 place-items-center rounded-full text-white/70 hover:bg-white/15 transition"
                        title="Next Track"
                      >
                        ⏭
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenPlaylist) onOpenPlaylist();
                        }}
                        className="ml-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-[#f1d449] hover:bg-white/20 transition"
                        title="Choose any song to stream to everyone"
                      >
                        Change Song 🎵
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (activateGroupSync) activateGroupSync();
                          setSyncToast('Locked into live stream! 📻');
                          setTimeout(() => setSyncToast(''), 2500);
                        }}
                        className="flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/30 px-2.5 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/30 transition active:scale-95"
                        title="Sync directly to live radio broadcast"
                      >
                        <span>🔄</span>
                        <span>Sync Live</span>
                      </button>
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition active:scale-95"
                        title={isPlaying ? 'Mute/Pause on your device only' : 'Listen live'}
                      >
                        {isPlaying ? '🔊' : '🔈'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Room Tabs: Chat vs Members */}
            <div className="flex border-b border-white/10 px-4 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex-1 border-b-2 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'chat'
                    ? 'border-[#f1d449] text-[#f1d449]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                💬 Group Chat ({messages.filter((m) => m.type === 'chat').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`flex-1 border-b-2 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'members'
                    ? 'border-[#f1d449] text-[#f1d449]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                👥 Members ({members.length}) • <span className="text-emerald-400">{onlineCount} Online</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'chat' ? (
              /* ================= CHAT STREAM ================= */
              <div className="flex flex-1 flex-col overflow-hidden">
                <div ref={chatScrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-4 playlist-scroll">
                  {messages.map((m) => {
                    if (m.type === 'system') {
                      return (
                        <div key={m.id} className="flex justify-center my-1">
                          <span className="rounded-full bg-white/7 px-3 py-1 text-[10px] text-amber-200/80 border border-white/5">
                            {m.text}
                          </span>
                        </div>
                      );
                    }

                    const isMine = m.senderId === deviceId;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        {!isMine && (
                          <span className="text-[10px] text-white/50 mb-0.5 ml-1">
                            {m.senderName}
                          </span>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            isMine
                              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium shadow-sm'
                              : 'bg-white/10 text-white border border-white/10'
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="text-[9px] text-white/30 mt-0.5 px-1">
                          {m.timestamp}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Emoji Reactions */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border-t border-white/5 overflow-x-auto">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => sendReaction(emoji)}
                      className="rounded-full bg-white/5 hover:bg-white/15 px-2 py-0.5 text-xs transition active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendChat} className="flex items-center gap-2 border-t border-white/10 p-3 bg-black/60">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message friends in group..."
                    maxLength={150}
                    className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white placeholder-white/40 focus:border-[#f1d449] focus:outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="rounded-full bg-[#f1d449] px-4 py-2 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-40"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              /* ================= MEMBERS LIST ================= */
              <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
                {/* Filter & Live Count Summary Bar */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        memberFilter === 'all'
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      All ({members.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('online')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        memberFilter === 'online'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 shadow-sm'
                          : 'text-emerald-400/70 hover:text-emerald-300'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online ({onlineCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('offline')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        memberFilter === 'offline'
                          ? 'bg-white/15 text-white/90 border border-white/10 shadow-sm'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                      Offline ({Math.max(0, members.length - onlineCount)})
                    </button>
                  </div>

                  <span className="text-[10px] text-white/40 hidden sm:inline">
                    {onlineCount} listening in sync
                  </span>
                </div>

                {/* Member Roster List */}
                <div className="flex-1 overflow-y-auto space-y-2 playlist-scroll pr-0.5">
                  {displayedMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <span className="text-2xl mb-1">👥</span>
                      <p className="text-xs text-white/40">No {memberFilter} members right now.</p>
                    </div>
                  ) : (
                    displayedMembers.map((mem) => {
                      const isSelf = mem.id === deviceId;
                      const isOnline = isMemberOnline
                        ? isMemberOnline(mem)
                        : (isSelf || Date.now() - (mem.lastSeen || 0) < 20000);

                      return (
                        <div
                          key={mem.id}
                          className={`group flex items-center justify-between gap-3 rounded-2xl p-3 border transition ${
                            isOnline
                              ? 'bg-white/[0.06] border-emerald-500/20 shadow-[0_2px_12px_rgba(0,0,0,0.2)]'
                              : 'bg-white/[0.02] border-white/5 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar with status indicator ring */}
                            <div className="relative flex-shrink-0">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr ${
                                  mem.avatar || 'from-amber-400 to-red-500'
                                } text-sm font-bold text-black shadow-inner`}
                              >
                                {(mem.name || 'P').charAt(0).toUpperCase()}
                              </div>
                              {/* Online/Offline status dot on avatar */}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#121016] ${
                                  isOnline ? 'bg-emerald-400' : 'bg-zinc-600'
                                }`}
                              >
                                {isOnline && (
                                  <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                )}
                              </span>
                            </div>

                            {/* Name & status info */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-semibold text-white truncate max-w-[130px] sm:max-w-[190px]">
                                  {mem.name || 'Friend'}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] text-amber-300 font-medium">
                                    (You)
                                  </span>
                                )}
                                {mem.isAdmin && (
                                  <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                                    👑 Admin
                                  </span>
                                )}
                              </div>

                              {/* Activity description */}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-white/50">
                                  {isOnline ? '🎵 Listening in sync' : formatMemberLastSeen(mem.lastSeen)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Online / Offline Toggle Switch Pill */}
                          <div className="flex-shrink-0">
                            <div
                              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                isOnline
                                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                  : 'border border-white/10 bg-white/5 text-white/40'
                              }`}
                              title={isOnline ? 'Online: Playing in sync' : 'Offline: Currently away'}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-white/30'
                                }`}
                              />
                              <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
