-- =============================================================================
-- YESTORYD SITE SETTINGS MIGRATION
-- Enterprise Data Architecture: Homepage Single Source of Truth
-- Generated: 2026-01-25
-- =============================================================================

-- Note: Run this in Supabase SQL Editor
-- Each INSERT uses ON CONFLICT DO NOTHING to avoid duplicates

-- =============================================================================
-- HERO SECTION - A/B TESTED VARIANTS
-- =============================================================================

-- Curiosity Variant
INSERT INTO site_settings (key, value, category, description) VALUES
('hero_badge_curiosity', 'rAI-Powered Reading Analysis', 'hero', 'Hero badge text for curiosity A/B variant')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_headline_curiosity', 'There''s a Reason Your Child Avoids Reading', 'hero', 'Hero headline for curiosity A/B variant')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_explanation_curiosity', 'It''s usually a small gap in how they process sounds — something schools rarely identify. Our rAI finds it in 5 minutes. Free.', 'hero', 'Hero explanation for curiosity variant')
ON CONFLICT (key) DO NOTHING;

-- Validation Variant
INSERT INTO site_settings (key, value, category, description) VALUES
('hero_badge_validation', 'For Ages 4-12 • AI + Expert Coaches', 'hero', 'Hero badge text for validation A/B variant')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_headline_validation', 'You''ve Noticed Something Isn''t Clicking With Your Child''s Reading', 'hero', 'Hero headline for validation A/B variant')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_explanation_validation', 'It''s usually a small gap that schools don''t catch — but rAI does. In 5 minutes. Free.', 'hero', 'Hero explanation for validation variant')
ON CONFLICT (key) DO NOTHING;

-- Common Hero Elements
INSERT INTO site_settings (key, value, category, description) VALUES
('hero_reframe_text', 'It''s not laziness. It''s not attitude.', 'hero', 'Hero subheadline reframe text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_cta_primary', 'Reading Test - Free', 'hero', 'Primary CTA button text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_cta_secondary', 'Watch Our Story', 'hero', 'Secondary CTA button text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_trust_badge_1', '100% Free', 'hero', 'First trust badge text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_trust_badge_2', '5 Minutes', 'hero', 'Second trust badge text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_trust_badge_3', 'Instant Results', 'hero', 'Third trust badge text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_stat_percentage', '87%', 'hero', 'Hero statistic percentage')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_stat_text', 'of parents finally understood WHY their child struggled', 'hero', 'Hero statistic description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('hero_urgency_text', 'Reading gaps widen every month. Early identification matters.', 'hero', 'Hero urgency message')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- TRANSFORMATION VISUAL
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('transformation_header', 'The 90-Day Transformation', 'transformation', 'Transformation section header')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('transformation_before_items', '["\"I hate reading\"", "Avoids books", "Reads slowly", "Losing confidence"]', 'transformation', 'Before items (JSON array)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('transformation_after_items', '["\"Can I read more?\"", "Picks up books", "Reads fluently", "Speaks confidently"]', 'transformation', 'After items (JSON array)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('transformation_tagline', 'rAI finds the gaps • Coach fills them • You see progress', 'transformation', 'Transformation section tagline')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- TOP BAR / HEADER
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('topbar_text_desktop', 'Jolly Phonics Certified • 7 Years Experience', 'header', 'Top bar text for desktop')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('topbar_text_mobile', 'Certified Phonics Expert', 'header', 'Top bar text for mobile')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('nav_item_1', 'The ARC Method', 'header', 'Navigation item 1')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('nav_item_2', 'Our Story', 'header', 'Navigation item 2')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('nav_item_3', 'Pricing', 'header', 'Navigation item 3')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('nav_login_text', 'Login', 'header', 'Login button text')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- PROBLEM AWARENESS SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_section_title', 'What Schools Don''t Tell You', 'problem', 'Problem section main title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_section_subtitle', 'About why your child struggles with reading', 'problem', 'Problem section subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_insight_title', 'Reading is a Skill — Like Swimming', 'problem', 'Core insight card title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_insight_description', 'Schools teach children WHAT to read, but rarely HOW to read. The science of reading — how sounds form words, how words form meaning — is often skipped.', 'problem', 'Core insight description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_aser_stat', '50%', 'problem', 'ASER statistic percentage')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_aser_description', 'of Grade 5 students in India cannot read a Grade 2 level text', 'problem', 'ASER statistic description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_aser_source', '— ASER 2023 Report', 'problem', 'ASER source citation')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_signs', '["Reads slowly, word by word", "Guesses words instead of reading them", "Understands when YOU read, struggles when THEY read", "Avoids reading aloud", "Says \"I hate reading\""]', 'problem', 'Signs list (JSON array)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_symptoms_text', 'These are symptoms. The cause is usually a gap in phonemic awareness.', 'problem', 'Symptoms explanation')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('problem_good_news', 'Good news: Once identified, these gaps can be filled in weeks, not years.', 'problem', 'Good news message')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- ARC METHOD SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_section_badge', 'THE YESTORYD ARC™', 'arc', 'ARC section badge text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_section_title', 'Your Child''s 90-Day Transformation', 'arc', 'ARC section main title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_section_subtitle', 'A clear path from struggling reader to confident communicator', 'arc', 'ARC section subtitle')
ON CONFLICT (key) DO NOTHING;

