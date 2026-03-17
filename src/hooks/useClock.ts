import { useState } from 'react';
import { useInterval } from './useInterval';

interface ClockState {
  timeString: string; // "23:41:07"
  dateString: string; // "2026.03.16"
  dayString: string; // "MON"
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getState(): ClockState {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    timeString: `${hh}:${mm}:${ss}`,
    dateString: `${y}.${mo}.${d}`,
    dayString: DAYS[now.getDay()],
  };
}

export function useClock(): ClockState {
  const [state, setState] = useState<ClockState>(getState);
  useInterval(() => setState(getState()), 1000);
  return state;
}
