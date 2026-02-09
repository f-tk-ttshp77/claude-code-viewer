import { getProjects, getSessions } from '@/lib/parser';
import { Breadcrumb } from '@/components/Breadcrumb';
import { SearchPage } from '@/components/SearchPage';

export default function SearchPageRoute() {
  // Provide project list for the filter dropdown
  const projectKeys = getProjects();
  const projects = projectKeys
    .map((key) => {
      const sessions = getSessions(key);
      return {
        key,
        name: sessions[0]?.projectName || key,
      };
    })
    .filter((p) => p.name);

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-6">
        <Breadcrumb />
        <h1 className="mt-2 text-2xl font-bold dark:text-gray-100">Search</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          全セッションのメッセージを横断検索
        </p>
      </div>

      <SearchPage projects={projects} />
    </main>
  );
}
