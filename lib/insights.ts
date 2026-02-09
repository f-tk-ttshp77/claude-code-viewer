import fs from 'fs';
import path from 'path';
import { getProjects } from './parser';
import type { InsightsResult, InsightDetail, ContentItem } from './types';

// ---------- JSONL raw types (local to this module) ----------

interface RawToolUse {
  type: 'tool_use';
  name: string;
  input?: Record<string, unknown>;
}

interface RawLineData {
  type: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: string | (ContentItem | RawToolUse)[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

// ---------- Per-session extracted data ----------

interface SessionAnalysis {
  timestamp: string;
  toolCalls: { name: string; input?: Record<string, unknown> }[];
  userMessages: string[]; // text-only user messages (excluding tool results / system)
  assistantTurnCount: number;
  taskBoundaries: number; // number of user-initiated tasks
  assistantTurnsPerTask: number[];
  totalInputTokens: number;
  totalOutputTokens: number;
  editWriteCount: number;
  editTargetFiles: Map<string, number>; // file -> edit count
  hasEditOrWrite: boolean;
  hasTestOrBuild: boolean;
  hasPlanMode: boolean;
  hasSubAgent: boolean;
}

// ---------- Helpers ----------

function getClaudePath(): string {
  if (process.env.CLAUDE_DATA_PATH) {
    return process.env.CLAUDE_DATA_PATH;
  }
  return path.join(process.env.HOME || '', '.claude', 'projects');
}

function extractUserText(content: string | (ContentItem | RawToolUse)[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item): item is ContentItem => item.type === 'text' && !!item.text)
      .map((item) => item.text!)
      .join('\n');
  }
  return '';
}

function extractToolCalls(
  content: string | (ContentItem | RawToolUse)[]
): { name: string; input?: Record<string, unknown> }[] {
  if (typeof content === 'string') return [];
  if (Array.isArray(content)) {
    return content
      .filter(
        (item): item is RawToolUse => item.type === 'tool_use' && 'name' in item && !!item.name
      )
      .map((item) => ({ name: item.name, input: item.input }));
  }
  return [];
}

function isUserMessage(text: string): boolean {
  return (
    !!text &&
    !text.startsWith('<function_results>') &&
    !text.startsWith('<system-reminder>') &&
    !text.startsWith('<tool_result')
  );
}

// ---------- Session analyser ----------

function analyzeSessionFile(filePath: string): SessionAnalysis | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    const analysis: SessionAnalysis = {
      timestamp: '',
      toolCalls: [],
      userMessages: [],
      assistantTurnCount: 0,
      taskBoundaries: 0,
      assistantTurnsPerTask: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      editWriteCount: 0,
      editTargetFiles: new Map(),
      hasEditOrWrite: false,
      hasTestOrBuild: false,
      hasPlanMode: false,
      hasSubAgent: false,
    };

    let currentTaskAssistantTurns = 0;
    let inTask = false;

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as RawLineData;

        // Track timestamps
        if (data.timestamp && !analysis.timestamp) {
          analysis.timestamp = data.timestamp;
        }

        // User messages
        if (data.type === 'user' && data.message?.content) {
          const text = extractUserText(data.message.content);
          if (isUserMessage(text)) {
            analysis.userMessages.push(text);
            // Task boundary
            if (inTask) {
              analysis.assistantTurnsPerTask.push(currentTaskAssistantTurns);
            }
            analysis.taskBoundaries++;
            currentTaskAssistantTurns = 0;
            inTask = true;
          }
        }

        // Assistant messages
        if (data.type === 'assistant' && data.message?.content) {
          analysis.assistantTurnCount++;
          currentTaskAssistantTurns++;

          // Token usage
          if (data.message.usage) {
            analysis.totalInputTokens += data.message.usage.input_tokens || 0;
            analysis.totalOutputTokens += data.message.usage.output_tokens || 0;
          }

          // Tool calls
          const tools = extractToolCalls(data.message.content);
          for (const tool of tools) {
            analysis.toolCalls.push(tool);

            if (tool.name === 'Edit') {
              analysis.editWriteCount++;
              analysis.hasEditOrWrite = true;
              const fp = (tool.input?.file_path as string) || '';
              analysis.editTargetFiles.set(fp, (analysis.editTargetFiles.get(fp) || 0) + 1);
            }
            if (tool.name === 'Write') {
              analysis.editWriteCount++;
              analysis.hasEditOrWrite = true;
            }
            if (tool.name === 'EnterPlanMode') {
              analysis.hasPlanMode = true;
            }
            if (tool.name === 'Task') {
              analysis.hasSubAgent = true;
            }

            // Test/build detection in Bash
            if (tool.name === 'Bash' && typeof tool.input?.command === 'string') {
              const cmd = tool.input.command as string;
              if (/\b(test|build|lint|vitest|jest|pytest)\b/.test(cmd)) {
                analysis.hasTestOrBuild = true;
              }
            }
          }
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Close last task
    if (inTask) {
      analysis.assistantTurnsPerTask.push(currentTaskAssistantTurns);
    }

    return analysis;
  } catch {
    return null;
  }
}

