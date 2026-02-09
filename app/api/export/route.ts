import { NextRequest, NextResponse } from 'next/server';
import { exportSession, getExportFilename, getExportContentType } from '@/lib/export';
import { getSession } from '@/lib/parser';
import type { ExportFormat, ExportOptions } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_FORMATS: ExportFormat[] = ['markdown', 'json', 'html'];

function isValidPathSegment(segment: string): boolean {
  // Reject empty, path traversal, and special characters
  if (!segment || segment.length === 0 || segment.length > 256) return false;
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) return false;
  if (segment.includes('\0')) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(segment);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const project = searchParams.get('project');
    const session = searchParams.get('session');
    const format = searchParams.get('format') as ExportFormat | null;
    const includeToolCalls = searchParams.get('includeToolCalls') === 'true';
    const includeTokenStats = searchParams.get('includeTokenStats') === 'true';

    // Validate required parameters
    if (!project || !session) {
      return NextResponse.json(
        { error: 'Missing required parameters: project and session' },
        { status: 400 }
      );
    }

    // Validate path segments
    if (!isValidPathSegment(project) || !isValidPathSegment(session)) {
      return NextResponse.json({ error: 'Invalid project or session identifier' }, { status: 400 });
    }

    // Validate format
    if (!format || !VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check session exists
    const sessionData = getSession(project, session);
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const options: ExportOptions = {
      format,
      includeToolCalls,
      includeTokenStats,
    };

    const content = exportSession(project, session, options);
    const filename = getExportFilename(sessionData, format);
    const contentType = getExportContentType(format);

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
