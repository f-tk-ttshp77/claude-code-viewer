import './globals.css';
import { GlobalNav } from '@/components/GlobalNav';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata = {
  title: 'Claude Code Viewer',
  description: 'View Claude Code conversation history',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ThemeProvider>
          <GlobalNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
