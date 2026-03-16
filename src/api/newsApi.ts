import axios from 'axios';
import { HackerNewsHit } from '@/types';

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'llama', 'openai', 'anthropic', 'deepmind',
  'machine learning', 'deep learning', 'neural', 'transformer', 'diffusion',
  'artificial intelligence', 'chatgpt', 'mistral', 'copilot', 'sora', 'stable diffusion',
];

function isAIRelated(title: string): boolean {
  const lower = title.toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

export async function fetchAINews(): Promise<HackerNewsHit[]> {
  const res = await axios.get('https://hn.algolia.com/api/v1/search', {
    params: {
      query: 'AI artificial intelligence LLM machine learning',
      tags: 'story',
      hitsPerPage: 40,
      numericFilters: 'points>5',
    },
    timeout: 10000,
  });

  const hits: HackerNewsHit[] = (res.data.hits as HackerNewsHit[])
    .filter(h => h.title && isAIRelated(h.title))
    .slice(0, 15);

  return hits;
}
