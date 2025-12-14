import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all testimonials
export async function GET() {
  try {
    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ testimonials });
  } catch (error: any) {
    console.error('Failed to fetch testimonials:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new testimonial
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('testimonials')
      .insert({
        parent_name: body.parent_name,
        parent_location: body.parent_location,
        child_name: body.child_name,
        child_age: body.child_age,
        testimonial_text: body.testimonial_text,
        rating: body.rating || 5,
        image_url: body.image_url || null,
        is_featured: body.is_featured || false,
        is_active: body.is_active ?? true,
        display_order: body.display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ testimonial: data });
  } catch (error: any) {
    console.error('Failed to create testimonial:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a testimonial
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Testimonial ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('testimonials')
      .update({
        parent_name: body.parent_name,
        parent_location: body.parent_location,
        child_name: body.child_name,
        child_age: body.child_age,
        testimonial_text: body.testimonial_text,
        rating: body.rating,
        image_url: body.image_url,
        is_featured: body.is_featured,
        is_active: body.is_active,
        display_order: body.display_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ testimonial: data });
  } catch (error: any) {
    console.error('Failed to update testimonial:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a testimonial
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Testimonial ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete testimonial:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
