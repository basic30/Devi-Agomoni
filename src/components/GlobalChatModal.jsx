import React, { useState, useEffect, useRef } from 'react';
import { useGlobalChat } from '../hooks/useGlobalChat';
import { usePresence } from '../hooks/usePresence';
import { CloseIcon, SendIcon, ChatIcon } from './Icons';

const QUICK_EMOJIS = ['🌺', '🥁', '🪔', '🙏', '✨', '❤️', '💛'];

export function GlobalChatModal({ open, onClose }) {
  const { messages, nickname, avatarGradient, isLiveConnected, sendMessage, updateNickname } = useGlobalChat();
  const { count } = usePresence();
  const [inputText, setInputText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(nickname);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  }

  function handleSaveName(e) {
    e.preventDefault();
    if (tempName.trim()) {
      updateNickname(tempName);
      setIsEditingName(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xl animate-overlay-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="
          relative flex h-[82vh] w-full max-w-lg flex-col overflow-hidden
          rounded-[32px] border border-white/15 bg-white/7
          backdrop-blur-2xl backdrop-saturate-150
          shadow-[0_20px_80px_rgba(0,0,0,0.6)]
          animate-overlay-scale-in
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#f1d449]/20 text-[#f1d449]">
              <ChatIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-tagline text-sm font-semibold uppercase tracking-wider text-white">
                  Global Adda
                </h2>
                <span className="flex items-center gap-1.5 rounded-full bg-green-400/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-online-pulse" />
                  {isLiveConnected ? 'Live World Relay' : `${count} online`}
                </span>
              </div>
              <p className="text-[11px] text-white/50">Anonymous live chat for Durga Puja lovers on all devices</p>
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

        {/* User Identity Banner */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-2.5 text-xs text-white/70">
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={24}
                className="flex-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white outline-none focus:border-[#f1d449]"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-full bg-[#f1d449] px-3 py-1 text-[11px] font-semibold text-black hover:bg-[#f1d449]/90"
              >
                Save
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${avatarGradient}`} />
                <span>Chatting as: <strong className="text-white">{nickname}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempName(nickname);
                  setIsEditingName(true);
                }}
                className="text-[11px] text-[#f1d449] hover:underline"
              >
                Change handle
              </button>
            </>
          )}
        </div>

        {/* Messages List */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 playlist-scroll">
          {messages.map((msg) => {
            const isMe = msg.sender === nickname;
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-tr ${
                    msg.avatarColor || 'from-amber-400 to-red-500'
                  } text-[11px] font-bold text-white shadow`}
                >
                  {msg.sender.charAt(0).toUpperCase()}
                </div>

                {/* Message Content */}
                <div className={`max-w-[78%] ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`text-[11px] font-medium ${isMe ? 'text-[#f1d449]' : 'text-white/70'}`}>
                      {msg.sender} {isMe && '(You)'}
                    </span>
                    <span className="text-[10px] tabular-nums text-white/40">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`inline-block rounded-2xl px-4 py-2.5 text-xs font-normal shadow-sm ${
                      isMe
                        ? 'bg-[#f1d449] text-black rounded-tr-none'
                        : 'bg-white/10 text-white border border-white/10 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Emoji Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-white/5 px-4 py-2">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-white/40">Reactions:</span>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendMessage(emoji)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-sm transition hover:bg-white/15 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 p-3 bg-white/5">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Write a message to everyone online..."
            maxLength={300}
            className="flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-xs text-white placeholder-white/40 outline-none focus:border-[#f1d449] focus:bg-white/15 transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#f1d449] text-black shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
