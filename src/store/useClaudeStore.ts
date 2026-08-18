import { create } from 'zustand';
import { ClaudeServerStatus, ClaudeUsageSnapshot } from '@/types';
import { fetchClaudeUsage } from '@/api/claudeUsageApi';
import { fetchClaudeServerStatus } from '@/api/claudeStatusApi';

interface ClaudeState {
  snapshots: ClaudeUsageSnapshot[];
  server: ClaudeServerStatus | null;
  isLoading: boolean;
  hasError: boolean;
  fetchedAt: Date | null;
  fetch: () => Promise<void>;
}

export const useClaudeStore = create<ClaudeState>(set => ({
  snapshots: [],
  server: null,
  isLoading: false,
  hasError: false,
  fetchedAt: null,
  fetch: async () => {
    set({ isLoading: true, hasError: false });

    // 사용량(Notion)과 서버 상태(Statuspage)는 독립적으로 실패 처리
    const [usage, server] = await Promise.allSettled([
      fetchClaudeUsage(),
      fetchClaudeServerStatus(),
    ]);

    if (server.status === 'fulfilled') {
      set({ server: server.value });
    }
    if (usage.status === 'fulfilled') {
      set({ snapshots: usage.value, isLoading: false, fetchedAt: new Date() });
    } else {
      set({ isLoading: false, hasError: true });
    }
  },
}));
