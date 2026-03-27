declare module '@env' {
  export const NOTION_API_KEY: string;
  export const GITHUB_TOKEN: string;
}

declare const process: {
  env: Record<string, string | undefined>;
};
