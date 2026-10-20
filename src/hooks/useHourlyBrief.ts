import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTechBriefStore } from '@/store/useTechBriefStore';

/**
 * 앱이 포그라운드일 때만 매 정각 Tech Brief 생성.
 * - 시작/복귀 시 이번 슬롯이 비어 있으면 즉시 생성 (Notion 중복 확인 후)
 * - 백그라운드 전환 시 타이머 해제 → 토큰 미사용
 */
export function useHourlyBrief(): void {
  const hydrated = useTechBriefStore(s => s.hydrated);
  const autoEnabled = useTechBriefStore(s => s.autoEnabled);

  useEffect(() => {
    if (!hydrated || !autoEnabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (AppState.currentState === 'active') useTechBriefStore.getState().generate();
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      // 정각 직후 1초 여유 — 슬롯 키가 확실히 바뀐 뒤 실행
      timer = setTimeout(() => {
        run();
        schedule();
      }, next.getTime() - now.getTime() + 1000);
    };

    run();
    schedule();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        run();
        schedule();
      } else if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [hydrated, autoEnabled]);
}
