import { create } from 'zustand';
import { fetchBoard, updateCardStatus } from '@/api/notionApi';
import { NotionBoardCard, NotionBoardColumn } from '@/types';

const REFRESH_INTERVAL = 15 * 1000; // 15 seconds

interface NotionStore {
  title: string;
  statusProp: string;
  columns: NotionBoardColumn[];
  cards: NotionBoardCard[];
  /** pageId → target status, for moves not yet confirmed by Notion */
  pending: Record<string, string>;
  /** pageId → timestamp of last local move (guards against stale in-flight fetches) */
  movedAt: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  moveError: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  moveCard: (cardId: string, status: string) => Promise<void>;
}

export const useNotionStore = create<NotionStore>((set, get) => ({
  title: '',
  statusProp: '',
  columns: [],
  cards: [],
  pending: {},
  movedAt: {},
  isLoading: false,
  error: null,
  moveError: null,
  lastFetched: null,

  fetch: async () => {
    const { isLoading, lastFetched } = get();
    if (isLoading) return;
    if (lastFetched && Date.now() - lastFetched < REFRESH_INTERVAL) return;

    const startedAt = Date.now();
    set({ isLoading: true, error: null });
    try {
      const board = await fetchBoard();
      // Keep local status for moves in flight or made after this fetch began
      const { pending, movedAt, cards: local } = get();
      const cards = board.cards.map(c => {
        if (pending[c.id]) return { ...c, status: pending[c.id] };
        if ((movedAt[c.id] ?? 0) >= startedAt) {
          const mine = local.find(l => l.id === c.id);
          if (mine) return { ...c, status: mine.status };
        }
        return c;
      });
      set({
        title: board.title,
        statusProp: board.statusProp,
        columns: board.columns,
        cards,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'FETCH ERROR';
      set({ isLoading: false, error: msg.toUpperCase() });
    }
  },

  forceRefresh: async () => {
    set({ lastFetched: null });
    await get().fetch();
  },

  moveCard: async (cardId, status) => {
    const { cards, statusProp } = get();
    const card = cards.find(c => c.id === cardId);
    if (!card || card.status === status || !statusProp) return;
    const prevStatus = card.status;

    set(s => ({
      cards: s.cards.map(c => (c.id === cardId ? { ...c, status } : c)),
      pending: { ...s.pending, [cardId]: status },
      movedAt: { ...s.movedAt, [cardId]: Date.now() },
      moveError: null,
    }));

    try {
      await updateCardStatus(cardId, statusProp, status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UPDATE ERROR';
      // Revert only if no newer move superseded this one
      set(s => ({
        cards: s.pending[cardId] === status
          ? s.cards.map(c => (c.id === cardId ? { ...c, status: prevStatus } : c))
          : s.cards,
        moveError: `MOVE FAILED: ${msg.toUpperCase()}`,
      }));
    } finally {
      set(s => {
        if (s.pending[cardId] !== status) return s;
        const rest = { ...s.pending };
        delete rest[cardId];
        return { pending: rest };
      });
    }
  },
}));
