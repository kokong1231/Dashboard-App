import { create } from 'zustand';
import { fetchGitData, GitAction, GitCommit } from '@/api/githubApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitPushNotification {
  id: string;       // GitHub event ID
  repo: string;
  branch: string;
  message: string;  // first commit message
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
  hasError: boolean;

  // push notifications
  notifications: GitPushNotification[];
  lastSeenEventId: string | null; // newest event ID seen so far

  // actions
  load: () => Promise<void>;
  dismissNotification: (id: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGitStore = create<GitStore>((set, get) => ({
  username: '',
  commits: [],
  actions: [],
  fetchedAt: null,
  isLoading: false,
  hasError: false,
  notifications: [],
  lastSeenEventId: null,

  load: async () => {
    const { lastSeenEventId } = get();
    set({ isLoading: true, hasError: false });

    try {
      const data = await fetchGitData();
      const newestEventId = data.commits[0]?.eventId ?? lastSeenEventId;

      // Detect new push events only after the first successful load
      // (skip first load to avoid spamming old pushes)
      const newNotifications: GitPushNotification[] = [];
      if (lastSeenEventId !== null) {
        for (const commit of data.commits) {
          // GitHub event IDs are numerically increasing — stop when we reach known events
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
        username:       data.username,
        commits:        data.commits,
        actions:        data.actions,
        fetchedAt:      data.fetchedAt,
        isLoading:      false,
        hasError:       false,
        lastSeenEventId: newestEventId,
        notifications:  [...prev.notifications, ...newNotifications],
      }));
    } catch {
      set({ isLoading: false, hasError: true });
    }
  },

  dismissNotification: (id: string) => {
    set(prev => ({
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  },
}));
