// ── 단축키 데이터 ─────────────────────────────────────────────────────────────
//
// keys 표기 규칙
//   "+"  동시에 누름          → Ctrl+Shift+P
//   ","  차례대로 누름        → Ctrl+N , T   (한글의 2단계 단축키)
//   "/"  둘 중 하나           → Ctrl+[ / ]
//   방향키는 ← ↑ → ↓ 로 표기

export interface Shortcut {
  keys: string;
  desc: string;
}

export interface ShortcutCategory {
  id: string;
  title: string;
  icon: string;
  items: Shortcut[];
}

export interface ShortcutProgram {
  id: string;
  name: string;
  shortName: string;
  mark: string;
  color: string;
  colorDim: string;
  categories: ShortcutCategory[];
}

// ── 한글 (한컴오피스 한글) ────────────────────────────────────────────────────

const HWP: ShortcutProgram = {
  id: 'hwp',
  name: '한글 (한컴오피스)',
  shortName: '한글',
  mark: '한',
  color: '#00B0F0',
  colorDim: 'rgba(0, 176, 240, 0.14)',
  categories: [
    {
      id: 'hwp-file',
      title: '파일 · 문서',
      icon: '📄',
      items: [
        { keys: 'Alt+N', desc: '새 문서 만들기' },
        { keys: 'Ctrl+Alt+N', desc: '문서마당 (서식 문서)' },
        { keys: 'Alt+O', desc: '문서 불러오기' },
        { keys: 'Alt+S', desc: '저장하기' },
        { keys: 'Alt+V', desc: '다른 이름으로 저장' },
        { keys: 'Alt+P', desc: '인쇄' },
        { keys: 'Ctrl+F7', desc: '미리 보기' },
        { keys: 'Alt+X', desc: '한글 끝내기' },
        { keys: 'Ctrl+F4', desc: '현재 문서 창 닫기' },
      ],
    },
    {
      id: 'hwp-edit',
      title: '편집 기본',
      icon: '✂️',
      items: [
        { keys: 'Ctrl+Z', desc: '되돌리기 (실행 취소)' },
        { keys: 'Ctrl+Shift+Z', desc: '다시 실행' },
        { keys: 'Ctrl+X', desc: '오려 두기 (잘라내기)' },
        { keys: 'Ctrl+C', desc: '복사하기' },
        { keys: 'Ctrl+V', desc: '붙이기' },
        { keys: 'Ctrl+Alt+V', desc: '골라 붙이기 (서식 선택)' },
        { keys: 'Ctrl+A', desc: '문서 전체 선택' },
        { keys: 'F3', desc: '블록 지정 시작 / 해제' },
        { keys: 'F4', desc: '블록 지정 방식 바꾸기' },
        { keys: 'Alt+C', desc: '모양 복사 (서식 복사)' },
      ],
    },
    {
      id: 'hwp-find',
      title: '찾기 · 이동',
      icon: '🔍',
      items: [
        { keys: 'Ctrl+F', desc: '찾기' },
        { keys: 'Ctrl+H', desc: '찾아 바꾸기' },
        { keys: 'Ctrl+L', desc: '다시 찾기' },
        { keys: 'Alt+G', desc: '찾아가기 (쪽 · 구역 이동)' },
        { keys: 'Ctrl+PgUp', desc: '문서 맨 처음으로' },
        { keys: 'Ctrl+PgDn', desc: '문서 맨 끝으로' },
        { keys: 'Ctrl+←/→', desc: '한 낱말씩 이동' },
        { keys: 'Home / End', desc: '줄 처음 / 줄 끝으로' },
      ],
    },
    {
      id: 'hwp-char',
      title: '글자 모양',
      icon: '🔤',
      items: [
        { keys: 'Alt+L', desc: '글자 모양 대화상자' },
        { keys: 'Ctrl+B', desc: '진하게' },
        { keys: 'Ctrl+I', desc: '기울임' },
        { keys: 'Ctrl+U', desc: '밑줄' },
        { keys: 'Alt+Shift+E', desc: '글자 크기 키우기' },
        { keys: 'Alt+Shift+R', desc: '글자 크기 줄이기' },
        { keys: 'Alt+Shift+W', desc: '자간 넓히기' },
        { keys: 'Alt+Shift+N', desc: '자간 좁히기' },
        { keys: 'Alt+Shift+P', desc: '위 첨자' },
        { keys: 'Alt+Shift+S', desc: '아래 첨자' },
        { keys: 'Ctrl+M , T', desc: '글자 모양 되돌리기' },
      ],
    },
    {
      id: 'hwp-para',
      title: '문단 모양 · 정렬',
      icon: '📐',
      items: [
        { keys: 'Alt+T', desc: '문단 모양 대화상자' },
        { keys: 'Ctrl+Shift+M', desc: '양쪽 정렬' },
        { keys: 'Ctrl+Shift+L', desc: '왼쪽 정렬' },
        { keys: 'Ctrl+Shift+C', desc: '가운데 정렬' },
        { keys: 'Ctrl+Shift+R', desc: '오른쪽 정렬' },
        { keys: 'Ctrl+Shift+T', desc: '배분 정렬' },
        { keys: 'Alt+Shift+A', desc: '줄 간격 넓히기' },
        { keys: 'Alt+Shift+Z', desc: '줄 간격 좁히기' },
        { keys: 'Alt+Shift+→', desc: '왼쪽 여백 늘리기 (들여쓰기)' },
        { keys: 'Alt+Shift+←', desc: '왼쪽 여백 줄이기' },
        { keys: 'F6', desc: '스타일 적용 창' },
      ],
    },
    {
      id: 'hwp-insert',
      title: '입력 · 개체 넣기',
      icon: '➕',
      items: [
        { keys: 'Ctrl+N , T', desc: '표 만들기' },
        { keys: 'Ctrl+N , I', desc: '그림 넣기' },
        { keys: 'Ctrl+N , M', desc: '수식 편집기' },
        { keys: 'Ctrl+N , H', desc: '머리말 / 꼬리말' },
        { keys: 'Ctrl+N , P', desc: '쪽 번호 매기기' },
        { keys: 'Ctrl+N , N', desc: '각주 넣기' },
        { keys: 'Ctrl+N , E', desc: '미주 넣기' },
        { keys: 'Ctrl+N , B', desc: '덧말 넣기' },
        { keys: 'Ctrl+K , H', desc: '하이퍼링크' },
        { keys: 'Ctrl+F10', desc: '문자표 (특수 문자)' },
        { keys: 'F9', desc: '한자로 바꾸기' },
        { keys: 'Alt+Enter', desc: '개체 속성 열기' },
      ],
    },
    {
      id: 'hwp-table',
      title: '표 다루기',
      icon: '🧮',
      items: [
        { keys: 'F5', desc: '셀 블록 지정' },
        { keys: 'F5 , F5', desc: '셀 블록 한 단계 확장' },
        { keys: 'Tab', desc: '다음 셀로 이동' },
        { keys: 'Shift+Tab', desc: '이전 셀로 이동' },
        { keys: 'M', desc: '선택한 셀 합치기 (블록 상태)' },
        { keys: 'S', desc: '선택한 셀 나누기 (블록 상태)' },
        { keys: 'Ctrl+←/→/↑/↓', desc: '셀 크기 조절' },
        { keys: 'Ctrl+N , A', desc: '줄 · 칸 추가하기' },
        { keys: 'Ctrl+Backspace', desc: '줄 · 칸 지우기' },
        { keys: 'L', desc: '셀 테두리 · 배경 (블록 상태)' },
      ],
    },
    {
      id: 'hwp-view',
      title: '보기 · 도구',
      icon: '👁️',
      items: [
        { keys: 'Ctrl+G , C', desc: '조판 부호 보기 / 숨기기' },
        { keys: 'Ctrl+Q , W', desc: '쪽 윤곽 보기' },
        { keys: 'F7', desc: '편집 용지 설정' },
        { keys: 'F8', desc: '스타일 · 맞춤법 도구' },
        { keys: 'Ctrl+F1', desc: '작업 창 열기 / 닫기' },
        { keys: 'Alt+F5', desc: '문서 정보 보기' },
      ],
    },
  ],
};

