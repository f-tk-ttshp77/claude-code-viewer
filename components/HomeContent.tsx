'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Session, SessionTokenStats } from '@/lib/types';
import { formatTokenCount, formatDate } from '@/lib/format';

interface ProjectData {
  projectKey: string;
  projectName: string;
  sessions: Session[];
}

interface Props {
  projects: ProjectData[];
  tokenStatsMap: Record<string, SessionTokenStats>;
}

export function HomeContent({ projects, tokenStatsMap }: Props) {
  // Default: open the most recently active project (first one, since projects are sorted by recency)
  const [openProjects, setOpenProjects] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (projects.length > 0) {
      initial.add(projects[0].projectKey);
    }
    return initial;
  });

  const toggle = (projectKey: string) => {
    setOpenProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectKey)) {
        next.delete(projectKey);
      } else {
        next.add(projectKey);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenProjects(new Set(projects.map((p) => p.projectKey)));
  };

  const collapseAll = () => {
    setOpenProjects(new Set());
  };

  const allExpanded = projects.length > 0 && openProjects.size === projects.length;
  const allCollapsed = openProjects.size === 0;

  // Pre-compute project stats
  const projectStats = useMemo(() => {
    const stats: Record<string, { sessionCount: number; totalTokens: number }> = {};
    for (const project of projects) {
      let totalTokens = 0;
      for (const session of project.sessions) {
        const tokenStat = tokenStatsMap[session.id];
        if (tokenStat) {
          totalTokens += tokenStat.usage.inputTokens + tokenStat.usage.outputTokens;
        }
      }
      stats[project.projectKey] = {
        sessionCount: project.sessions.length,
        totalTokens,
      };
    }
    return stats;
  }, [projects, tokenStatsMap]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={expandAll}
          disabled={allExpanded}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          すべて展開
        </button>
        <button
          onClick={collapseAll}
          disabled={allCollapsed}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          すべて折りたたむ
        </button>
      </div>

      <div className="space-y-3">
        {projects.map((project) => {
          const isOpen = openProjects.has(project.projectKey);
          const stats = projectStats[project.projectKey];

          return (
            <div
              key={project.projectKey}
              className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800"
            >
              <button
                onClick={() => toggle(project.projectKey)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${isOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    {project.projectName}
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{stats.sessionCount} セッション</span>
                  {stats.totalTokens > 0 && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {formatTokenCount(stats.totalTokens)} tokens
                    </span>
                  )}
                </div>
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2 px-6 pb-4">
                    {project.sessions.map((session) => {
                      const tokenStat = tokenStatsMap[session.id];
                      const totalTokens = tokenStat
                        ? tokenStat.usage.inputTokens + tokenStat.usage.outputTokens
                        : 0;

                      return (
                        <Link
                          key={session.id}
                          href={`/session/${project.projectKey}/${session.id}`}
                          className="block rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 sm:p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-gray-900 dark:text-gray-100">
                                {session.summary || 'No summary'}
                              </div>
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(session.lastMessageTime)}
                              </div>
                            </div>
                            {tokenStat && totalTokens > 0 && (
                              <div className="flex-shrink-0 text-right">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {formatTokenCount(totalTokens)}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  tokens
                                </div>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
