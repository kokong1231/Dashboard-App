import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ────────────────────────────────────────────────────────────────────────────────
// Factory — 외부 API 클라이언트를 생성하는 범용 팩토리
// ────────────────────────────────────────────────────────────────────────────────
export function createApiClient(
  baseURL: string,
  defaultHeaders?: Record<string, string>,
): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    },
  });

  // 요청 인터셉터 — 토큰 자동 주입
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // const token = useAuthStore.getState().token;
      // if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // 응답 인터셉터 — 공통 에러 처리
  client.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // 토큰 만료 처리
      }
      return Promise.reject(error);
    },
  );

  return client;
}

// ────────────────────────────────────────────────────────────────────────────────
// Notion API 클라이언트
// Authorization 토큰은 환경변수 또는 useAuthStore에서 주입
// ────────────────────────────────────────────────────────────────────────────────
export const notionClient = createApiClient('https://api.notion.com/v1', {
  'Notion-Version': '2022-06-28',
  // Authorization: `Bearer ${NOTION_API_KEY}` — 런타임에 주입
});

// 기본 export — 프로젝트 자체 백엔드가 생길 경우 사용
const apiClient = createApiClient('https://api.example.com');

export default apiClient;
