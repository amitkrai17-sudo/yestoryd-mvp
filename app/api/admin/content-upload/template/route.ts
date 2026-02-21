// ============================================================
// FILE: app/api/admin/content-upload/template/route.ts
// PURPOSE: Download CSV template for bulk content upload
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const TEMPLATE_HEADERS = [
  'title',
  'content_type',
  'description',
  'asset_url',
  'yrl_level',
  'arc_stage',
  'difficulty_level',
  'skill_tags',
  'sub_skill_tags',
  'coach_guidance',
  'parent_instruction',
  'child_label',
  'duration_seconds',
  'asset_format',
];

const EXAMPLE_ROWS = [
  [
    'Phonics: CVC Words',
    'video',
    'Introduction to consonant-vowel-consonant words',
    'youtube:dQw4w9WgXcQ',
    'F1',
    'remediate',
    'beginner',
    'Phonics|Phonemic Awareness',
    'CVC blending|Sound segmentation',
    'Start with 3-letter words. Watch for vowel confusion.',
    'Practice sounding out simple words at home',
    'CVC Word Fun',
    '180',
    '',
  ],
  [
    'Sight Words Worksheet Set 1',
    'worksheet',
    'Trace and write high-frequency sight words',
    'storage:worksheets/sight-words-set1.pdf',
    'F2',
    'remediate',
    'beginner',
    'Phonics',
    'Sight words',
    'Use as warm-up activity. 5 minutes max.',
    'Help your child trace each word 3 times',
    'Sight Words Practice',
    '',
    'pdf',
  ],
  [
    'Rhyming Word Match',
    'game',
    'Interactive game matching rhyming word pairs',
    'engine:rhyme-match',
    'F1',
    'celebrate',
    'beginner',
    'Phonemic Awareness',
    'Rhyming',
    'Great for session wrap-up. Builds phonological awareness.',
    'Play the rhyming game together for 10 minutes',
    'Rhyme Time!',
    '',
    '',
  ],
  [
    'Story Comprehension: The Giving Tree',
    'video',
    'Read-aloud with comprehension check questions',
    'youtube:abc123xyz',
    'B2',
    'assess',
    'intermediate',
    'Comprehension|Vocabulary',
    'Inference|Context clues',
    'Pause at key moments. Ask prediction questions.',
    'Discuss the story and what it means to give',
    'Story Time',
    '420',
    '',
  ],
  [
    'Grammar Guide: Nouns & Verbs',
    'parent_guide',
    'Parent reference for supporting grammar at home',
    'storage:guides/grammar-nouns-verbs.pdf',
    'B1',
    'remediate',
    'intermediate',
    'Grammar',
    'Parts of speech',
    'Share with parent after session 3',
    'Use this guide to practice identifying nouns and verbs in everyday reading',
    'Grammar Helper',
    '',
    'pdf',
  ],
];

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const csvRows = [
      TEMPLATE_HEADERS.join(','),
      ...EXAMPLE_ROWS.map(row =>
        row.map(cell => {
          // Escape cells that contain commas, quotes, or pipes
          if (cell.includes(',') || cell.includes('"') || cell.includes('|') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      ),
    ];

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="content-upload-template.csv"',
      },
    });
  } catch (error: any) {
    console.error('Template download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
