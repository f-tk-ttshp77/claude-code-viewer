import { NextRequest, NextResponse } from 'next/server';
import { searchSessions } from '@/lib/search';
import type { SearchQuery } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const queryText = searchParams.get('q');

    if (!queryText || !queryText.trim()) {
      return NextResponse.json(
        { results: [], error: 'Missing query parameter "q"' },
        { status: 400 }
      );
    }

    const query: SearchQuery = {
      query: queryText.trim(),
      projectFilter: searchParams.get('project') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      toolFilter: searchParams.get('tool') || undefined,
    };

    const results = searchSessions(query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