// ---------- Scoring functions ----------

function scoreBestPractice(sessions: SessionAnalysis[]): {
  score: number;
  details: InsightDetail[];
} {
  const details: InsightDetail[] = [];

  // 1. Tool selection appropriateness
  let appropriateCount = 0;
  let inappropriateCount = 0;
  const badPatterns = /^(cat |head |tail |grep |rg |find |sed |awk |echo\s*>)/;

  for (const s of sessions) {
    for (const tool of s.toolCalls) {
      if (tool.name === 'Bash' && typeof tool.input?.command === 'string') {
        if (badPatterns.test(tool.input.command as string)) {
          inappropriateCount++;
        } else {
          appropriateCount++;
        }
      }
    }
  }
  const totalBashCalls = appropriateCount + inappropriateCount;
  const toolSelectionScore =
    totalBashCalls === 0 ? 100 : Math.round((appropriateCount / totalBashCalls) * 100);
  details.push({
    category: 'ツール選択の適切さ',
    score: toolSelectionScore,
    finding:
      toolSelectionScore >= 80
        ? 'Bashの代わりに専用ツール(Read/Grep等)を適切に使用しています。'
        : `Bashで不適切なコマンド(cat/grep等)が${inappropriateCount}回使用されています。専用ツールの活用を推奨します。`,
  });

  // 2. Plan Mode usage
  const planModeCount = sessions.filter((s) => s.hasPlanMode).length;
  const planModeScore = planModeCount === 0 ? 0 : planModeCount === 1 ? 50 : 100;
  details.push({
    category: 'Plan Mode活用',
    score: planModeScore,
    finding:
      planModeScore >= 50
        ? `Plan Modeを${planModeCount}セッションで活用しています。`
        : 'Plan Modeが使われていません。複雑なタスクではPlan Modeの活用を検討しましょう。',
  });

  // 3. Test/build verification rate
  const sessionsWithChanges = sessions.filter((s) => s.hasEditOrWrite);
  const sessionsWithVerification = sessionsWithChanges.filter((s) => s.hasTestOrBuild);
  const verificationScore =
    sessionsWithChanges.length === 0
      ? 100
      : Math.round((sessionsWithVerification.length / sessionsWithChanges.length) * 100);
  details.push({
    category: 'テスト・ビルド検証率',
    score: verificationScore,
    finding:
      verificationScore >= 70
        ? `変更を行ったセッションの${verificationScore}%でテスト/ビルド検証を実施しています。`
        : `変更後のテスト/ビルド検証率が${verificationScore}%と低いです。変更後は必ず検証しましょう。`,
  });

  // 4. Sub-agent usage
  const sessionsWithSubAgent = sessions.filter((s) => s.hasSubAgent).length;
  const subAgentScore =
    sessions.length === 0 ? 0 : Math.round((sessionsWithSubAgent / sessions.length) * 100);
  details.push({
    category: 'サブエージェント活用',
    score: subAgentScore,
    finding:
      subAgentScore >= 30
        ? `${sessionsWithSubAgent}セッションでサブエージェントを活用しています。`
        : 'サブエージェント(Task)の活用が少ないです。並列作業や調査にはサブエージェントが効果的です。',
  });

  // 5. CLAUDE.md existence
  const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
  const claudeMdScore = fs.existsSync(claudeMdPath) ? 100 : 0;
  details.push({
    category: 'CLAUDE.md整備',
    score: claudeMdScore,
    finding:
      claudeMdScore === 100
        ? 'プロジェクトにCLAUDE.mdが整備されています。'
        : 'CLAUDE.mdが未整備です。プロジェクトのコンテキストをCLAUDE.mdにまとめましょう。',
  });

  const score = Math.round(details.reduce((sum, d) => sum + d.score, 0) / details.length);
  return { score, details };
}