// ── Figma ─────────────────────────────────────────────────────────────────────

const FIGMA: ShortcutProgram = {
  id: 'figma',
  name: 'Figma',
  shortName: 'Figma',
  mark: 'F',
  color: '#F76C4C',
  colorDim: 'rgba(247, 108, 76, 0.14)',
  categories: [
    {
      id: 'fig-tools',
      title: '도구 선택',
      icon: '🛠️',
      items: [
        { keys: 'V', desc: '이동 도구 (Move)' },
        { keys: 'F', desc: '프레임 그리기 (Frame)' },
        { keys: 'R', desc: '사각형' },
        { keys: 'O', desc: '원 · 타원' },
        { keys: 'L', desc: '선' },
        { keys: 'T', desc: '텍스트' },
        { keys: 'P', desc: '펜 (벡터)' },
        { keys: 'S', desc: '슬라이스 (내보내기 영역)' },
        { keys: 'K', desc: '크기 비율 조절 (Scale)' },
        { keys: 'C', desc: '코멘트 달기' },
        { keys: 'Space (누른 채)', desc: '캔버스 손으로 끌기' },
      ],
    },
    {
      id: 'fig-view',
      title: '보기 · 확대 / 축소',
      icon: '🔎',
      items: [
        { keys: 'Shift+1', desc: '전체를 화면에 맞추기' },
        { keys: 'Shift+2', desc: '선택한 개체에 맞추기' },
        { keys: 'Shift+0', desc: '100% 배율로 보기' },
        { keys: 'Ctrl+= / -', desc: '확대 / 축소' },
        { keys: 'Ctrl+\\', desc: '모든 UI 숨기기 / 보이기' },
        { keys: 'Shift+R', desc: '눈금자 표시' },
        { keys: 'Ctrl+Y', desc: '아웃라인 모드 보기' },
        { keys: "Ctrl+'", desc: '픽셀 그리드 표시' },
        { keys: 'Ctrl+/', desc: '빠른 실행 (기능 검색)' },
      ],
    },
    {
      id: 'fig-select',
      title: '선택',
      icon: '🎯',
      items: [
        { keys: 'Ctrl+A', desc: '전체 선택' },
        { keys: 'Enter', desc: '한 단계 안쪽 자식 선택' },
        { keys: 'Esc', desc: '선택 해제 / 상위로 나가기' },
        { keys: 'Ctrl+Click', desc: '중첩된 개체 바로 선택' },
        { keys: 'Shift+Click', desc: '선택에 추가 / 제외' },
        { keys: 'Ctrl+Shift+A', desc: '같은 종류 모두 선택' },
        { keys: 'Tab', desc: '형제 개체로 선택 이동' },
      ],
    },
    {
      id: 'fig-edit',
      title: '편집 · 배치',
      icon: '🧩',
      items: [
        { keys: 'Ctrl+D', desc: '복제 (Duplicate)' },
        { keys: 'Ctrl+G', desc: '그룹 만들기' },
        { keys: 'Ctrl+Shift+G', desc: '그룹 해제' },
        { keys: 'Ctrl+Alt+G', desc: '프레임으로 감싸기' },
        { keys: 'Ctrl+R', desc: '레이어 이름 바꾸기' },
        { keys: 'Ctrl+Shift+H', desc: '숨기기 / 보이기' },
        { keys: 'Ctrl+Shift+L', desc: '잠금 / 잠금 해제' },
        { keys: 'Ctrl+Alt+C', desc: '속성 복사' },
        { keys: 'Ctrl+Alt+V', desc: '속성 붙여넣기' },
        { keys: 'Ctrl+Shift+V', desc: '제자리에 붙여넣기' },
        { keys: 'Ctrl+] / [', desc: '맨 앞 / 맨 뒤로 보내기' },
      ],
    },
    {
      id: 'fig-align',
      title: '정렬 · 간격',
      icon: '📏',
      items: [
        { keys: 'Alt+A', desc: '왼쪽 정렬' },
        { keys: 'Alt+D', desc: '오른쪽 정렬' },
        { keys: 'Alt+W', desc: '위쪽 정렬' },
        { keys: 'Alt+S', desc: '아래쪽 정렬' },
        { keys: 'Alt+H', desc: '가로 가운데 정렬' },
        { keys: 'Alt+V', desc: '세로 가운데 정렬' },
        { keys: 'Ctrl+Alt+H', desc: '가로 간격 균등 분배' },
        { keys: 'Ctrl+Alt+V', desc: '세로 간격 균등 분배' },
      ],
    },
    {
      id: 'fig-auto',
      title: '오토 레이아웃 · 컴포넌트',
      icon: '🧱',
      items: [
        { keys: 'Shift+A', desc: '오토 레이아웃 적용' },
        { keys: 'Shift+Alt+A', desc: '오토 레이아웃 제거' },
        { keys: 'Ctrl+Alt+K', desc: '컴포넌트로 만들기' },
        { keys: 'Ctrl+Alt+B', desc: '인스턴스 분리 (Detach)' },
        { keys: 'Ctrl+Alt+M', desc: '마스크 씌우기' },
        { keys: 'Ctrl+E', desc: '선택 영역 평탄화 (Flatten)' },
        { keys: 'Ctrl+Shift+O', desc: '선을 도형으로 변환' },
      ],
    },
    {
      id: 'fig-text',
      title: '텍스트 서식',
      icon: '✍️',
      items: [
        { keys: 'Ctrl+B', desc: '굵게' },
        { keys: 'Ctrl+I', desc: '기울임' },
        { keys: 'Ctrl+U', desc: '밑줄' },
        { keys: 'Ctrl+Shift+X', desc: '취소선' },
        { keys: 'Ctrl+Shift+> / <', desc: '글자 크기 키우기 / 줄이기' },
        { keys: 'Alt+← / →', desc: '자간 좁히기 / 넓히기' },
        { keys: 'Alt+↑ / ↓', desc: '행간 좁히기 / 넓히기' },
        { keys: 'Ctrl+Alt+L / T / R', desc: '왼쪽 / 가운데 / 오른쪽 정렬' },
      ],
    },
    {
      id: 'fig-export',
      title: '패널 · 내보내기',
      icon: '📤',
      items: [
        { keys: 'Ctrl+Shift+E', desc: '내보내기 (Export)' },
        { keys: 'Ctrl+Alt+P', desc: '이미지로 복사 (PNG)' },
        { keys: 'Alt+2', desc: '레이어 패널로 전환' },
        { keys: 'Alt+3', desc: '에셋 패널로 전환' },
        { keys: 'Ctrl+Alt+Y', desc: '프로토타입 재생 (Present)' },
        { keys: 'Ctrl+Shift+K', desc: '이미지 배치하기' },
      ],
    },
  ],
};

