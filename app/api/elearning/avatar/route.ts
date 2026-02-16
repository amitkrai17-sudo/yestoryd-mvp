// app/api/elearning/avatar/route.ts
// API for managing child's avatar

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Avatar options
const AVATAR_TYPES = [
  { id: 'fox', name: 'Fox', emoji: '🦊', description: 'Clever and curious' },
  { id: 'bunny', name: 'Bunny', emoji: '🐰', description: 'Quick and friendly' },
  { id: 'bear', name: 'Bear', emoji: '🐻', description: 'Strong and brave' },
  { id: 'lion', name: 'Lion', emoji: '🦁', description: 'Bold and proud' },
  { id: 'cat', name: 'Cat', emoji: '🐱', description: 'Smart and playful' },
  { id: 'owl', name: 'Owl', emoji: '🦉', description: 'Wise and thoughtful' },
  { id: 'panda', name: 'Panda', emoji: '🐼', description: 'Gentle and kind' },
  { id: 'butterfly', name: 'Butterfly', emoji: '🦋', description: 'Free and beautiful' },
];

const AVATAR_COLORS = [
  { id: 'red', name: 'Red', hex: '#EF4444' },
  { id: 'orange', name: 'Orange', hex: '#F97316' },
  { id: 'yellow', name: 'Yellow', hex: '#EAB308' },
  { id: 'green', name: 'Green', hex: '#22C55E' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6' },
  { id: 'purple', name: 'Purple', hex: '#A855F7' },
  { id: 'pink', name: 'Pink', hex: '#EC4899' },
];

// GET - Get avatar options and current avatar
export async function GET(request: NextRequest) {
  try {
    // supabase already initialized above
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Get current avatar if exists
    const { data: avatar } = await supabase
      .from('el_child_avatars')
      .select('*')
      .eq('child_id', childId)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        currentAvatar: avatar,
        avatarTypes: AVATAR_TYPES,
        avatarColors: AVATAR_COLORS
      }
    });

  } catch (error) {
    console.error('Avatar fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update avatar
export async function POST(request: NextRequest) {
  try {
    // supabase already initialized above
    const body = await request.json();

    const { childId, avatarType, avatarColor, avatarName } = body;

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    if (!avatarType) {
      return NextResponse.json({ error: 'avatarType is required' }, { status: 400 });
    }

    // Validate avatar type
    if (!AVATAR_TYPES.find(a => a.id === avatarType)) {
      return NextResponse.json({ error: 'Invalid avatar type' }, { status: 400 });
    }

    // Validate color if provided
    if (avatarColor && !AVATAR_COLORS.find(c => c.id === avatarColor)) {
      return NextResponse.json({ error: 'Invalid avatar color' }, { status: 400 });
    }

    // Check if avatar already exists
    const { data: existing } = await supabase
      .from('el_child_avatars')
      .select('id')
      .eq('child_id', childId)
      .single();

    let avatar;

    if (existing) {
      // Update existing avatar
      const { data, error } = await supabase
        .from('el_child_avatars')
        .update({
          avatar_type: avatarType,
          avatar_color: avatarColor || 'orange',
          avatar_name: avatarName || null,
          updated_at: new Date().toISOString()
        })
        .eq('child_id', childId)
        .select()
        .single();

      if (error) throw error;
      avatar = data;
    } else {
      // Create new avatar
      const { data, error } = await supabase
        .from('el_child_avatars')
        .insert({
          child_id: childId,
          avatar_type: avatarType,
          avatar_color: avatarColor || 'orange',
          avatar_name: avatarName || null
        })
        .select()
        .single();

      if (error) throw error;
      avatar = data;

      // Award XP for creating avatar (first time bonus)
      const { data: gamification } = await supabase
        .from('el_child_gamification')
        .select('total_xp, total_coins')
        .eq('child_id', childId)
        .single();

      if (gamification) {
        await supabase
          .from('el_child_gamification')
          .update({
            total_xp: gamification.total_xp + 25,
            total_coins: gamification.total_coins + 10
          })
          .eq('child_id', childId);
      }
    }

    // Get avatar type info
    const avatarInfo = AVATAR_TYPES.find(a => a.id === avatar.avatar_type);

    return NextResponse.json({
      success: true,
      data: {
        avatar: {
          ...avatar,
          emoji: avatarInfo?.emoji,
          description: avatarInfo?.description
        },
        isNew: !existing,
        bonusAwarded: !existing ? { xp: 25, coins: 10 } : null
      }
    });

  } catch (error) {
    console.error('Avatar save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

