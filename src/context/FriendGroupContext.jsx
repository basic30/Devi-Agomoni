import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  realtimeBus,
  getPersistentDeviceId,
  getPersistentNickname,
  setPersistentNickname,
  getPersistentAvatarColor,
} from '../utils/realtime';
import { usePlayer } from './PlayerContext';

const FriendGroupContext = createContext(null);

const STORAGE_ACTIVE_GROUP_KEY = 'devi_friend_group_active_v1';
const STORAGE_GROUP_MESSAGES_KEY_PREFIX = 'devi_friend_group_msgs_';
const STORAGE_GROUP_MEMBERS_KEY_PREFIX = 'devi_friend_group_members_';

function formatMsgTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

function generateInviteCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  let code = 'PUJA-';
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 2; i++) {
    code += nums.charAt(Math.floor(Math.random() * nums.length));
  }
  return code;
}

export function FriendGroupProvider({ children }) {
  const { registerGroupSync, applyRemoteSync, getCurrentPlayerState, unlockAudio } = usePlayer();

  const [deviceId] = useState(() => getPersistentDeviceId());
  const [nickname, setNicknameState] = useState(() => getPersistentNickname());
  const [avatarGradient] = useState(() => getPersistentAvatarColor());

  const [activeGroup, setActiveGroup] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_ACTIVE_GROUP_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  });

  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isSyncConnected, setIsSyncConnected] = useState(true);
  const [hasActivatedGroupSync, setHasActivatedGroupSync] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Dynamic presence ticker: updates timestamp every 3 seconds to re-evaluate Online/Offline status
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const activeGroupRef = useRef(activeGroup);
  const nicknameRef = useRef(nickname);
  const membersRef = useRef(members);
  const hasActivatedGroupSyncRef = useRef(false);
  const broadcastChannelRef = useRef(null);
  const announcedJoinIdsRef = useRef(new Set());
  const lastRetainedStateRef = useRef(null);
  const [broadcasterId, setBroadcasterId] = useState(() => activeGroup?.adminId || null);
  const [broadcasterName, setBroadcasterName] = useState(() => activeGroup?.adminName || '');
  const broadcasterIdRef = useRef(broadcasterId);
  const broadcasterNameRef = useRef(broadcasterName);
  const isBroadcasterRef = useRef(false);

  useEffect(() => {
    broadcasterIdRef.current = broadcasterId;
  }, [broadcasterId]);

  useEffect(() => {
    broadcasterNameRef.current = broadcasterName;
  }, [broadcasterName]);

  const isBroadcaster = (!broadcasterId || broadcasterId === deviceId || !!activeGroup?.isCurrentUserAdmin);

  useEffect(() => {
    isBroadcasterRef.current = isBroadcaster;
  }, [isBroadcaster]);

  useEffect(() => {
    hasActivatedGroupSyncRef.current = hasActivatedGroupSync;
  }, [hasActivatedGroupSync]);

  // Stable refs for player functions to prevent effect re-runs
  const applyRemoteSyncRef = useRef(applyRemoteSync);
  const getCurrentPlayerStateRef = useRef(getCurrentPlayerState);

  useEffect(() => {
    applyRemoteSyncRef.current = applyRemoteSync;
  }, [applyRemoteSync]);

  useEffect(() => {
    getCurrentPlayerStateRef.current = getCurrentPlayerState;
  }, [getCurrentPlayerState]);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const updateNickname = useCallback((newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) return;
    setPersistentNickname(trimmed);
    setNicknameState(trimmed);
    setMembers((prev) =>
      prev.map((m) => (m.id === deviceId ? { ...m, name: trimmed } : m))
    );
  }, [deviceId]);

  // Save active group to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeGroup) {
      localStorage.setItem(STORAGE_ACTIVE_GROUP_KEY, JSON.stringify(activeGroup));
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_GROUP_KEY);
    }
  }, [activeGroup]);

  // Load chat messages and persistent members when activeGroup changes
  useEffect(() => {
    if (!activeGroup?.groupId) {
      setMessages([]);
      setMembers([]);
      announcedJoinIdsRef.current.clear();
      return;
    }

    // 1. Messages
    const msgsKey = STORAGE_GROUP_MESSAGES_KEY_PREFIX + activeGroup.groupId;
    try {
      const saved = localStorage.getItem(msgsKey);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([
          {
            id: 'sys-welcome-' + Date.now(),
            type: 'system',
            text: `🎉 Welcome to ${activeGroup.groupName}! Share invite code "${activeGroup.inviteCode}" with your friends.`,
            timestamp: formatMsgTime(),
          },
        ]);
      }
    } catch (e) {
      setMessages([]);
    }

    // 2. Members (Persistent roster - never lost on refresh or offline!)
    const membersKey = STORAGE_GROUP_MEMBERS_KEY_PREFIX + activeGroup.groupId;
    let loadedMembers = [];
    try {
      const savedMembers = localStorage.getItem(membersKey);
      if (savedMembers) {
        const parsed = JSON.parse(savedMembers);
        if (Array.isArray(parsed)) {
          loadedMembers = parsed;
        }
      }
    } catch (e) {}

    const selfIdx = loadedMembers.findIndex((m) => m.id === deviceId);
    const selfData = {
      id: deviceId,
      name: nicknameRef.current || 'You',
      avatar: avatarGradient,
      isAdmin: !!activeGroup.isCurrentUserAdmin,
      lastSeen: Date.now(),
    };

    if (selfIdx >= 0) {
      loadedMembers[selfIdx] = {
        ...loadedMembers[selfIdx],
        ...selfData,
      };
    } else {
      loadedMembers.unshift(selfData);
    }

    setMembers(loadedMembers);
  }, [activeGroup?.groupId, activeGroup?.groupName, activeGroup?.inviteCode, activeGroup?.isCurrentUserAdmin, deviceId, avatarGradient]);

  // Persist members whenever the roster updates
  useEffect(() => {
    if (!activeGroup?.groupId || members.length === 0) return;
    try {
      localStorage.setItem(
        STORAGE_GROUP_MEMBERS_KEY_PREFIX + activeGroup.groupId,
        JSON.stringify(members)
      );
    } catch (e) {}
  }, [activeGroup?.groupId, members]);

  // Append message and persist
  const addMessage = useCallback((msg) => {
    if (!msg || !msg.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      const next = [...prev, msg];
      if (activeGroupRef.current?.groupId) {
        try {
          localStorage.setItem(
            STORAGE_GROUP_MESSAGES_KEY_PREFIX + activeGroupRef.current.groupId,
            JSON.stringify(next.slice(-100))
          );
        } catch (e) {}
      }
      return next;
    });
  }, []);

  // Helper to publish events to both MQTT bus and local BroadcastChannel
  const publishGroupEvent = useCallback((eventData) => {
    const group = activeGroupRef.current;
    if (!group?.groupId) return;

    const topic = `devipaksha/group/${group.groupId}/events`;
    const payload = {
      ...eventData,
      groupId: group.groupId,
      senderId: deviceId,
      senderName: nicknameRef.current,
      senderAvatar: avatarGradient,
      sentAt: Date.now(),
    };

    realtimeBus.publish(topic, payload);

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(payload);
      } catch (e) {}
    }
  }, [deviceId, avatarGradient]);

  // Activate group audio sync (Triggered when user opens the group)
  const activateGroupSync = useCallback(() => {
    setHasActivatedGroupSync(true);
    hasActivatedGroupSyncRef.current = true;
    if (unlockAudio) unlockAudio();

    // If I am the active broadcaster, my player is the master! Never re-sync or reset myself!
    if (isBroadcasterRef.current) {
      return;
    }

    const curGroup = activeGroupRef.current;
    if (curGroup?.groupId) {
      const reqPayload = {
        type: 'REQUEST_STATE',
        groupId: curGroup.groupId,
        senderId: deviceId,
        sentAt: Date.now(),
      };
      realtimeBus.publish(`devipaksha/group/${curGroup.groupId}/events`, reqPayload);
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(reqPayload);
        } catch (e) {}
      }

      // Instant fast-sync from retained live radio beat on VERY FIRST CLICK!
      if (lastRetainedStateRef.current && applyRemoteSyncRef.current) {
        const retained = lastRetainedStateRef.current;
        const elapsedSec = Math.max(0, (Date.now() - (retained.sentAt || 0)) / 1000);
        if (elapsedSec < 14400) {
          const adjustedRetained = {
            ...retained,
            position: retained.isPlaying ? ((retained.position || 0) + elapsedSec) : (retained.position || 0),
          };
          applyRemoteSyncRef.current(adjustedRetained);
        }
      }
    }
  }, [deviceId, unlockAudio]);

  // Wire automatic music synchronization from local player to group (Live Radio DJ Control)
  useEffect(() => {
    if (!activeGroup) return;

    const unregister = registerGroupSync((syncData) => {
      setHasActivatedGroupSync(true);
      hasActivatedGroupSyncRef.current = true;

      const isCurrentBroadcaster = (!broadcasterIdRef.current || broadcasterIdRef.current === deviceId || activeGroupRef.current?.isCurrentUserAdmin);

      // ONLY THE BROADCASTER (OR ADMIN) CAN CONTROL GROUP PLAYBACK!
      // Listeners are locked into the radio stream and cannot pause/seek for the group!
      if (!isCurrentBroadcaster) {
        console.log('[Radio] Listener action blocked from broadcasting to group');
        return;
      }

      // Claim broadcaster role
      broadcasterIdRef.current = deviceId;
      setBroadcasterId(deviceId);
      setBroadcasterName(nicknameRef.current);

      const syncPayload = {
        type: 'MUSIC_SYNC',
        broadcasterId: deviceId,
        broadcasterName: nicknameRef.current,
        ...syncData,
      };

      publishGroupEvent(syncPayload);

      // Retain on both last_state and radio_stream
      if (activeGroupRef.current?.groupId) {
        const streamPayload = {
          ...syncPayload,
          type: 'RADIO_BEAT',
          groupId: activeGroupRef.current.groupId,
          senderId: deviceId,
          senderName: nicknameRef.current,
          sentAt: Date.now(),
        };

        realtimeBus.publish(
          `devipaksha/group/${activeGroupRef.current.groupId}/radio_stream`,
          streamPayload,
          { retain: true }
        );

        realtimeBus.publish(
          `devipaksha/group/${activeGroupRef.current.groupId}/last_state`,
          streamPayload,
          { retain: true }
        );
      }

      // Add friendly chat log for playback changes ONLY when user manually changes!
      if (syncData.action === 'PLAY') {
        addMessage({
          id: 'sys-play-' + Date.now(),
          type: 'system',
          text: `📻 ${nicknameRef.current} is streaming "${syncData.trackTitle || 'Mahalaya'}" live on radio`,
          timestamp: formatMsgTime(),
        });
      } else if (syncData.action === 'PAUSE') {
        addMessage({
          id: 'sys-pause-' + Date.now(),
          type: 'system',
          text: `⏸️ ${nicknameRef.current} paused the radio broadcast`,
          timestamp: formatMsgTime(),
        });
      } else if (syncData.action === 'MANUAL_TRACK_CHANGE') {
        addMessage({
          id: 'sys-change-' + Date.now(),
          type: 'system',
          text: `🎵 ${nicknameRef.current} changed radio stream to "${syncData.trackTitle || 'Mahalaya'}"`,
          timestamp: formatMsgTime(),
        });
      }
    });

    return unregister;
  }, [activeGroup, registerGroupSync, publishGroupEvent, addMessage, deviceId]);


  // Live Radio Broadcaster Heartbeat (Every 3.5s while host is playing)
  useEffect(() => {
    if (!activeGroup?.groupId) return;

    const interval = setInterval(() => {
      const isCurrentBroadcaster = (!broadcasterIdRef.current || broadcasterIdRef.current === deviceId || activeGroupRef.current?.isCurrentUserAdmin);
      if (isCurrentBroadcaster && getCurrentPlayerStateRef.current) {
        const curState = getCurrentPlayerStateRef.current();
        if (curState && curState.isPlaying) {
          const beatPayload = {
            type: 'RADIO_BEAT',
            broadcasterId: deviceId,
            broadcasterName: nicknameRef.current,
            groupId: activeGroupRef.current.groupId,
            senderId: deviceId,
            senderName: nicknameRef.current,
            ...curState,
            sentAt: Date.now(),
          };

          realtimeBus.publish(
            `devipaksha/group/${activeGroupRef.current.groupId}/radio_stream`,
            beatPayload,
            { retain: true }
          );

          publishGroupEvent(beatPayload);
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activeGroup?.groupId, deviceId, publishGroupEvent]);

  // Main listener for group MQTT and BroadcastChannel events
  useEffect(() => {
    if (!activeGroup?.groupId) return;

    const groupId = activeGroup.groupId;
    const eventsTopic = `devipaksha/group/${groupId}/events`;
    const verifyTopic = `devipaksha/group/${groupId}/verify`;
    const lastStateTopic = `devipaksha/group/${groupId}/last_state`;
    const radioStreamTopic = `devipaksha/group/${groupId}/radio_stream`;

    realtimeBus.subscribeTopic(eventsTopic);
    realtimeBus.subscribeTopic(verifyTopic);
    realtimeBus.subscribeTopic(lastStateTopic);
    realtimeBus.subscribeTopic(radioStreamTopic);

    // BroadcastChannel for instant inter-tab communication
    let bc = null;
    let verifyBc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(`devipaksha_bc_group_${groupId}`);
      broadcastChannelRef.current = bc;
      bc.onmessage = (e) => {
        if (e.data) handleIncomingGroupEvent(e.data);
      };

      verifyBc = new BroadcastChannel(`devipaksha_bc_verify_${groupId}`);
      verifyBc.onmessage = (e) => {
        if (e.data?.type === 'PING_GROUP') {
          respondToVerifyPing(e.data);
        }
      };
    }

    function respondToVerifyPing(pingData) {
      const curGroup = activeGroupRef.current;
      if (!curGroup) return;
      const pong = {
        type: 'PONG_GROUP',
        code: curGroup.inviteCode || curGroup.groupId,
        groupId: curGroup.groupId,
        groupName: curGroup.groupName,
        adminId: curGroup.adminId,
        adminName: curGroup.adminName,
        createdAt: curGroup.createdAt,
      };
      realtimeBus.publish(verifyTopic, pong);
      if (verifyBc) {
        try { verifyBc.postMessage(pong); } catch (e) {}
      }
    }

    function handleIncomingGroupEvent(event) {
      if (!event || event.groupId !== groupId) return;

      // 1. CHAT MESSAGE
      if (event.type === 'CHAT' && event.message) {
        addMessage(event.message);
      }

      // 2. MEMBER JOIN (Deduplicated - NO SPAM!)
      else if (event.type === 'JOIN') {
        const isSelf = event.senderId === deviceId;
        if (!isSelf && !announcedJoinIdsRef.current.has(event.senderId)) {
          announcedJoinIdsRef.current.add(event.senderId);
          addMessage({
            id: 'sys-join-' + event.senderId + '-' + Date.now(),
            type: 'system',
            text: `👋 ${event.senderName || 'A friend'} joined the group!`,
            timestamp: formatMsgTime(),
          });
        }

        setMembers((prev) => {
          const existingIdx = prev.findIndex((m) => m.id === event.senderId);
          const memberData = {
            id: event.senderId,
            name: event.senderName || 'Friend',
            avatar: event.senderAvatar || 'from-amber-400 to-red-500',
            isAdmin: event.isAdmin || false,
            lastSeen: Date.now(),
          };
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], ...memberData };
            return next;
          }
          return [...prev, memberData];
        });

        // Reply with current player state and complete members roster for late joiner sync
        if (!isSelf && getCurrentPlayerStateRef.current) {
          const curState = getCurrentPlayerStateRef.current();
          publishGroupEvent({
            type: 'CURRENT_STATE',
            targetId: event.senderId,
            state: curState,
            groupName: activeGroupRef.current?.groupName,
            adminId: activeGroupRef.current?.adminId,
            adminName: activeGroupRef.current?.adminName,
            membersList: membersRef.current,
          });
        }
      }

      // 3. MEMBER LEAVE (Member disconnects/leaves - keep in roster, mark as Offline)
      else if (event.type === 'LEAVE') {
        setMembers((prev) => {
          return prev.map((m) =>
            m.id === event.senderId ? { ...m, lastSeen: 0 } : m
          );
        });
        if (event.senderId !== deviceId) {
          addMessage({
            id: 'sys-leave-' + event.senderId + '-' + Date.now(),
            type: 'system',
            text: `🚪 ${event.senderName || 'A friend'} went offline.`,
            timestamp: formatMsgTime(),
          });
        }
      }

      // 4. HEARTBEAT PRESENCE
      else if (event.type === 'HEARTBEAT') {
        if (event.isAdmin && event.groupName && activeGroupRef.current?.isPlaceholderName) {
          setActiveGroup((prev) => ({
            ...prev,
            groupName: event.groupName,
            adminName: event.senderName || prev.adminName,
            adminId: event.senderId || prev.adminId,
            isPlaceholderName: false,
          }));
        }
        setMembers((prev) => {
          const existingIdx = prev.findIndex((m) => m.id === event.senderId);
          const memberData = {
            id: event.senderId,
            name: event.senderName || 'Friend',
            avatar: event.senderAvatar || 'from-amber-400 to-red-500',
            isAdmin: event.isAdmin || false,
            lastSeen: Date.now(),
          };
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], ...memberData };
            return next;
          }
          return [...prev, memberData];
        });
      }

      // 5b. RADIO_BEAT (Continuous stream heartbeat from broadcaster)
      else if (event.type === 'RADIO_BEAT' && event.senderId !== deviceId) {
        if (event.broadcasterId) {
          setBroadcasterId(event.broadcasterId);
          broadcasterIdRef.current = event.broadcasterId;
        }
        if (event.broadcasterName) {
          setBroadcasterName(event.broadcasterName);
          broadcasterNameRef.current = event.broadcasterName;
        }
        if (!isBroadcasterRef.current && hasActivatedGroupSyncRef.current && applyRemoteSyncRef.current) {
          const elapsedSec = Math.max(0, (Date.now() - (event.sentAt || 0)) / 1000);
          if (elapsedSec < 14400) {
            const liveState = {
              ...event,
              position: event.isPlaying ? ((event.position || 0) + elapsedSec) : (event.position || 0),
            };
            applyRemoteSyncRef.current(liveState);
          }
        }
      }

      // 5. MUSIC SYNC (from another device)
      else if (event.type === 'MUSIC_SYNC' && event.senderId !== deviceId) {
        if (isBroadcasterRef.current && event.senderId !== activeGroupRef.current?.adminId) {
          return;
        }
        if (event.broadcasterId) {
          setBroadcasterId(event.broadcasterId);
          broadcasterIdRef.current = event.broadcasterId;
        }
        if (event.broadcasterName) {
          setBroadcasterName(event.broadcasterName);
          broadcasterNameRef.current = event.broadcasterName;
        }
        // Only apply sync if user opened the group
        if (hasActivatedGroupSyncRef.current) {
          if (applyRemoteSyncRef.current) {
            applyRemoteSyncRef.current(event);
          }
          if (event.action === 'MANUAL_TRACK_CHANGE') {
            addMessage({
              id: 'sys-remote-change-' + Date.now() + '-' + Math.random(),
              type: 'system',
              text: `🎵 ${event.senderName || 'A friend'} changed song to "${event.trackTitle || 'a new song'}"`,
              timestamp: formatMsgTime(),
            });
          }
        }
      }

      // 6. LATE JOINER STATE SYNC RESPONSE
      else if (event.type === 'CURRENT_STATE' && event.targetId === deviceId && event.state) {
        if (isBroadcasterRef.current) return;
        if (event.broadcasterId) {
          setBroadcasterId(event.broadcasterId);
          broadcasterIdRef.current = event.broadcasterId;
        }
        if (event.broadcasterName) {
          setBroadcasterName(event.broadcasterName);
          broadcasterNameRef.current = event.broadcasterName;
        }
        if (hasActivatedGroupSyncRef.current) {
          if (applyRemoteSyncRef.current) {
            applyRemoteSyncRef.current(event.state);
          }
        }
        if (event.groupName && activeGroupRef.current && (activeGroupRef.current.isPlaceholderName || !activeGroupRef.current.groupName)) {
          setActiveGroup((prev) => ({
            ...prev,
            groupName: event.groupName,
            adminId: event.adminId || prev.adminId,
            adminName: event.adminName || prev.adminName,
            isPlaceholderName: false,
          }));
        }
        // Merge members roster
        if (Array.isArray(event.membersList) && event.membersList.length > 0) {
          setMembers((prev) => {
            const map = new Map();
            prev.forEach((m) => map.set(m.id, m));
            event.membersList.forEach((m) => {
              if (m && m.id) {
                const existing = map.get(m.id);
                if (!existing) {
                  map.set(m.id, m);
                } else {
                  map.set(m.id, {
                    ...existing,
                    ...m,
                    lastSeen: Math.max(existing.lastSeen || 0, m.lastSeen || 0),
                  });
                }
              }
            });
            return Array.from(map.values());
          });
        }
      }

      // 7. REQUEST_STATE (Late joiner asking for state)
      else if (event.type === 'REQUEST_STATE' && event.senderId !== deviceId) {
        // Only broadcaster or admin replies with current state
        if (!isBroadcasterRef.current) return;
        if (getCurrentPlayerStateRef.current) {
          const curState = getCurrentPlayerStateRef.current();
          publishGroupEvent({
            type: 'CURRENT_STATE',
            targetId: event.senderId,
            state: curState,
            groupName: activeGroupRef.current?.groupName,
            adminId: activeGroupRef.current?.adminId,
            adminName: activeGroupRef.current?.adminName,
            membersList: membersRef.current,
          });
        }
      }

      // 8. DISBAND (Admin closed the group)
      else if (event.type === 'DISBAND' && event.senderId !== deviceId) {
        alert(event.reason || 'The admin has closed this friend group.');
        leaveGroupInternal(false);
      }
    }

    const unsubscribeBus = realtimeBus.subscribe((busEvent) => {
      if (busEvent.type === 'STATUS') {
        setIsSyncConnected(busEvent.connected);
        // If MQTT reconnected after page refresh and user opened group, re-request state immediately!
        if (busEvent.connected && hasActivatedGroupSyncRef.current && activeGroupRef.current?.groupId) {
          publishGroupEvent({
            type: 'REQUEST_STATE',
          });
        }
      } else if (busEvent.topic === eventsTopic && busEvent.data) {
        handleIncomingGroupEvent(busEvent.data);
      } else if (busEvent.topic === verifyTopic && busEvent.data?.type === 'PING_GROUP') {
        respondToVerifyPing(busEvent.data);
      } else if (busEvent.topic === radioStreamTopic && busEvent.data) {
        const beat = busEvent.data;
        lastRetainedStateRef.current = beat;
        if (beat.broadcasterId) {
          setBroadcasterId(beat.broadcasterId);
          broadcasterIdRef.current = beat.broadcasterId;
        }
        if (beat.broadcasterName) {
          setBroadcasterName(beat.broadcasterName);
          broadcasterNameRef.current = beat.broadcasterName;
        }
        if (!isBroadcasterRef.current && hasActivatedGroupSyncRef.current && applyRemoteSyncRef.current) {
          const elapsedSec = Math.max(0, (Date.now() - (beat.sentAt || 0)) / 1000);
          if (elapsedSec < 14400) {
            const liveState = {
              ...beat,
              position: beat.isPlaying ? ((beat.position || 0) + elapsedSec) : (beat.position || 0),
            };
            applyRemoteSyncRef.current(liveState);
          }
        }
      } else if (busEvent.topic === lastStateTopic && busEvent.data) {
        lastRetainedStateRef.current = busEvent.data;
        // Retained state from broker when member opens site while others are offline
        if (hasActivatedGroupSyncRef.current && applyRemoteSyncRef.current) {
          const act = busEvent.data.action;
          if (act === 'PLAY' || act === 'MANUAL_TRACK_CHANGE' || act === 'AUTO_NEXT' || act === 'SEEK' || act === 'TRACK_CHANGE') {
            applyRemoteSyncRef.current(busEvent.data);
          }
        }
      }
    });

    // Send single JOIN to register presence
    publishGroupEvent({
      type: 'JOIN',
      isAdmin: activeGroup.isCurrentUserAdmin,
      groupName: activeGroup.groupName,
    });
    // Request state only if group has been opened
    if (hasActivatedGroupSyncRef.current) {
      publishGroupEvent({
        type: 'REQUEST_STATE',
      });
    }

    // Periodic heartbeat every 6 seconds
    const heartbeatInterval = setInterval(() => {
      publishGroupEvent({
        type: 'HEARTBEAT',
        isAdmin: activeGroupRef.current?.isCurrentUserAdmin,
        groupName: activeGroupRef.current?.groupName,
      });

      // Update our own lastSeen timestamp (NEVER prune inactive members so offline members remain visible)
      setMembers((prev) =>
        prev.map((m) => (m.id === deviceId ? { ...m, lastSeen: Date.now() } : m))
      );
    }, 6000);

    return () => {
      clearInterval(heartbeatInterval);
      unsubscribeBus();
      realtimeBus.unsubscribeTopic(eventsTopic);
      realtimeBus.unsubscribeTopic(verifyTopic);
      realtimeBus.unsubscribeTopic(lastStateTopic);
      realtimeBus.unsubscribeTopic(radioStreamTopic);
      if (bc) {
        bc.close();
        broadcastChannelRef.current = null;
      }
      if (verifyBc) {
        verifyBc.close();
      }
    };
  }, [activeGroup?.groupId, activeGroup?.isCurrentUserAdmin, deviceId, addMessage, publishGroupEvent]);

  // Create a new group (User becomes Admin)
  const createGroup = useCallback((groupNameInput, creatorNickname) => {
    const finalNickname = (creatorNickname || nicknameRef.current || 'Pujo Admin').trim();
    updateNickname(finalNickname);

    const inviteCode = generateInviteCode();
    const groupName = (groupNameInput || 'Durga Puja Adda').trim();

    const newGroup = {
      groupId: inviteCode,
      groupName,
      inviteCode,
      adminId: deviceId,
      adminName: finalNickname,
      isCurrentUserAdmin: true,
      createdAt: Date.now(),
    };

    setActiveGroup(newGroup);
    setHasActivatedGroupSync(true);
    hasActivatedGroupSyncRef.current = true;

    // Retain group metadata on MQTT broker so new members can fetch group info even if admin is offline
    realtimeBus.publish(
      `devipaksha/group/${inviteCode}/info`,
      {
        type: 'GROUP_INFO',
        ...newGroup,
      },
      { retain: true }
    );

    return newGroup;
  }, [deviceId, updateNickname]);

  // Join an existing group with invite code (Works even if no one is currently online!)
  const joinGroup = useCallback(async (codeRaw, joinerNickname) => {
    if (unlockAudio) unlockAudio();
    if (!codeRaw) return { error: 'Please enter an invite code.' };

    let normalizedCode = codeRaw.trim().toUpperCase().replace(/\s+/g, '');
    // If user only typed 4 chars without prefix, auto prepend PUJA-
    if (!normalizedCode.startsWith('PUJA-') && normalizedCode.length >= 3 && normalizedCode.length <= 8) {
      normalizedCode = 'PUJA-' + normalizedCode;
    }

    // Validate format (e.g., PUJA-AB12)
    const codeFormatValid = /^PUJA-[A-Z0-9]{3,8}$/.test(normalizedCode);
    if (!codeFormatValid) {
      return { error: 'Invalid invite code! Code must look like PUJA-AB12 or AB12.' };
    }

    if (activeGroupRef.current && activeGroupRef.current.groupId !== normalizedCode) {
      return { error: 'You are already in a group. Please leave your current group first.' };
    }

    const finalNickname = (joinerNickname || nicknameRef.current || 'Pujo Friend').trim();
    updateNickname(finalNickname);

    // Verify whether the group is online or get retained group info
    const verifyPromise = new Promise((resolve) => {
      let resolved = false;
      const verifyTopic = `devipaksha/group/${normalizedCode}/verify`;
      const infoTopic = `devipaksha/group/${normalizedCode}/info`;

      realtimeBus.subscribeTopic(verifyTopic);
      realtimeBus.subscribeTopic(infoTopic);

      let verifyBc = null;
      if (typeof BroadcastChannel !== 'undefined') {
        verifyBc = new BroadcastChannel(`devipaksha_bc_verify_${normalizedCode}`);
        verifyBc.onmessage = (e) => {
          if (e.data?.type === 'PONG_GROUP' && e.data.groupId === normalizedCode) {
            finish(e.data);
          }
        };
      }

      const unsubscribeBus = realtimeBus.subscribe((busEvent) => {
        // 1. Live member or admin online responds with PONG_GROUP
        if (busEvent.topic === verifyTopic && busEvent.data?.type === 'PONG_GROUP') {
          if (busEvent.data.groupId === normalizedCode) {
            finish(busEvent.data);
          }
        }
        // 2. Retained group metadata from MQTT broker
        if (busEvent.topic === infoTopic && busEvent.data) {
          if (busEvent.data.disbanded) {
            finishDisbanded();
          } else if (busEvent.data.groupId === normalizedCode) {
            finish(busEvent.data);
          }
        }
      });

      function finish(groupInfo) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve({ success: true, groupInfo });
      }

      function finishDisbanded() {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve({ success: false, error: 'This group was ended by the admin.' });
      }

      function cleanup() {
        unsubscribeBus();
        realtimeBus.unsubscribeTopic(verifyTopic);
        realtimeBus.unsubscribeTopic(infoTopic);
        if (verifyBc) verifyBc.close();
      }

      // Send PING_GROUP probe over MQTT and BroadcastChannel
      const pingPayload = {
        type: 'PING_GROUP',
        code: normalizedCode,
        requesterId: deviceId,
        sentAt: Date.now(),
      };
      realtimeBus.publish(verifyTopic, pingPayload);
      if (verifyBc) verifyBc.postMessage(pingPayload);

      // Brief probe: wait up to 800ms for live pong or retained info.
      // IF NO ONE IS ONLINE RIGHT NOW, WE STILL ALLOW THE MEMBER TO JOIN & LISTEN TO MUSIC!
      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({
          success: true,
          groupInfo: {
            isOfflineJoin: true,
            groupId: normalizedCode,
            groupName: `Pujo Adda (${normalizedCode})`,
            adminName: 'Admin',
          },
        });
      }, 800);
    });

    const result = await verifyPromise;
    if (!result.success) {
      return { error: result.error };
    }

    // Set active group!
    const groupObj = {
      groupId: normalizedCode,
      groupName: result.groupInfo?.groupName || `Pujo Adda (${normalizedCode})`,
      inviteCode: normalizedCode,
      adminId: result.groupInfo?.adminId || null,
      adminName: result.groupInfo?.adminName || 'Admin',
      isCurrentUserAdmin: false,
      isPlaceholderName: !!result.groupInfo?.isOfflineJoin,
      createdAt: result.groupInfo?.createdAt || Date.now(),
    };

    setActiveGroup(groupObj);
    setHasActivatedGroupSync(true);
    hasActivatedGroupSyncRef.current = true;

    // Immediately request state from live peers and apply retained state
    const reqPayload = {
      type: 'REQUEST_STATE',
      groupId: normalizedCode,
      senderId: deviceId,
      sentAt: Date.now(),
    };
    realtimeBus.publish(`devipaksha/group/${normalizedCode}/events`, reqPayload);
    if (broadcastChannelRef.current) {
      try { broadcastChannelRef.current.postMessage(reqPayload); } catch (e) {}
    }

    if (lastRetainedStateRef.current && applyRemoteSyncRef.current) {
      const retained = lastRetainedStateRef.current;
      const elapsedSec = (Date.now() - (retained.sentAt || 0)) / 1000;
      if (elapsedSec < 14400) {
        const adjustedRetained = {
          ...retained,
          position: retained.isPlaying ? ((retained.position || 0) + elapsedSec) : (retained.position || 0),
        };
        applyRemoteSyncRef.current(adjustedRetained);
      }
    }

    // If joined while offline, add friendly system hint message
    if (result.groupInfo?.isOfflineJoin) {
      setTimeout(() => {
        addMessage({
          id: 'sys-offline-hint-' + Date.now(),
          type: 'system',
          text: `🎧 You joined ${groupObj.groupName}! Play any song now — when friends come online, music will sync automatically!`,
          timestamp: formatMsgTime(),
        });
      }, 350);
    }

    return { success: true, group: groupObj };
  }, [deviceId, updateNickname, addMessage, unlockAudio]);

  // Leave active group
  const leaveGroupInternal = useCallback((broadcastLeave = true) => {
    if (broadcastLeave && activeGroupRef.current) {
      publishGroupEvent({
        type: 'LEAVE',
      });
    }
    setActiveGroup(null);
    setHasActivatedGroupSync(false);
    hasActivatedGroupSyncRef.current = false;
    setMembers([]);
    setMessages([]);
    announcedJoinIdsRef.current.clear();
  }, [publishGroupEvent]);

  const leaveGroup = useCallback(() => {
    leaveGroupInternal(true);
  }, [leaveGroupInternal]);

  // Disband group (Admin only)
  const disbandGroup = useCallback(() => {
    if (!activeGroupRef.current?.isCurrentUserAdmin) return;
    const gId = activeGroupRef.current.groupId;
    publishGroupEvent({
      type: 'DISBAND',
      reason: `Admin "${nicknameRef.current}" has ended the group.`,
    });
    // Retain disband status on broker
    realtimeBus.publish(
      `devipaksha/group/${gId}/info`,
      {
        type: 'DISBAND',
        disbanded: true,
        groupId: gId,
      },
      { retain: true }
    );
    leaveGroupInternal(false);
  }, [publishGroupEvent, leaveGroupInternal]);

  // Send a chat message
  const sendChatMessage = useCallback((text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || !activeGroupRef.current) return;

    const newMsg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'chat',
      senderId: deviceId,
      senderName: nicknameRef.current,
      avatar: avatarGradient,
      text: trimmed,
      timestamp: formatMsgTime(),
    };

    // Add locally immediately
    addMessage(newMsg);

    // Broadcast to group
    publishGroupEvent({
      type: 'CHAT',
      message: newMsg,
    });
  }, [deviceId, avatarGradient, addMessage, publishGroupEvent]);

  // Send quick reaction emoji
  const sendReaction = useCallback((emoji) => {
    sendChatMessage(emoji);
  }, [sendChatMessage]);

  const isMemberOnline = useCallback(
    (mem) => {
      if (!mem) return false;
      if (mem.id === deviceId) return true;
      return (nowTick - (mem.lastSeen || 0)) < 20000;
    },
    [deviceId, nowTick]
  );

  const onlineMembers = members.filter((m) => isMemberOnline(m));
  const offlineMembers = members.filter((m) => !isMemberOnline(m));
  const onlineCount = onlineMembers.length;

  const value = {
    activeGroup,
    isInGroup: !!activeGroup,
    isCurrentUserAdmin: !!activeGroup?.isCurrentUserAdmin,
    members,
    onlineMembers,
    offlineMembers,
    onlineCount,
    isMemberOnline,
    nowTick,
    messages,
    deviceId,
    nickname,
    avatarGradient,
    isSyncConnected,
    hasActivatedGroupSync,
    activateGroupSync,
    broadcasterId,
    broadcasterName,
    isBroadcaster,
    isLiveRadioActive: !!broadcasterId,
    updateNickname,
    createGroup,
    joinGroup,
    leaveGroup,
    disbandGroup,
    sendChatMessage,
    sendReaction,
  };

  return (
    <FriendGroupContext.Provider value={value}>
      {children}
    </FriendGroupContext.Provider>
  );
}

export function useFriendGroup() {
  const context = useContext(FriendGroupContext);
  if (!context) {
    throw new Error('useFriendGroup must be used within a <FriendGroupProvider>');
  }
  return context;
}
