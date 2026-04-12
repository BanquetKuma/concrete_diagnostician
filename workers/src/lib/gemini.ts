import { ChatMessage } from '../types/chat';

export const SYSTEM_PROMPT =
  'あなたはコンクリート診断士試験の学習を支援するアシスタントです。' +
  '提供された教科書の内容に基づいて、正確かつ分かりやすく回答してください。' +
  '教科書に記載がない場合や確信が持てない場合は、その旨を正直に伝えてください。' +
  '専門用語は初学者にも理解できるように補足してください。' +
  '\n\n【回答フォーマットの注意】' +
  '・表（テーブル）を使用する場合は、各セルを短い単語や短文にしてください。セル内に箇条書きや改行を含めないでください。' +
  '・複雑な情報は表ではなく、見出し（###）と箇条書き（・）で整理してください。' +
  '・太字記法（**）は使わないでください。強調したい場合はそのまま記載してください。';

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiRequestBody {
  system_instruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools?: Array<{
    file_search: { file_search_store_names: string[] };
  }>;
  generationConfig?: {
    temperature?: number;
    thinkingConfig?: {
      thinkingBudget?: number;
    };
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

export interface GeminiCallParams {
  apiKey: string;
  model: string;
  fileSearchStoreName: string;
  message: string;
  history: ChatMessage[];
  questionContext?: string;
}

export async function callGemini(params: GeminiCallParams): Promise<string> {
  const { apiKey, model, fileSearchStoreName, message, history, questionContext } = params;

  const systemText = questionContext
    ? `${SYSTEM_PROMPT}\n\n【学習者が取り組んでいる問題】\n${questionContext}`
    : SYSTEM_PROMPT;

  // Gemini conversation format: map history to user/model roles
  const contents: GeminiContent[] = [
    ...history.map<GeminiContent>((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const body: GeminiRequestBody = {
    system_instruction: { parts: [{ text: systemText }] },
    contents,
    tools: [
      {
        file_search: {
          file_search_store_names: [fileSearchStoreName],
        },
      },
    ],
    generationConfig: {
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 1024 },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked response: ${data.promptFeedback.blockReason}`);
  }

  const rawText = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('')
    .trim();

  if (!rawText) {
    throw new Error('Gemini returned empty response');
  }

  // Clean up markup that causes display issues:
  // - <br>, <br/>, <br /> → newline
  // - ** bold markers → remove (react-native-markdown-display doesn't
  //   reliably render them with Japanese text / streaming chunks)
  return rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\*\*/g, '');
}