function scoreInstructionQuality(sessions: SessionAnalysis[]): {
  score: number;
  details: InsightDetail[];
} {
  const details: InsightDetail[] = [];

  // Collect all user messages
  const allUserMessages = sessions.flatMap((s) => s.userMessages);

  // 1. Specificity (average character count)
  const avgLength =
    allUserMessages.length === 0
      ? 0
      : allUserMessages.reduce((sum, m) => sum + m.length, 0) / allUserMessages.length;
  let specificityScore: number;
  if (avgLength >= 500) specificityScore = 100;
  else if (avgLength >= 150) specificityScore = 90;
  else if (avgLength >= 50) specificityScore = 60;
  else specificityScore = 30;
  details.push({
    category: '指示の具体性',
    score: specificityScore,
    finding:
      specificityScore >= 60
        ? `ユーザー指示の平均文字数は${Math.round(avgLength)}文字で、適切な具体性があります。`
        : `ユーザー指示の平均文字数が${Math.round(avgLength)}文字と短いです。より具体的な指示を心がけましょう。`,
  });

  // 2. Context provision (file path inclusion rate)
  const filePathPattern = /(\/[\w./-]+\.\w+|[\w-]+\.\w{1,5})/;
  const messagesWithFilePath = allUserMessages.filter((m) => filePathPattern.test(m));
  const contextScore =
    allUserMessages.length === 0
      ? 0
      : Math.round((messagesWithFilePath.length / allUserMessages.length) * 100);
  details.push({
    category: 'コンテキスト提供度',
    score: contextScore,
    finding:
      contextScore >= 50
        ? `指示の${contextScore}%にファイルパスが含まれており、コンテキストが明確です。`
        : `指示にファイルパスを含む割合が${contextScore}%と低いです。対象ファイルを明示すると精度が上がります。`,
  });

  // 3. Initial instruction accuracy (assistant turns per task)
  const allTurns = sessions.flatMap((s) => s.assistantTurnsPerTask);
  const avgTurns =
    allTurns.length === 0 ? 0 : allTurns.reduce((sum, t) => sum + t, 0) / allTurns.length;
  let accuracyScore: number;
  if (avgTurns <= 3) accuracyScore = 100;
  else if (avgTurns <= 5) accuracyScore = 80;
  else if (avgTurns <= 10) accuracyScore = 50;
  else accuracyScore = 30;
  details.push({
    category: '初期指示の的確さ',
    score: accuracyScore,
    finding:
      accuracyScore >= 60
        ? `タスクあたり平均${avgTurns.toFixed(1)}ターンで完了しており、指示が的確です。`
        : `タスクあたり平均${avgTurns.toFixed(1)}ターンかかっています。初期指示をより明確にすると効率が上がります。`,
  });

  // 4. Low course corrections
  const correctionPatterns = /違う|そうじゃない|やり直し|キャンセル|間違い|ちがう|やめて|取り消し/;
  const correctionMessages = allUserMessages.filter((m) => correctionPatterns.test(m));
  const correctionRate =
    allUserMessages.length === 0 ? 0 : correctionMessages.length / allUserMessages.length;
  const correctionScore = Math.max(0, Math.round(100 - correctionRate * 200));
  details.push({
    category: '軌道修正の少なさ',
    score: correctionScore,
    finding:
      correctionScore >= 80
        ? '軌道修正が少なく、初期指示の質が高いです。'
        : `軌道修正メッセージが${correctionMessages.length}件検出されました。要件を事前に明確にすると手戻りが減ります。`,
  });

  const score = Math.round(details.reduce((sum, d) => sum + d.score, 0) / details.length);
  return { score, details };
}

