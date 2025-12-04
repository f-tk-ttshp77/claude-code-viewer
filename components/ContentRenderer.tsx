'use client';

import { MarkdownRenderer } from './MarkdownRenderer';
import { CommandAccordion } from './CommandAccordion';

interface Props {
  content: string;
  isCommandExpansion?: boolean;
  commandName?: string;
}

// XMLタグをパースして適切にレンダリング
export function ContentRenderer({ content, isCommandExpansion, commandName }: Props) {
  // コマンド展開の場合はアコーディオンで表示
  if (isCommandExpansion && commandName) {
    return <CommandAccordion commandName={commandName} content={content} />;
  }

  // XMLタグを含むコンテンツを処理
  const parsedContent = parseXmlTags(content);

  return (
    <div>
      {parsedContent.map((segment, index) => (
        <div key={index}>
          {segment.type === 'text' && (
            <MarkdownRenderer content={segment.content} />
          )}
          {segment.type === 'command-message' && (
            <div className="my-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r">
              <div className="text-xs text-blue-600 font-medium mb-1">
                コマンドメッセージ
              </div>
              <div className="text-blue-800">
                {segment.content}
              </div>
            </div>
          )}
          {segment.type === 'command-name' && (
            <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded font-mono text-sm">
              {segment.content}
            </span>
          )}
          {segment.type === 'command-args' && (
            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded font-mono text-sm ml-1">
              {segment.content}
            </span>
          )}
          {segment.type === 'antml-function-calls' && (
            <FunctionCallsRenderer content={segment.content} />
          )}
          {segment.type === 'function-results' && (
            <FunctionResultsRenderer content={segment.content} />
          )}
        </div>
      ))}
    </div>
  );
}

interface ContentSegment {
  type: 'text' | 'command-message' | 'command-name' | 'command-args' | 'antml-function-calls' | 'function-results';
  content: string;
}

function parseXmlTags(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // タグパターン
  const tagPatterns = [
    { tag: 'command-message', type: 'command-message' as const },
    { tag: 'command-name', type: 'command-name' as const },
    { tag: 'command-args', type: 'command-args' as const },
    { tag: 'antml:function_calls', type: 'antml-function-calls' as const },
    { tag: 'function_results', type: 'function-results' as const },
  ];

  let remaining = content;

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; type: ContentSegment['type']; innerContent: string } | null = null;

    for (const { tag, type } of tagPatterns) {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
      const match = regex.exec(remaining);

      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          type,
          innerContent: match[1],
        };
      }
    }

    if (earliestMatch) {
      // タグの前のテキスト
      if (earliestMatch.index > 0) {
        const textBefore = remaining.slice(0, earliestMatch.index).trim();
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore });
        }
      }

      // タグの内容
      segments.push({ type: earliestMatch.type, content: earliestMatch.innerContent.trim() });

      // 残りの文字列を更新
      remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
    } else {
      // タグが見つからない場合は残りをテキストとして追加
      const trimmed = remaining.trim();
      if (trimmed) {
        segments.push({ type: 'text', content: trimmed });
      }
      break;
    }
  }

  return segments;
}

// 関数呼び出しのレンダリング
function FunctionCallsRenderer({ content }: { content: string }) {
  // antml:invoke タグをパース
  const invokeRegex = /<invoke\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/antml:invoke>/gi;
  const invokes: { name: string; params: { name: string; value: string }[] }[] = [];

  let match;
  while ((match = invokeRegex.exec(content)) !== null) {
    const name = match[1];
    const paramsContent = match[2];

    // パラメータをパース
    const paramRegex = /<parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/antml:parameter>/gi;
    const params: { name: string; value: string }[] = [];

    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
      params.push({ name: paramMatch[1], value: paramMatch[2].trim() });
    }

    invokes.push({ name, params });
  }

  if (invokes.length === 0) {
    return (
      <div className="my-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm font-mono">
        {content}
      </div>
    );
  }

  return (
    <div className="my-3 space-y-2">
      {invokes.map((invoke, idx) => (
        <div key={idx} className="border border-orange-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
            <span className="text-orange-600">🔧</span>
            <span className="font-medium text-orange-800">{invoke.name}</span>
          </div>
          {invoke.params.length > 0 && (
            <div className="p-3 bg-white text-sm">
              {invoke.params.map((param, pIdx) => (
                <div key={pIdx} className="mb-2 last:mb-0">
                  <div className="text-xs text-gray-500 mb-1">{param.name}:</div>
                  <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {param.value.length > 500 ? param.value.slice(0, 500) + '...' : param.value}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 関数結果のレンダリング
function FunctionResultsRenderer({ content }: { content: string }) {
  const truncated = content.length > 1000 ? content.slice(0, 1000) + '\n... (truncated)' : content;

  return (
    <div className="my-3 border border-green-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2">
        <span className="text-green-600">✓</span>
        <span className="font-medium text-green-800">実行結果</span>
      </div>
      <pre className="p-3 bg-white text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
        {truncated}
      </pre>
    </div>
  );
}