// ── Microsoft PowerPoint ─────────────────────────────────────────────────────

const POWERPOINT: ShortcutProgram = {
  id: 'ppt',
  name: 'Microsoft PowerPoint',
  shortName: 'PPT',
  mark: 'P',
  color: '#D24726',
  colorDim: 'rgba(210, 71, 38, 0.14)',
  categories: [
    {
      id: 'ppt-file',
      title: '파일 · 문서',
      icon: '📄',
      items: [
        { keys: 'Ctrl+N', desc: '새 프레젠테이션' },
        { keys: 'Ctrl+O', desc: '프레젠테이션 열기' },
        { keys: 'Ctrl+S', desc: '저장' },
        { keys: 'F12', desc: '다른 이름으로 저장' },
        { keys: 'Ctrl+P', desc: '인쇄' },
        { keys: 'Ctrl+W', desc: '프레젠테이션 닫기' },
        { keys: 'Alt+F4', desc: 'PowerPoint 종료' },
      ],
    },
    {
      id: 'ppt-edit',
      title: '편집 기본',
      icon: '✂️',
      items: [
        { keys: 'Ctrl+Z', desc: '실행 취소' },
        { keys: 'Ctrl+Y', desc: '다시 실행' },
        { keys: 'Ctrl+X', desc: '잘라내기' },
        { keys: 'Ctrl+C', desc: '복사' },
        { keys: 'Ctrl+V', desc: '붙여넣기' },
        { keys: 'Ctrl+Alt+V', desc: '선택하여 붙여넣기' },
        { keys: 'Ctrl+D', desc: '선택한 개체 복제' },
        { keys: 'Ctrl+A', desc: '전체 선택' },
        { keys: 'Ctrl+Shift+C', desc: '서식 복사' },
        { keys: 'Ctrl+Shift+V', desc: '서식 붙여넣기' },
      ],
    },
    {
      id: 'ppt-slide',
      title: '슬라이드 관리 · 이동',
      icon: '🗂️',
      items: [
        { keys: 'Ctrl+M', desc: '새 슬라이드 삽입' },
        { keys: 'Ctrl+D (슬라이드 선택 시)', desc: '슬라이드 복제' },
        { keys: 'Delete (슬라이드 선택 시)', desc: '슬라이드 삭제' },
        { keys: 'Page Up / ↑', desc: '이전 슬라이드로 이동' },
        { keys: 'Page Down / ↓', desc: '다음 슬라이드로 이동' },
        { keys: 'Ctrl+Home', desc: '첫 슬라이드로 이동' },
        { keys: 'Ctrl+End', desc: '마지막 슬라이드로 이동' },
        { keys: 'Ctrl+A (슬라이드 창에서)', desc: '모든 슬라이드 선택' },
      ],
    },
    {
      id: 'ppt-text',
      title: '텍스트 서식',
      icon: '🔤',
      items: [
        { keys: 'Ctrl+B', desc: '굵게' },
        { keys: 'Ctrl+I', desc: '기울임꼴' },
        { keys: 'Ctrl+U', desc: '밑줄' },
        { keys: 'Ctrl+Shift+F', desc: '글꼴 대화상자 열기' },
        { keys: 'Ctrl+Shift+P', desc: '글꼴 크기 상자로 이동' },
        { keys: 'Ctrl+Shift+>', desc: '글꼴 크기 크게' },
        { keys: 'Ctrl+Shift+<', desc: '글꼴 크기 작게' },
        { keys: 'Ctrl+E', desc: '가운데 정렬' },
        { keys: 'Ctrl+L', desc: '왼쪽 정렬' },
        { keys: 'Ctrl+R', desc: '오른쪽 정렬' },
        { keys: 'Ctrl+J', desc: '양쪽 정렬' },
        { keys: 'Ctrl+Spacebar', desc: '글자 서식 지우기' },
      ],
    },
    {
      id: 'ppt-object',
      title: '개체 다루기',
      icon: '🧩',
      items: [
        { keys: 'Ctrl+G', desc: '개체 그룹 지정' },
        { keys: 'Ctrl+Shift+G', desc: '그룹 해제' },
        { keys: 'Tab', desc: '다음 개체 선택' },
        { keys: 'Shift+Tab', desc: '이전 개체 선택' },
        { keys: 'Esc', desc: '개체 선택 해제' },
        { keys: 'Ctrl+K', desc: '하이퍼링크 삽입' },
        { keys: 'Delete', desc: '선택한 개체 삭제' },
      ],
    },
    {
      id: 'ppt-align',
      title: '정렬 · 배치',
      icon: '📐',
      items: [
        { keys: '↑ / ↓ / ← / →', desc: '선택한 개체 이동' },
        { keys: 'Ctrl+↑ / ↓ / ← / →', desc: '개체를 더 세밀하게 이동' },
        { keys: 'Shift+F9', desc: '눈금선 표시 / 숨기기' },
        { keys: 'Alt+F9', desc: '안내선 표시 / 숨기기' },
      ],
    },
    {
      id: 'ppt-show',
      title: '슬라이드 쇼 실행',
      icon: '🎥',
      items: [
        { keys: 'F5', desc: '처음부터 슬라이드 쇼 시작' },
        { keys: 'Shift+F5', desc: '현재 슬라이드부터 시작' },
        { keys: 'Alt+F5', desc: '프레젠터 보기로 시작' },
        { keys: 'Esc', desc: '슬라이드 쇼 종료' },
        { keys: 'N / Enter / → / ↓ / Space', desc: '다음 슬라이드 · 애니메이션' },
        { keys: 'P / ← / ↑ / Backspace', desc: '이전 슬라이드 · 애니메이션' },
        { keys: '숫자 , Enter', desc: '해당 번호 슬라이드로 이동' },
        { keys: 'B', desc: '화면을 검은색으로 전환 / 복귀' },
        { keys: 'W', desc: '화면을 흰색으로 전환 / 복귀' },
        { keys: 'Ctrl+P', desc: '포인터를 펜으로 전환' },
        { keys: 'Ctrl+A', desc: '포인터를 화살표로 전환' },
        { keys: 'Ctrl+E', desc: '포인터를 지우개로 전환' },
        { keys: 'E', desc: '슬라이드에 그린 잉크 지우기' },
        { keys: 'Ctrl+H', desc: '포인터 · 버튼 즉시 숨기기' },
        { keys: 'Ctrl+S', desc: '모든 슬라이드 보기 대화상자' },
      ],
    },
    {
      id: 'ppt-view',
      title: '보기 · 도구',
      icon: '👁️',
      items: [
        { keys: 'Ctrl+F1', desc: '리본 메뉴 접기 / 펴기' },
        { keys: 'Alt', desc: '리본 키 설명(Key Tip) 표시' },
        { keys: 'F6', desc: '창 · 패널 간 전환' },
        { keys: 'Ctrl+F2', desc: '인쇄 미리 보기로 전환' },
        { keys: 'F7', desc: '맞춤법 검사' },
      ],
    },
  ],
};

export const SHORTCUT_PROGRAMS: ShortcutProgram[] = [HWP, FIGMA, POWERPOINT];

export const TOTAL_SHORTCUT_COUNT = SHORTCUT_PROGRAMS.reduce(
  (sum, p) => sum + p.categories.reduce((s, c) => s + c.items.length, 0),
  0,
);

export function countShortcuts(program: ShortcutProgram): number {
  return program.categories.reduce((s, c) => s + c.items.length, 0);
}