function scoreWorkDensity(sessions: SessionAnalysis[]): {
  score: number;
  details: InsightDetail[];
} {
  const details: InsightDetail[] = [];

  // 1. Token efficiency
  const totalEditWrite = sessions.reduce((sum, s) => sum + s.editWriteCount, 0);
  const totalTokens = sessions.reduce(
    (sum, s) => sum + s.totalInputTokens + s.totalOutputTokens,
    0
  );
  const tokenPer100k = totalTokens / 100000;
  const ratio = tokenPer100k === 0 ? 0 : totalEditWrite / tokenPer100k;
  let tokenEfficiencyScore: number;
  if (ratio >= 10) tokenEfficiencyScore = 100;
  else if (ratio >= 5) tokenEfficiencyScore = 80;
  else if (ratio >= 2) tokenEfficiencyScore = 60;
  else if (ratio >= 1) tokenEfficiencyScore = 40;
  else tokenEfficiencyScore = 20;
  details.push({
    category: 'トークン効率',
    score: tokenEfficiencyScore,
    finding:
      tokenEfficiencyScore >= 60
        ? `10万トークンあたり${ratio.toFixed(1)}回のファイル変更があり、トークン効率が良好です。`
        : `10万トークンあたり${ratio.toFixed(1)}回のファイル変更で、調査に比べて実装の密度が低いです。`,
  });

  // 2. Phase balance
  const allTools = sessions.flatMap((s) => s.toolCalls);
  const investigationTools = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch']);
  const implementationTools = new Set(['Edit', 'Write']);
  const totalToolCalls = allTools.length;

  let investigationCount = 0;
  let planningCount = 0;
  let implementationCount = 0;
  let verificationCount = 0;

  for (const tool of allTools) {
    if (investigationTools.has(tool.name)) {
      investigationCount++;
    } else if (
      tool.name === 'EnterPlanMode' ||
      tool.name === 'TodoWrite' ||
      (tool.name === 'Task' && (tool.input as Record<string, unknown>)?.subagent_type === 'Plan')
    ) {
      planningCount++;
    } else if (implementationTools.has(tool.name)) {
      implementationCount++;
    } else if (
      tool.name === 'Bash' &&
      typeof tool.input?.command === 'string' &&
      /\b(test|build|lint|vitest|jest|pytest)\b/.test(tool.input.command as string)
    ) {
      verificationCount++;
    }
  }

  const implVerifyRatio =
    totalToolCalls === 0 ? 0 : (implementationCount + verificationCount) / totalToolCalls;
  let phaseBalanceScore: number;
  if (implVerifyRatio >= 0.4) phaseBalanceScore = 100;
  else if (implVerifyRatio >= 0.3) phaseBalanceScore = 80;
  else if (implVerifyRatio >= 0.2) phaseBalanceScore = 60;
  else phaseBalanceScore = 40;
  const implVerifyPct = Math.round(implVerifyRatio * 100);
  const investigationPct =
    totalToolCalls === 0 ? 0 : Math.round((investigationCount / totalToolCalls) * 100);
  const planningPct = totalToolCalls === 0 ? 0 : Math.round((planningCount / totalToolCalls) * 100);
  details.push({
    category: 'フェーズバランス',
    score: phaseBalanceScore,
    finding:
      phaseBalanceScore >= 60
        ? `実装+検証が全体の${implVerifyPct}%を占め、バランスの良い作業配分です（調査${investigationPct}%、計画${planningPct}%）。`
        : `実装+検証の比率が${implVerifyPct}%と低く、調査偏重の傾向があります（調査${investigationPct}%、計画${planningPct}%）。`,
  });

  // 3. Low rework
  const allEditFiles = new Map<string, number>();
  for (const s of sessions) {
    for (const [file, count] of s.editTargetFiles) {
      allEditFiles.set(file, (allEditFiles.get(file) || 0) + count);
    }
  }
  const totalEditedFiles = allEditFiles.size;
  const reworkFiles = Array.from(allEditFiles.values()).filter((c) => c >= 3).length;
  const reworkRate = totalEditedFiles === 0 ? 0 : reworkFiles / totalEditedFiles;
  const reworkScore = Math.max(0, Math.round(100 - reworkRate * 200));
  details.push({
    category: '手戻りの少なさ',
    score: reworkScore,
    finding:
      reworkScore >= 70
        ? '同一ファイルへの繰り返し編集が少なく、効率的に作業しています。'
        : `${reworkFiles}ファイルで3回以上の編集が発生しています。事前設計を強化すると手戻りが減ります。`,
  });

  const score = Math.round(details.reduce((sum, d) => sum + d.score, 0) / details.length);
  return { score, details };
}

// ---------- Recommendations ----------

