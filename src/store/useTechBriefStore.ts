import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collectTechHeadlines } from '@/api/techSourcesApi';
import { BRIEF_MODEL, generateTechBrief } from '@/api/claudeBriefApi';
import {
  fetchTechBrief,
  fetchTechBriefList,
  logClaudeApiUsage,
  purgeOldTechBriefs,
  saveTechBrief,
  techBriefExists,
} from '@/api/notionApi';
import { useClaudeStore } from './useClaudeStore';
import { ClaudeApiUsageRecord, TechBrief, TechBriefMeta } from '@/types';
import { hourSlotKey, hourSlotStart } from '@/utils/formatters';

const AUTO_KEY = 'techBrief.autoEnabled';
const MIN_HEADLINES = 5;

export type BriefPhase = 'idle' | 'collecting' | 'synthesizing' | 'saving';

interface TechBriefState {
  hydrated: boolean;
  autoEnabled: boolean;
  phase: BriefPhase;
  phaseStartedAt: number | null;
  list: TechBriefMeta[];
  /** 화면에 표시 중인 브리프 (최신 또는 기록에서 선택한 것) */
  current: TechBrief | null;
  isViewingLatest: boolean;
  isOpening: boolean;
  error: string | null;

  init: () => Promise<void>;
  setAutoEnabled: (on: boolean) => void;
  loadList: () => Promise<TechBriefMeta[]>;
  openBrief: (pageId: string, latest?: boolean) => Promise<void>;
  /** force=false면 이번 슬롯이 이미 있으면 건너뜀 (자동 스케줄용) */
  generate: (force?: boolean) => Promise<void>;
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : 'UNKNOWN ERROR').toUpperCase().slice(0, 80);
}

export const useTechBriefStore = create<TechBriefState>((set, get) => ({
  hydrated: false,
  autoEnabled: true,
  phase: 'idle',
  phaseStartedAt: null,
  list: [],
  current: null,
  isViewingLatest: true,
  isOpening: false,
  error: null,

  init: async () => {
    try {
      const saved = await AsyncStorage.getItem(AUTO_KEY);
      if (saved != null) set({ autoEnabled: saved === '1' });
    } catch {
      // 저장소 접근 실패 시 기본값(ON) 유지
    }
    set({ hydrated: true });

    purgeOldTechBriefs().catch(() => {});
    try {
      const list = await get().loadList();
      if (list.length > 0 && !get().current) await get().openBrief(list[0].pageId, true);
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  setAutoEnabled: on => {
    set({ autoEnabled: on });
    AsyncStorage.setItem(AUTO_KEY, on ? '1' : '0').catch(() => {});
  },

  loadList: async () => {
    const list = await fetchTechBriefList();
    set({ list });
    return list;
  },

  openBrief: async (pageId, latest) => {
    set({ isOpening: true, error: null });
    try {
      const brief = await fetchTechBrief(pageId);
      const isLatest = latest ?? get().list[0]?.pageId === pageId;
      set({ current: brief, isViewingLatest: isLatest, isOpening: false });
    } catch (e) {
      set({ isOpening: false, error: errMsg(e) });
    }
  },

  generate: async (force = false) => {
    if (get().phase !== 'idle') return;
    const now = new Date();
    const slotKey = hourSlotKey(now);
    let usage: ClaudeApiUsageRecord | undefined;

    set({ phase: 'collecting', phaseStartedAt: Date.now(), error: null });
    try {
      if (!force && (await techBriefExists(slotKey))) {
        set({ phase: 'idle', phaseStartedAt: null });
        return;
      }

      const headlines = await collectTechHeadlines();
      if (headlines.length < MIN_HEADLINES) throw new Error('NOT ENOUGH SOURCES');

      set({ phase: 'synthesizing' });
      const result = await generateTechBrief(headlines, slotKey);
      usage = result.usage;

      set({ phase: 'saving' });
      const brief: TechBrief = {
        slotKey,
        slotStart: hourSlotStart(now).toISOString(),
        headline: result.headline,
        items: result.items,
        model: result.model || BRIEF_MODEL,
        createdAt: new Date().toISOString(),
      };
      const pageId = await saveTechBrief(brief);
      set({ current: { ...brief, notionPageId: pageId }, isViewingLatest: true });

      purgeOldTechBriefs().catch(() => {});
      await get()
        .loadList()
        .catch(() => {});
      set({ phase: 'idle', phaseStartedAt: null });
    } catch (e) {
      usage = usage ?? (e as { usage?: ClaudeApiUsageRecord }).usage;
      set({ phase: 'idle', phaseStartedAt: null, error: errMsg(e) });
    } finally {
      // 실패한 호출도 토큰은 소모되므로 기록
      if (usage) {
        logClaudeApiUsage(usage, `TECH::BRIEF ${slotKey}`)
          .catch(() => {})
          .finally(() => useClaudeStore.getState().fetchApiUsage(usage));
      }
    }
  },
}));
