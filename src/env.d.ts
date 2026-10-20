declare module '@env' {
  export const NOTION_API_KEY: string;
  export const GITHUB_TOKEN: string;
  export const CLAUDE_API_KEY: string;
}

declare const process: {
  env: Record<string, string | undefined>;
};