function generateRecommendations(
  bestPractice: { details: InsightDetail[] },
  instructionQuality: { details: InsightDetail[] },
  workDensity: { details: InsightDetail[] }
): string[] {
  const allDetails = [
    ...bestPractice.details,
    ...instructionQuality.details,
    ...workDensity.details,
  ];

  const lowScoreDetails = allDetails.filter((d) => d.score < 60).sort((a, b) => a.score - b.score);

  const recommendationMap: Record<string, string> = {
    ツール選択の適切さ:
      'Bashでcat/grepを使う代わりに、Read/Grepツールを活用しましょう。Claude Codeの専用ツールの方が効率的です。',
    'Plan Mode活用':
      '複雑なタスクにはPlan Modeを活用しましょう。事前に計画を立てることで、実装の質と効率が向上します。',
    'テスト・ビルド検証率':
      'コード変更後は必ずテスト・ビルドで検証しましょう。バグの早期発見につながります。',
    サブエージェント活用:
      'サブエージェント(Task)を活用しましょう。並列調査や独立したサブタスクの実行に効果的です。',
    'CLAUDE.md整備':
      'プロジェクトのルートにCLAUDE.mdを作成しましょう。プロジェクトの構造や規約を記述すると、Claudeがより的確に動きます。',
    指示の具体性:
      '指示をより具体的にしましょう。変更したいファイル名、期待する動作、受け入れ基準を明記すると、Claudeがより的確に動きます。',
    コンテキスト提供度:
      '指示に対象ファイルのパスを含めましょう。ファイルパスを明示することで、Claudeが正確にコードを特定できます。',
    初期指示の的確さ:
      '最初の指示で要件を明確に伝えましょう。背景・目的・制約を含めると、手戻りなく作業が進みます。',
    軌道修正の少なさ:
      '指示を出す前に要件を整理しましょう。「何を」「なぜ」「どの範囲で」を事前に明確にすると、軌道修正が減ります。',
    トークン効率:
      'トークン消費に対して実装量を増やしましょう。調査フェーズを効率化し、実装・検証に注力することが重要です。',
    フェーズバランス:
      '調査と実装のバランスを見直しましょう。調査で得た知見を素早く実装に移すことで、作業密度が向上します。',
    手戻りの少なさ:
      '同一ファイルの繰り返し編集を減らしましょう。編集前に設計を固め、一度で正確に変更することを心がけましょう。',
  };

  return lowScoreDetails.slice(0, 5).map((d) => recommendationMap[d.category] || d.finding);
}

// ---------- Public API ----------

export function getInsights(days?: number): InsightsResult {
  const claudePath = getClaudePath();
  const projects = getProjects();

  const now = new Date();
  let periodStart: Date | null = null;
  if (days !== undefined) {
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);
    periodStart.setHours(0, 0, 0, 0);
  }

  const analyses: SessionAnalysis[] = [];
  let earliestTimestamp: string | null = null;
  let latestTimestamp: string | null = null;

  for (const projectName of projects) {
    const projectPath = path.join(claudePath, projectName);
    if (!fs.existsSync(projectPath)) continue;

    let files: string[];
    try {
      files = fs
        .readdirSync(projectPath)
        .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(projectPath, file);
      const analysis = analyzeSessionFile(filePath);
      if (!analysis || !analysis.timestamp) continue;

      // Date filter
      if (periodStart) {
        const sessionDate = new Date(analysis.timestamp);
        if (sessionDate < periodStart) continue;
      }

      analyses.push(analysis);

      if (!earliestTimestamp || analysis.timestamp < earliestTimestamp) {
        earliestTimestamp = analysis.timestamp;
      }
      if (!latestTimestamp || analysis.timestamp > latestTimestamp) {
        latestTimestamp = analysis.timestamp;
      }
    }
  }

  // If no sessions, return zero-state
  if (analyses.length === 0) {
    return {
      overallScore: 0,
      bestPractice: { score: 0, details: [] },
      instructionQuality: { score: 0, details: [] },
      workDensity: { score: 0, details: [] },
      recommendations: [
        'セッションデータがありません。Claude Codeを使い始めると分析結果が表示されます。',
      ],
      analyzedSessions: 0,
      analyzedPeriod: { from: '', to: '' },
    };
  }

  const bestPractice = scoreBestPractice(analyses);
  const instructionQuality = scoreInstructionQuality(analyses);
  const workDensity = scoreWorkDensity(analyses);

  const overallScore = Math.round(
    bestPractice.score * 0.3 + instructionQuality.score * 0.4 + workDensity.score * 0.3
  );

  const recommendations = generateRecommendations(bestPractice, instructionQuality, workDensity);

  return {
    overallScore,
    bestPractice,
    instructionQuality,
    workDensity,
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ['素晴らしい活用力です！現在の使い方を維持しましょう。'],
    analyzedSessions: analyses.length,
    analyzedPeriod: {
      from: earliestTimestamp || '',
      to: latestTimestamp || '',
    },
  };
}
