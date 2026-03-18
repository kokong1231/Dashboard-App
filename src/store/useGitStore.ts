import { create } from 'zustand';
import {
  fetchGitUsername,
  fetchGitEvents,
  fetchGitActions,
  GitAction,
  GitCommit,
} from '@/api/githubApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitPushNotification {
  id: string;
  repo: string;
  branch: string;
  message: string;
  author: string;
  commitCount: number;
  timestamp: string;
}

interface GitStore {
  // data
  username: string;
  commits: GitCommit[];
  actions: GitAction[];
  fetchedAt: Date | null;
  isLoading: boolean;
  isLoadingActions: boolean;
  hasError: boolean;

  // push notifications
  notifications: GitPushNotification[];
  lastSeenEventId: string | null;
  eventsEtag: string | null;

  // actions
  /** Frequent poll: events only, ETag-cached. */
  load: () => Promise<void>;
  /** Infrequent poll: workflow runs (5 repos). */
  loadActions: () => Promise<void>;
  dismissNotification: (id: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGitStore = create<GitStore>((set, get) => ({
  username: '',
  commits: [],
  actions: [],
  fetchedAt: null,
  isLoading: false,
  isLoadingActions: false,
  hasError: false,
  notifications: [],
  lastSeenEventId: null,
  eventsEtag: null,

  load: async () => {
    const { isLoading, eventsEtag, lastSeenEventId } = get();
    if (isLoading) return; // prevent concurrent calls
    set({ isLoading: true, hasError: false });

    try {
      // Resolve username once; reuse on subsequent calls
      let { username } = get();
      if (!username) {
        username = await fetchGitUsername();
        set({ username });
      }

      const result = await fetchGitEvents(username, eventsEtag);

      // 304 — nothing changed, skip state update
      if (result === null) {
        set({ isLoading: false });
        return;
      }

      const { commits, etag } = result;
      const newestEventId = commits[0]?.eventId ?? lastSeenEventId;

      // Detect new pushes only after the first successful load
      const newNotifications: GitPushNotification[] = [];
      if (lastSeenEventId !== null) {
        for (const commit of commits) {
          if (BigInt(commit.eventId) <= BigInt(lastSeenEventId)) break;
          newNotifications.push({
            id:          commit.eventId,
            repo:        commit.repo,
            branch:      commit.branch,
            message:     commit.message,
            author:      commit.author,
            commitCount: commit.commitCount,
            timestamp:   commit.timestamp,
          });
        }
      }

      set(prev => ({
        commits,
        fetchedAt:       new Date(),
        isLoading:       false,
        hasError:        false,
        eventsEtag:      etag,
        lastSeenEventId: newestEventId,
        notifications:   [...prev.notifications, ...newNotifications],
      }));
    } catch {
      set({ isLoading: false, hasError: true });
    }
  },

  loadActions: async () => {
    const { isLoadingActions } = get();
    if (isLoadingActions) return;
    set({ isLoadingActions: true });

    try {
      let { username } = get();
      if (!username) {
        username = await fetchGitUsername();
        set({ username });
      }
      const actions = await fetchGitActions(username);
      set({ actions, isLoadingActions: false });
    } catch {
      set({ isLoadingActions: false });
    }
  },

  dismissNotification: (id: string) => {
    set(prev => ({
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  },
}));
