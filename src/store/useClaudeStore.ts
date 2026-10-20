import { create } from 'zustand';
import {
  ClaudeApiUsageRecord,
  ClaudeApiUsageSummary,
  ClaudeServerStatus,
  ClaudeUsageSnapshot,
} from '@/types';
import { fetchClaudeApiUsageSummary, fetchClaudeUsage } from '@/api/notionApi';
import { fetchClaudeServerStatus } from '@/api/claudeStatusApi';

interface ClaudeState {
  snapshots: ClaudeUsageSnapshot[];
  server: ClaudeServerStatus | null;
  /** Claude API(키) 사용량 — Notion 사용 로그 기반 집계 */
  apiUsage: ClaudeApiUsageSummary | null;
  isLoading: boolean;
  hasError: boolean;
  fetchedAt: Date | null;
  fetch: () => Promise<void>;
  /** latest: 방금 끝난 호출 — Notion 반영 전이라도 rate-limit 잔여를 즉시 표시 */
  fetchApiUsage: (latest?: ClaudeApiUsageRecord) => Promise<void>;
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  snapshots: [],
  server: null,
  apiUsage: null,
  isLoading: false,
  hasError: false,
  fetchedAt: null,
  fetch: async () => {
    set({ isLoading: true, hasError: false });

    // 사용량(Notion)과 서버 상태(Statuspage)는 독립적으로 실패 처리
    const [usage, server] = await Promise.allSettled([
      fetchClaudeUsage(),
      fetchClaudeServerStatus(),
      get().fetchApiUsage(),
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
  fetchApiUsage: async latest => {
    try {
      const summary = await fetchClaudeApiUsageSummary();
      if (latest && (!summary.last || new Date(summary.last.at) < new Date(latest.at))) {
        summary.last = latest;
      }
      set({ apiUsage: summary });
    } catch {
      if (latest) {
        const prev = get().apiUsage;
        if (prev) set({ apiUsage: { ...prev, last: latest } });
      }
    }
  },
}));
