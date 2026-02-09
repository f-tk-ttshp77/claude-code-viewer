import './globals.css';

export const metadata = {
  title: 'Claude Code Viewer',
  description: 'View Claude Code conversation history',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