-- Assess Phase
INSERT INTO site_settings (key, value, category, description) VALUES
('arc_assess_weeks', 'Week 1-4', 'arc', 'Assess phase week range')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_assess_title', 'Assess', 'arc', 'Assess phase title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_assess_subtitle', 'Foundation Arc', 'arc', 'Assess phase subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_assess_description', 'AI listens to your child read and identifies exact gaps in 40+ sound patterns.', 'arc', 'Assess phase description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_assess_features', '["5-minute AI assessment", "Detailed gap report", "Personalized learning path"]', 'arc', 'Assess phase features (JSON array)')
ON CONFLICT (key) DO NOTHING;

-- Remediate Phase
INSERT INTO site_settings (key, value, category, description) VALUES
('arc_remediate_weeks', 'Week 5-8', 'arc', 'Remediate phase week range')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_remediate_title', 'Remediate', 'arc', 'Remediate phase title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_remediate_subtitle', 'Building Arc', 'arc', 'Remediate phase subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_remediate_description', 'Expert coaches fill gaps with personalized 1:1 sessions using Jolly Phonics.', 'arc', 'Remediate phase description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_remediate_features', '["6 coaching sessions (1:1)", "Practice activities at home", "Weekly WhatsApp updates"]', 'arc', 'Remediate phase features (JSON array)')
ON CONFLICT (key) DO NOTHING;

-- Celebrate Phase
INSERT INTO site_settings (key, value, category, description) VALUES
('arc_celebrate_weeks', 'Week 9-12', 'arc', 'Celebrate phase week range')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_celebrate_title', 'Celebrate', 'arc', 'Celebrate phase title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_celebrate_subtitle', 'Confidence Arc', 'arc', 'Celebrate phase subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_celebrate_description', 'Your child reads with confidence. Measurable improvement you can see.', 'arc', 'Celebrate phase description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_celebrate_features', '["Before/after comparison", "Progress certificate", "Continuation roadmap"]', 'arc', 'Celebrate phase features (JSON array)')
ON CONFLICT (key) DO NOTHING;

-- Promise Section
INSERT INTO site_settings (key, value, category, description) VALUES
('arc_promise_title', 'The 90-Day Promise', 'arc', 'Promise section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_promise_description', 'In 90 days, your child reads more fluently. This becomes the foundation for grammar, comprehension, writing, and confident English communication.', 'arc', 'Promise section description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_promise_badge_1', 'Measurable Growth', 'arc', 'Promise badge 1')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_promise_badge_2', '100% Refund Guarantee', 'arc', 'Promise badge 2')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_promise_badge_3', 'Full Transparency', 'arc', 'Promise badge 3')
ON CONFLICT (key) DO NOTHING;

-- Trust Indicators
INSERT INTO site_settings (key, value, category, description) VALUES
('arc_trust_assessment_time', '5 min', 'arc', 'Assessment time display')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_trust_coaching_type', '1:1', 'arc', 'Coaching type display')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('arc_trust_transformation_days', '90 days', 'arc', 'Transformation duration display')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FAQ SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('faq_section_badge', 'Common Questions', 'faq', 'FAQ section badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('faq_section_title', 'Frequently Asked Questions', 'faq', 'FAQ section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('faq_section_subtitle', 'Everything you need to know before getting started', 'faq', 'FAQ section subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('faq_still_questions', 'Still have questions?', 'faq', 'FAQ footer text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('faq_whatsapp_cta', 'Chat with us on WhatsApp', 'faq', 'WhatsApp CTA text')
ON CONFLICT (key) DO NOTHING;

-- FAQ Items (stored as JSON)
INSERT INTO site_settings (key, value, category, description) VALUES
('faq_items', '[
  {
    "question": "What device do I need for the assessment?",
    "answer": "Any smartphone, tablet, or laptop with a microphone works! The assessment runs in your browser — no app download needed. 80% of our parents use their phone."
  },
  {
    "question": "How long is each coaching session?",
    "answer": "Coaching sessions are 45 minutes each, with parent check-ins being 30 minutes. Sessions are scheduled at times convenient for you — weekdays or weekends. The Full Program includes 12 sessions over 3 months."
  },
  {
    "question": "Is this a subscription? Will I be charged monthly?",
    "answer": "No subscriptions! It''s a one-time payment. Choose from Starter Pack, Continuation, or Full Program based on your needs. No hidden fees, no recurring charges."
  },
  {
    "question": "What if my child doesn''t improve?",
    "answer": "We offer a 100% satisfaction guarantee. If you don''t see improvement after completing the program, we''ll either continue working with you at no extra cost or provide a full refund."
  },
  {
    "question": "Is the AI safe for my child?",
    "answer": "Absolutely. Unlike ChatGPT which guesses, rAI (our Reading Intelligence) only references our expert-verified knowledge base built on 7+ years of phonics expertise. It never makes things up. Your child''s data is private and secure."
  },
  {
    "question": "What age group is this for?",
    "answer": "Yestoryd is designed for children aged 4-12 years. Our AI adapts the assessment based on your child''s age, and coaches personalize sessions accordingly."
  }
]', 'faq', 'FAQ items (JSON array)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- RUCHA'S STORY SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('story_section_badge', 'THE YESTORYD STORY', 'story', 'Story section badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('story_quote', 'I realized that love for stories wasn''t enough. Kids needed the science of reading.', 'story', 'Main story quote')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('story_paragraph_1', 'Yestoryd started simply — I wanted to share the joy of storytelling with kids. But in my classes, I noticed a pattern. Kids loved the stories, but many couldn''t read them.', 'story', 'Story paragraph 1')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('story_paragraph_2', 'They struggled with sounds, blending, and word composition. I realized that reading is not natural — it''s an acquired skill.', 'story', 'Story paragraph 2')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('story_paragraph_3', 'I spent 7 years mastering Jolly Phonics and Jolly Grammar. Now, with AI technology, we can diagnose reading gaps instantly — so coaches can focus purely on the child.', 'story', 'Story paragraph 3')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('story_credential_1', 'Jolly Phonics Certified', 'story', 'First credential badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('story_credential_2', '7 Years Experience', 'story', 'Second credential badge')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- RAI TECH SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_section_badge', 'Meet rAI', 'rai', 'rAI section badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_section_title', 'Why rAI is Different (and Safer)', 'rai', 'rAI section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_section_subtitle', 'rAI = Reading Intelligence — our AI that never guesses', 'rai', 'rAI section subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_generic_ai_label', 'Generic AI', 'rai', 'Generic AI card label')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_generic_ai_name', 'ChatGPT, etc.', 'rai', 'Generic AI name')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_generic_ai_type', 'General Purpose AI', 'rai', 'Generic AI type')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_generic_ai_description', 'Guesses based on the internet. No reading expertise. No understanding of phonics rules. May give incorrect or generic advice.', 'rai', 'Generic AI description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_safe_ai_label', 'Safe, Expert-Verified AI', 'rai', 'Safe AI card label')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_safe_ai_name', 'rAI Knowledge Engine', 'rai', 'Safe AI name')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_safe_ai_type', 'Expert-Verified AI', 'rai', 'Safe AI type')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_safe_ai_description', 'Consults our Expert Knowledge Base first. Built on 7+ years of Rucha''s phonics expertise. Never guesses — always references proven methods.', 'rai', 'Safe AI description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_process_label', 'The Process', 'rai', 'Process section label')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_process_steps', '["Child Error", "Check Expert DB", "Perfect Fix ✓"]', 'rai', 'Process steps (JSON array)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_explanation_intro', 'Most AI makes things up. We couldn''t risk that with your child''s education.', 'rai', 'rAI explanation intro')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_explanation_analogy', 'Imagine rAI as a librarian with a manual written by Rucha. Built on 7+ years of phonics expertise.', 'rai', 'rAI explanation analogy')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('rai_explanation_detail', 'When your child makes a mistake, rAI doesn''t guess. It looks up the exact page in our "Expert Manual" and tells the coach precisely which Phonics rule to practice.', 'rai', 'rAI explanation detail')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- TESTIMONIALS SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('testimonials_section_badge', 'Real Results', 'testimonials', 'Testimonials section badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('testimonials_section_title', 'Parents See the Difference', 'testimonials', 'Testimonials section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('testimonials_found_issue_stat', '87%', 'testimonials', 'Found issue statistic')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('testimonials_found_issue_label', 'Found the Real Issue', 'testimonials', 'Found issue label')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('testimonials_improvement_stat', '2x', 'testimonials', 'Improvement statistic')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('testimonials_improvement_label', 'Avg. Improvement', 'testimonials', 'Improvement label')
ON CONFLICT (key) DO NOTHING;

-- Default testimonials (JSON array)
INSERT INTO site_settings (key, value, category, description) VALUES
('default_testimonials', '[
  {
    "id": "1",
    "testimonial_text": "Finally understood WHY my son struggled. The AI found gaps we never knew existed. In 3 months, his reading score went from 4/10 to 8/10.",
    "parent_name": "Priya S.",
    "parent_location": "Mumbai",
    "child_name": "Aarav",
    "child_age": 6,
    "rating": 5,
    "score_before": "4/10",
    "score_after": "8/10"
  },
  {
    "id": "2",
    "testimonial_text": "My daughter now picks up books on her own. She went from avoiding reading completely to asking \"Can I read more?\" Her fluency improved 2x.",
    "parent_name": "Rahul G.",
    "parent_location": "Delhi",
    "child_name": "Ananya",
    "child_age": 7,
    "rating": 5,
    "score_before": "—",
    "score_after": "2x fluency"
  },
  {
    "id": "3",
    "testimonial_text": "The AI assessment showed us exactly where Arjun was stuck — it was blending sounds. After 2 months, he reads sentences smoothly. Clarity score: 5→9.",
    "parent_name": "Sneha P.",
    "parent_location": "Bangalore",
    "child_name": "Arjun",
    "child_age": 5,
    "rating": 5,
    "score_before": "5",
    "score_after": "9"
  },
  {
    "id": "4",
    "testimonial_text": "Ishaan was 2 grades behind in reading. After 3 months, his teacher asked what changed. Speed improved from 15 WPM to 40 WPM. Worth every rupee.",
    "parent_name": "Meera K.",
    "parent_location": "Pune",
    "child_name": "Ishaan",
    "child_age": 8,
    "rating": 5,
    "score_before": "15 WPM",
    "score_after": "40 WPM"
  }
]', 'testimonials', 'Default testimonials (JSON array)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- JOURNEY SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('journey_section_badge', 'The Complete Journey', 'journey', 'Journey section badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('journey_section_title', 'From Reading Mastery to English Confidence', 'journey', 'Journey section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('journey_section_subtitle', 'Reading is the foundation. Everything else builds on top.', 'journey', 'Journey section subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('journey_steps', '[
  { "stage": "INTEREST", "skill": "Generate love for reading", "icon": "Heart", "color": "#00ABFF" },
  { "stage": "READ", "skill": "Phonics mastery", "icon": "BookOpen", "color": "#0090d9" },
  { "stage": "UNDERSTAND", "skill": "Grammar rules", "icon": "Brain", "color": "#9333ea" },
  { "stage": "COMPREHEND", "skill": "Reading comprehension", "icon": "Lightbulb", "color": "#FF0099" },
  { "stage": "EXPRESS", "skill": "Writing skills", "icon": "MessageCircle", "color": "#d10080" },
  { "stage": "CONFIDENCE", "skill": "English fluency", "icon": "Award", "color": "#7B008B" }
]', 'journey', 'Journey steps (JSON array)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('journey_insight_text', 'In 90 days, your child masters reading fluency.', 'journey', 'Journey key insight main text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('journey_insight_detail', 'This becomes the foundation for grammar, comprehension, writing, and eventually — confident English communication. The journey starts with the first step: understanding exactly where they are today.', 'journey', 'Journey key insight detail')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- PRICING SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_section_badge', 'Start Your ARC Journey', 'pricing', 'Pricing section badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_section_title', 'Simple, Transparent Pricing', 'pricing', 'Pricing section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_section_subtitle', 'Start free. See your child''s reading profile. Choose the program that fits your family.', 'pricing', 'Pricing section subtitle')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_free_badge', 'Step 1 — Start Here', 'pricing', 'Free assessment badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_free_title', 'Free AI Assessment', 'pricing', 'Free assessment title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_free_description', 'See rAI in action — understand your child''s reading level', 'pricing', 'Free assessment description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_free_price_label', 'forever free', 'pricing', 'Free price label')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_free_features', '[
  "rAI analyzes reading in real-time",
  "Clarity, Fluency & Speed scores",
  "Personalized improvement tips",
  { "text": "Detailed Diagnosis Report", "highlight": "(Worth ₹999)" },
  "Instant shareable certificate",
  "No credit card required"
]', 'pricing', 'Free assessment features (JSON array)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_step2_badge', 'Step 2 — Choose Your Program', 'pricing', 'Step 2 badge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('pricing_guarantee_text', '100% satisfaction guarantee on all programs. Flexible scheduling included.', 'pricing', 'Guarantee text')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FINAL CTA SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('final_cta_title_line1', 'Reading Gaps Widen Every Month.', 'cta', 'Final CTA title line 1')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('final_cta_title_line2', 'Find Yours in 5 Minutes.', 'cta', 'Final CTA title line 2')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('final_cta_description', '87% of parents finally understood WHY their child struggled — after just one 5-minute assessment.', 'cta', 'Final CTA description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('final_cta_subdescription', 'Free. No card required. Instant results.', 'cta', 'Final CTA sub-description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('final_cta_urgency', 'Early identification leads to faster improvement. Don''t wait for report cards.', 'cta', 'Final CTA urgency note')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('whatsapp_button_text', 'WhatsApp Us', 'cta', 'WhatsApp button text')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FOOTER SECTION
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('footer_description', 'AI-powered reading assessment and expert coaching for children aged 4-12. The Yestoryd ARC™ — Assess, Remediate, Celebrate.', 'footer', 'Footer company description')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('footer_credential', 'Jolly Phonics & Grammar Certified', 'footer', 'Footer credential')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('footer_quick_links_title', 'Quick Links', 'footer', 'Quick links section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('footer_access_title', 'Access', 'footer', 'Access section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('footer_legal_title', 'Legal', 'footer', 'Legal section title')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('footer_tagline', 'Made with love for young readers in India', 'footer', 'Footer tagline')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FLOATING ELEMENTS
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('floating_whatsapp_hover', 'Chat with Us', 'floating', 'WhatsApp floating button hover text')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('sticky_mobile_cta', 'Reading Test - Free', 'floating', 'Sticky mobile CTA text')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- TRIANGULATION NODES (rAI, Coach, Parent)
-- =============================================================================

INSERT INTO site_settings (key, value, category, description) VALUES
('triangulation_rai', '{
  "id": "rai",
  "title": "rAI",
  "subtitle": "The Brain",
  "color": "#00ABFF",
  "description": "Our AI engine that powers personalized learning",
  "features": [
    "Analyzes reading in real-time",
    "Identifies exact gaps & struggles",
    "Builds personalized curriculum",
    "Tracks progress every session"
  ]
}', 'triangulation', 'rAI node configuration')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('triangulation_coach', '{
  "id": "coach",
  "title": "Coach",
  "subtitle": "The Heart",
  "color": "#FF0099",
  "description": "Certified experts who deliver with warmth",
  "features": [
    "1-on-1 personalized sessions",
    "Jolly Phonics certified",
    "Patient, encouraging, warm",
    "Celebrates every small win"
  ]
}', 'triangulation', 'Coach node configuration')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value, category, description) VALUES
('triangulation_parent', '{
  "id": "parent",
  "title": "Parent",
  "subtitle": "The Eyes",
  "color": "#7B008B",
  "description": "Full transparency — you see everything",
  "features": [
    "Progress reports after every session",
    "Real-time updates on WhatsApp",
    "Visual dashboard of improvement",
    "Direct chat with coach"
  ]
}', 'triangulation', 'Parent node configuration')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERY
-- Run this after migration to verify all settings were inserted
-- =============================================================================
-- SELECT category, COUNT(*) as count
-- FROM site_settings
-- GROUP BY category
-- ORDER BY count DESC;
