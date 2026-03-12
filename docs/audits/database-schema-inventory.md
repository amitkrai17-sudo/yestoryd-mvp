TOTAL TABLES: 196

## ab_test_events (9 columns)
  created_at: string
  device_type: string | null
  event_type: string
  id: string
  referrer: string | null
  session_id: string | null
  test_name: string
  variant: string
  visitor_id: string | null

## achievement_badges (9 columns)
  badge_code: string
  badge_description: string | null
  badge_icon: string | null
  badge_name: string
  category: string
  created_at: string | null
  criteria: Json
  id: string
  is_active: boolean | null

## activate_agreement_version (0 columns)

## activity_log (7 columns)
  action: string
  created_at: string | null
  id: string
  metadata: Json | null
  page_path: string | null
  user_email: string
  user_type: string

## add_xp (0 columns)

## admin_audit_log (12 columns)
  action_category: string | null
  action_type: string
  admin_email: string | null
  admin_id: string
  created_at: string | null
  details: Json | null
  id: string
  ip_address: string | null
  target_id: string
  target_name: string | null
  target_type: string
  user_agent: string | null

## admin_insights (5 columns)
  computed_at: string | null
  id: string
  insight_data: Json
  insight_type: string
  valid_until: string | null

## agreement_config (6 columns)
  category: string | null
  description: string | null
  id: string
  key: string
  updated_at: string | null
  value: string

## agreement_signing_log (10 columns)
  agreement_version: string
  coach_id: string
  config_snapshot: Json | null
  created_at: string | null
  id: string
  ip_address: string | null
  pdf_url: string | null
  signature_url: string | null
  signed_at: string | null
  user_agent: string | null

## agreement_versions (15 columns)
  activated_at: string | null
  created_at: string | null
  deactivated_at: string | null
  description: string | null
  entity_type: string | null
  file_name: string
  file_size_bytes: number | null
  file_url: string
  id: string
  is_active: boolean | null
  title: string
  total_signatures: number | null
  uploaded_by: string | null
  uploaded_by_email: string | null
  version: string

## award_referral_credit (0 columns)

## award_xp (0 columns)

## book_collection_items (5 columns)
  added_at: string | null
  book_id: string
  collection_id: string
  display_order: number | null
  id: string

## book_collections (14 columns)
  age_max: number | null
  age_min: number | null
  color_hex: string | null
  cover_image_url: string | null
  created_at: string | null
  description: string | null
  display_order: number | null
  icon_emoji: string | null
  id: string
  is_active: boolean | null
  is_featured: boolean | null
  name: string
  slug: string
  updated_at: string | null

## book_popularity (11 columns)
  age_max: number | null
  age_min: number | null
  author: string | null
  average_rating: number | null
  cover_image_url: string | null
  id: string | null
  popularity_score: number | null
  reading_level: string | null
  times_read_in_sessions: number | null
  title: string | null
  total_requests: number | null

## book_reads (15 columns)
  book_id: string
  child_enjoyed: boolean | null
  child_feedback: string | null
  child_ids: string[]
  coaching_session_id: string | null
  comprehension_rating: number | null
  created_at: string | null
  duration_minutes: number | null
  engagement_rating: number | null
  group_session_id: string | null
  id: string
  notes: string | null
  read_at: string | null
  read_by_coach_id: string | null
  reading_type: string | null

## book_requests (16 columns)
  book_id: string
  child_id: string
  created_at: string | null
  id: string
  parent_id: string | null
  priority: number | null
  read_at: string | null
  read_in_group_session_id: string | null
  read_in_session_id: string | null
  request_notes: string | null
  request_type: string
  scheduled_at: string | null
  scheduled_for_group_session_id: string | null
  scheduled_for_session_id: string | null
  status: string | null
  updated_at: string | null

## bookings (19 columns)
  amount: number | null
  cal_booking_id: string | null
  child_id: string | null
  coach_id: string | null
  created_at: string | null
  end_time: string | null
  event_type: string | null
  id: string
  meeting_url: string | null
  metadata: Json | null
  notes: string | null
  paid_at: string | null
  parent_id: string | null
  payment_id: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  start_time: string | null
  status: string | null
  updated_at: string | null

## books (40 columns)
  added_at: string | null
  age_max: number | null
  age_min: number | null
  author: string | null
  available_languages: string[] | null
  average_rating: number | null
  cover_image_url: string | null
  description: string | null
  difficulty_score: number | null
  estimated_session_duration: number | null
  genres: string[] | null
  id: string
  illustrator: string | null
  is_active: boolean | null
  is_available_for_coaching: boolean | null
  is_available_for_kahani_times: boolean | null
  is_featured: boolean | null
  isbn: string | null
  language: string | null
  license_type: string | null
  meta_description: string | null
  page_count: number | null
  preview_url: string | null
  published_date: string | null
  publisher: string | null
  rating_count: number | null
  reading_level: string | null
  reading_time_minutes: number | null
  skills_targeted: string[] | null
  slug: string | null
  source: string | null
  source_url: string | null
  subtitle: string | null
  summary: string | null
  themes: string[] | null
  thumbnail_url: string | null
  times_read_in_sessions: number | null
  title: string
  total_requests: number | null
  updated_at: string | null

## calculate_coach_match_score (0 columns)

## calculate_discount (0 columns)

## calculate_group_class_price (0 columns)

## calculate_next_review (0 columns)

## check_completion_eligibility (0 columns)

## child_badges (6 columns)
  awarded_by: string | null
  badge_id: string
  child_id: string
  context: string | null
  earned_at: string | null
  id: string

## child_daily_goals (13 columns)
  achieved_at: string | null
  child_id: string
  completed_activities: number | null
  completed_minutes: number | null
  created_at: string | null
  goal_date: string
  id: string
  is_achieved: boolean | null
  target_activities: number | null
  target_minutes: number | null
  treasure_claimed: boolean | null
  updated_at: string | null
  xp_bonus: number | null

## child_game_progress (15 columns)
  child_id: string
  content_pool_id: string | null
  correct_items: number | null
  game_engine_slug: string
  id: string
  is_perfect: boolean | null
  max_score: number
  mistakes: Json | null
  percentage: number | null
  played_at: string | null
  score: number
  time_taken_seconds: number | null
  total_items: number | null
  unit_id: string | null
  xp_earned: number | null

## child_gamification (19 columns)
  child_id: string | null
  created_at: string | null
  current_level: number | null
  current_level_id: string | null
  current_module_id: string | null
  current_streak_days: number | null
  id: string
  last_activity_date: string | null
  longest_streak_days: number | null
  perfect_quiz_count: number | null
  total_games_completed: number | null
  total_perfect_scores: number | null
  total_quizzes_completed: number | null
  total_readings_completed: number | null
  total_time_minutes: number | null
  total_units_completed: number | null
  total_videos_completed: number | null
  total_xp: number | null
  updated_at: string | null

## child_rag_profiles (21 columns)
  ai_recommendations: Json | null
  ai_summary: string | null
  areas_of_improvement: string[] | null
  assessment_data: Json | null
  book_preferences: Json | null
  child_id: string
  clarity_score: number | null
  coaching_history: Json | null
  created_at: string | null
  engagement_patterns: Json | null
  fluency_score: number | null
  group_class_history: Json | null
  id: string
  is_active: boolean | null
  last_updated_at: string | null
  preferred_genres: string[] | null
  preferred_themes: string[] | null
  profile_embedding: string | null
  reading_level: string | null
  speed_score: number | null
  strengths: string[] | null

## child_skill_progress (9 columns)
  child_id: string
  created_at: string | null
  current_level: number | null
  id: string
  last_assessed_at: string | null
  notes: string | null
  sessions_worked_on: number | null
  skill_code: string
  updated_at: string | null

## child_unit_progress (19 columns)
  attempts: number | null
  best_score: number | null
  child_id: string
  completed_at: string | null
  completion_percentage: number | null
  created_at: string | null
  current_step: number | null
  ease_factor: number | null
  id: string
  interval_days: number | null
  last_activity_at: string | null
  next_review_at: string | null
  review_count: number | null
  started_at: string | null
  status: string | null
  step_progress: Json | null
  total_xp_earned: number | null
  unit_id: string
  updated_at: string | null

## child_video_progress (18 columns)
  best_quiz_score: number | null
  child_id: string | null
  completed_at: string | null
  completion_percentage: number | null
  first_watched_at: string | null
  id: string
  is_completed: boolean | null
  last_position_seconds: number | null
  last_watched_at: string | null
  quiz_attempted: boolean | null
  quiz_attempts: number | null
  quiz_completed_at: string | null
  quiz_passed: boolean | null
  quiz_score: number | null
  video_id: string | null
  watch_count: number | null
  watch_time_seconds: number | null
  xp_earned: number | null

## children (88 columns)
  age: number | null
  alumni_expires_at: string | null
  alumni_since: string | null
  assessment_completed_at: string | null
  assessment_wpm: number | null
  assigned_coach_id: string | null
  assigned_to: string | null
  attendance_rate: number | null
  avatar_url: string | null
  best_time_of_day: string | null
  board: string | null
  certificate_email_sent_at: string | null
  challenges: string[] | null
  child_name: string | null
  coach_id: string | null
  coupon_code_used: string | null
  created_at: string | null
  current_confidence_level: number | null
  current_reading_level: number | null
  custom_coach_split: number | null
  custom_yestoryd_split: number | null
  data_archived_at: string | null
  devices_available: string[] | null
  discovery_call_id: string | null
  dob: string | null
  enrolled_at: string | null
  enrollment_status: string | null
  favorite_topics: string[] | null
  goals_capture_method: string | null
  goals_captured_at: string | null
  goals_message_sent: boolean | null
  goals_message_sent_at: string | null
  grade: string | null
  homework_completion_rate: number | null
  hot_lead_alerted_at: string | null
  id: string
  is_enrolled: boolean | null
  languages_at_home: string[] | null
  last_contacted_at: string | null
  last_session_date: string | null
  last_session_focus: string | null
  last_session_summary: string | null
  latest_assessment_score: number | null
  lead_notes: string | null
  lead_score: number | null
  lead_score_updated_at: string | null
  lead_source: string | null
  lead_source_coach_id: string | null
  lead_status: string | null
  learning_challenges: string[] | null
  learning_needs: string[] | null
  learning_style: string | null
  lost_at: string | null
  lost_reason: string | null
  motivators: string[] | null
  name: string | null
  next_followup_at: string | null
  notes: string | null
  parent_concerns: string | null
  parent_email: string | null
  parent_expectations: string | null
  parent_goals: string[] | null
  parent_id: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_primary_goal: string | null
  parent_stated_goals: string | null
  phonics_focus: string | null
  primary_focus_area: string | null
  prior_reading_exposure: string | null
  program_end_date: string | null
  program_number: number | null
  program_start_date: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  reading_rank: string | null
  reading_rank_emoji: string | null
  referral_code: string | null
  referral_code_used: string | null
  referred_by_parent_id: string | null
  renewal_likelihood: string | null
  school_name: string | null
  sessions_completed: number | null
  status: string | null
  struggling_phonemes: string[] | null
  subscription_status: string | null
  total_sessions: number | null
  updated_at: string | null

## coach_activity_summary (7 columns)
  activity_status: string | null
  email: string | null
  id: string | null
  is_available: boolean | null
  last_seen_at: string | null
  name: string | null
  total_login_count: number | null

## coach_applications (47 columns)
  aadhaar_verified: boolean | null
  agreement_sent_at: string | null
  agreement_signed_at: string | null
  agreement_url: string | null
  ai_assessment_completed_at: string | null
  ai_assessment_started_at: string | null
  ai_category_scores: Json | null
  ai_red_flags: string[] | null
  ai_responses: Json | null
  ai_score_breakdown: Json | null
  ai_total_score: number | null
  audio_ai_analysis: Json | null
  audio_ai_score: number | null
  audio_duration_seconds: number | null
  audio_statement_url: string | null
  audio_transcript: string | null
  certifications_text: string | null
  city: string
  coach_id: string | null
  country: string | null
  created_at: string | null
  credential_urls: string[] | null
  current_occupation: string | null
  email: string
  experience_years: string | null
  google_event_id: string | null
  google_id: string | null
  google_meet_link: string | null
  id: string
  interview_completed_at: string | null
  interview_feedback: Json | null
  interview_notes: string | null
  interview_outcome: string | null
  interview_scheduled_at: string | null
  interview_score: number | null
  name: string
  phone: string
  qualification: string | null
  qualification_checklist: Json | null
  rejection_reason: string | null
  resume_url: string | null
  review_notes: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  status: string
  updated_at: string | null
  why_join: string | null

## coach_assignment_status (9 columns)
  assignment_id: string | null
  child_id: string | null
  completed_at: string | null
  id: string
  notified_at: string | null
  reminder_sent: boolean | null
  result_id: string | null
  started_at: string | null
  status: string | null

## coach_availability (13 columns)
  affected_sessions: number | null
  backup_coach_id: string | null
  coach_id: string
  created_at: string | null
  end_date: string
  id: string
  notify_parents: boolean | null
  reason: string | null
  resolution_type: string | null
  start_date: string
  status: string | null
  type: string
  updated_at: string | null

## coach_availability_slots (12 columns)
  coach_id: string
  created_at: string | null
  day_of_week: number | null
  end_time: string
  id: string
  is_available: boolean | null
  max_bookings_per_slot: number | null
  notes: string | null
  slot_type: string | null
  specific_date: string | null
  start_time: string
  updated_at: string | null

## coach_discovery_calls (33 columns)
  assessment_feedback: string | null
  assessment_id: string | null
  assessment_score: number | null
  assessment_wpm: number | null
  assigned_at: string | null
  assigned_by: string | null
  assigned_coach_id: string | null
  cal_booking_id: number | null
  cal_booking_uid: string | null
  cal_event_type_id: number | null
  child_age: number | null
  child_id: string | null
  child_name: string | null
  coach_email: string | null
  coach_name: string | null
  converted_at: string | null
  converted_to_enrollment: boolean | null
  created_at: string | null
  enrollment_id: string | null
  followup_count: number | null
  followup_sent_at: string | null
  id: string | null
  meeting_url: string | null
  parent_email: string | null
  parent_name: string | null
  parent_phone: string | null
  payment_link: string | null
  payment_link_sent_at: string | null
  questionnaire: Json | null
  scheduled_at: string | null
  source: string | null
  status: string | null
  updated_at: string | null

## coach_earnings (10 columns)
  child_id: string | null
  coach_amount: number
  coach_id: string | null
  created_at: string | null
  enrollment_amount: number
  id: string
  paid_at: string | null
  split_type: string | null
  status: string | null
  yestoryd_amount: number

## coach_groups (13 columns)
  badge_color: string | null
  coach_cost_percent: number
  created_at: string | null
  description: string | null
  display_name: string
  id: string
  is_active: boolean | null
  is_internal: boolean | null
  lead_cost_percent: number
  name: string
  platform_fee_percent: number
  sort_order: number | null
  updated_at: string | null

## coach_payouts (29 columns)
  bank_transfer_date: string | null
  bank_transfer_proof_url: string | null
  bank_transfer_status: string | null
  bank_utr_number: string | null
  child_id: string | null
  child_name: string | null
  coach_id: string
  created_at: string | null
  enrollment_revenue_id: string
  failure_reason: string | null
  gross_amount: number
  id: string
  net_amount: number
  notes: string | null
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  payout_month: number
  payout_type: string
  processed_at: string | null
  razorpay_payout_id: string | null
  razorpay_status: string | null
  reconciled_at: string | null
  reconciled_by: string | null
  scheduled_date: string
  status: string | null
  tds_amount: number | null
  updated_at: string | null
  utr_number: string | null

## coach_reassignment_log (10 columns)
  actual_end_date: string | null
  created_at: string | null
  enrollment_id: string | null
  expected_end_date: string | null
  id: string
  is_temporary: boolean | null
  new_coach_id: string | null
  original_coach_id: string | null
  reason: string | null
  start_date: string | null

## coach_schedule_rules (16 columns)
  applies_to: string | null
  coach_id: string
  created_at: string | null
  created_by: string | null
  day_of_week: number | null
  end_time: string
  id: string
  is_active: boolean | null
  priority: number | null
  reason: string | null
  rule_type: string
  scope: string
  session_types: Json | null
  specific_date: string | null
  start_time: string
  updated_at: string | null

## coach_scores (17 columns)
  calculated_at: string | null
  child_improvement_score: number | null
  children_coached: number | null
  coach_id: string
  communication_score: number | null
  created_at: string | null
  data_review_score: number | null
  id: string
  month: string
  no_shows: number | null
  parent_nps: number | null
  punctuality_score: number | null
  session_completion_rate: number | null
  sessions_cancelled: number | null
  sessions_completed: number | null
  tier: string | null
  total_score: number | null

## coach_specializations (6 columns)
  coach_id: string
  created_at: string | null
  id: string
  proficiency_level: number | null
  specialization_type: string
  specialization_value: string

## coach_tier_changes (10 columns)
  changed_by: string | null
  coach_id: string
  created_at: string | null
  email_sent: boolean | null
  id: string
  is_promotion: boolean | null
  new_tier: string
  old_tier: string | null
  reason: string | null
  whatsapp_sent: boolean | null

## coach_triggered_assessments (13 columns)
  assessment_id: string | null
  assessment_type: string
  broadcast_to_all: boolean | null
  child_ids: string[] | null
  coach_id: string | null
  completed_count: number | null
  created_at: string | null
  due_date: string | null
  id: string
  message: string | null
  sent_at: string | null
  total_count: number | null
  trigger_type: string

## coach_workload (10 columns)
  active_enrollments: number | null
  available_slots: number | null
  current_students: number | null
  email: string | null
  has_upcoming_unavailability: boolean | null
  id: string | null
  is_active: boolean | null
  is_available: boolean | null
  max_students: number | null
  name: string | null

## coaches (82 columns)
  aadhaar_last_four: string | null
  accepts_early_morning: boolean | null
  accepts_night: boolean | null
  agreement_ip_address: string | null
  agreement_pdf_url: string | null
  agreement_signature_url: string | null
  agreement_signed_at: string | null
  agreement_url: string | null
  agreement_user_agent: string | null
  agreement_version: string | null
  agreement_version_id: string | null
  application_id: string | null
  avatar_url: string | null
  avg_rating: number | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  bank_name: string | null
  bio: string | null
  buffer_minutes: number | null
  cal_event_type_id: number | null
  cal_username: string | null
  can_mentor: boolean | null
  certifications: string[] | null
  city: string | null
  coach_split_percentage: number | null
  created_at: string | null
  current_children: number | null
  current_score: number | null
  current_students: number | null
  current_tier: string | null
  email: string
  exit_date: string | null
  exit_initiated_by: string | null
  exit_reason: string | null
  exit_status: string | null
  group_id: string | null
  gst_number: string | null
  hourly_rate: number | null
  id: string
  is_accepting_new: boolean | null
  is_active: boolean | null
  is_available: boolean | null
  is_featured: boolean | null
  last_assigned_at: string | null
  last_seen_at: string | null
  lifetime_earnings: number | null
  max_children: number | null
  max_sessions_per_day: number | null
  max_students: number | null
  name: string
  notes: string | null
  onboarding_complete: boolean | null
  orientation_completed_at: string | null
  pan_number: string | null
  payout_enabled: boolean | null
  phone: string | null
  photo_url: string | null
  razorpay_contact_id: string | null
  razorpay_fund_account_id: string | null
  referral_code: string | null
  referral_link: string | null
  skill_tags: string[] | null
  slot_grid_minutes: number | null
  slug: string | null
  specializations: string[] | null
  status: string | null
  tax_id_type: string | null
  tds_cumulative_fy: number | null
  timezone: string | null
  total_children_coached: number | null
  total_login_count: number | null
  total_sessions_completed: number | null
  training_completed_at: string | null
  updated_at: string | null
  upi_id: string | null
  user_id: string | null
  verified_at: string | null
  verified_by: string | null
  whatsapp_number: string | null
  years_experience: number | null
  yestoryd_split_percentage: number | null

## coaches_with_groups (71 columns)
  aadhaar_last_four: string | null
  agreement_ip_address: string | null
  agreement_pdf_url: string | null
  agreement_signature_url: string | null
  agreement_signed_at: string | null
  agreement_url: string | null
  agreement_user_agent: string | null
  agreement_version: string | null
  agreement_version_id: string | null
  application_id: string | null
  avatar_url: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  bank_name: string | null
  bio: string | null
  cal_event_type_id: number | null
  cal_username: string | null
  can_mentor: boolean | null
  certifications: string[] | null
  city: string | null
  coach_cost_percent: number | null
  coach_split_percentage: number | null
  created_at: string | null
  current_children: number | null
  current_score: number | null
  current_students: number | null
  current_tier: string | null
  email: string | null
  group_badge_color: string | null
  group_display_name: string | null
  group_id: string | null
  group_name: string | null
  gst_number: string | null
  hourly_rate: number | null
  id: string | null
  is_accepting_new: boolean | null
  is_active: boolean | null
  is_available: boolean | null
  is_featured: boolean | null
  is_internal: boolean | null
  last_seen_at: string | null
  lead_cost_percent: number | null
  lifetime_earnings: number | null
  max_children: number | null
  max_students: number | null
  name: string | null
  notes: string | null
  onboarding_complete: boolean | null
  orientation_completed_at: string | null
  pan_number: string | null
  payout_enabled: boolean | null
  phone: string | null
  photo_url: string | null
  platform_fee_percent: number | null
  razorpay_contact_id: string | null
  razorpay_fund_account_id: string | null
  referral_code: string | null
  referral_link: string | null
  slug: string | null
  specializations: string[] | null
  tax_id_type: string | null
  tds_cumulative_fy: number | null
  total_children_coached: number | null
  total_login_count: number | null
  total_sessions_completed: number | null
  training_completed_at: string | null
  updated_at: string | null
  upi_id: string | null
  whatsapp_number: string | null
  yestoryd_split_percentage: number | null

## coaching_tips (11 columns)
  applicable_ages: string | null
  applicable_scenarios: string[] | null
  category: string
  created_at: string | null
  id: string
  is_active: boolean | null
  source: string | null
  subcategory: string | null
  tip_content: string
  title: string
  usage_count: number | null

## communication_analytics (18 columns)
  created_at: string | null
  date: string
  email_opened: number | null
  email_sent: number | null
  id: string
  in_app_created: number | null
  in_app_read: number | null
  push_clicked: number | null
  push_failed: number | null
  push_sent: number | null
  sms_cost: number | null
  sms_sent: number | null
  total_cost: number | null
  updated_at: string | null
  whatsapp_cost: number | null
  whatsapp_marketing_sent: number | null
  whatsapp_sent: number | null
  whatsapp_utility_sent: number | null

## communication_log (21 columns)
  channel: string
  created_at: string | null
  delivered_at: string | null
  error_message: string | null
  failed_at: string | null
  id: string
  message_preview: string | null
  provider_message_id: string | null
  queued_at: string | null
  read_at: string | null
  recipient_contact: string | null
  recipient_id: string | null
  recipient_name: string | null
  recipient_type: string | null
  related_entity_id: string | null
  related_entity_type: string | null
  sent_at: string | null
  status: string | null
  template_code: string
  template_id: string | null
  variables_used: Json | null

## communication_logs (13 columns)
  context_data: Json | null
  created_at: string | null
  email_sent: boolean | null
  error_message: string | null
  id: string
  recipient_email: string | null
  recipient_id: string | null
  recipient_phone: string | null
  recipient_type: string
  sent_at: string | null
  sms_sent: boolean | null
  template_code: string
  wa_sent: boolean | null

## communication_preferences (12 columns)
  channels_enabled: Json | null
  created_at: string | null
  daily_digest: boolean | null
  digest_time: string | null
  id: string
  quiet_hours_enabled: boolean | null
  quiet_hours_end: string | null
  quiet_hours_start: string | null
  timezone: string | null
  updated_at: string | null
  user_id: string
  user_type: string

## communication_queue (19 columns)
  created_at: string | null
  created_by: string | null
  error_message: string | null
  id: string
  last_attempt_at: string | null
  log_id: string | null
  max_attempts: number | null
  next_attempt_at: string | null
  priority: string | null
  processed_at: string | null
  recipient_id: string
  recipient_type: string
  related_entity_id: string | null
  related_entity_type: string | null
  scheduled_for: string
  sent_at: string | null
  status: string | null
  template_code: string
  variables: Json

## communication_templates (35 columns)
  channels: Json | null
  cost_tier: string | null
  created_at: string | null
  created_by: string | null
  delay_minutes: number | null
  description: string | null
  email_body_html: string | null
  email_sendgrid_template_id: string | null
  email_subject: string | null
  id: string
  in_app_config: Json | null
  is_active: boolean | null
  journey: string | null
  meta_category: string | null
  name: string
  notes: string | null
  priority: number | null
  push_config: Json | null
  recipient_type: string
  required_variables: string[] | null
  respect_window: boolean | null
  routing_rules: Json | null
  send_window_end: string | null
  send_window_start: string | null
  sms_body: string | null
  stage: string | null
  template_code: string
  updated_at: string | null
  use_email: boolean | null
  use_sms: boolean | null
  use_whatsapp: boolean | null
  wa_approved: boolean | null
  wa_template_category: string | null
  wa_template_name: string | null
  wa_variables: string[] | null

## completion_certificates (23 columns)
  certificate_number: string
  certificate_url: string | null
  child_id: string
  child_name: string
  coach_id: string | null
  coach_name: string
  coaching_sessions_completed: number
  created_at: string | null
  downloaded_at: string | null
  email_sent_at: string | null
  enrollment_id: string
  final_assessment: Json
  id: string
  improvement_data: Json
  initial_assessment: Json
  issued_at: string | null
  parent_checkins_completed: number
  program_end_date: string
  program_start_date: string
  progress_report_url: string | null
  report_content: Json | null
  shared_at: string | null
  whatsapp_sent_at: string | null

## coupon_usages (18 columns)
  child_id: string | null
  coupon_discount: number
  coupon_id: string
  credit_amount_awarded: number | null
  credit_applied: number | null
  credit_awarded_to_parent_id: string | null
  discount_capped: boolean | null
  elearning_subscription_id: string | null
  enrollment_id: string | null
  final_amount: number
  group_class_registration_id: string | null
  id: string
  lead_source: string | null
  original_amount: number
  parent_id: string
  product_type: string
  total_discount: number
  used_at: string | null

## coupon_uses (6 columns)
  coupon_id: string | null
  created_at: string | null
  discount_amount: number | null
  id: string
  order_id: string | null
  user_email: string

## coupons (27 columns)
  applicable_to: string[] | null
  coach_id: string | null
  code: string
  coupon_type: string
  created_at: string | null
  created_by: string | null
  current_uses: number | null
  description: string | null
  discount_type: string | null
  discount_value: number | null
  first_enrollment_only: boolean | null
  id: string
  is_active: boolean | null
  max_discount: number | null
  max_uses: number | null
  min_order_value: number | null
  notes: string | null
  parent_id: string | null
  per_user_limit: number | null
  referrer_type: string | null
  successful_conversions: number | null
  title: string | null
  total_discount_given: number | null
  total_referrals: number | null
  updated_at: string | null
  valid_from: string | null
  valid_until: string | null

## crm_funnel_metrics (8 columns)
  assessment_to_call_pct: number | null
  call_completion_pct: number | null
  call_to_enrollment_pct: number | null
  calls_booked: number | null
  calls_completed: number | null
  calls_no_show: number | null
  enrolled: number | null
  total_assessments: number | null

## cron_logs (7 columns)
  created_at: string | null
  cron_name: string
  error_message: string | null
  id: string
  run_at: string | null
  success: boolean | null
  summary: Json | null

## curriculum_template (8 columns)
  duration_minutes: number
  id: number
  is_auto_scheduled: boolean | null
  is_group: boolean | null
  preferred_time_slot: string | null
  session_title: string | null
  session_type: string
  week_number: number

## decrement_coupon_usage (0 columns)

## discovery_calls (50 columns)
  assessment_feedback: string | null
  assessment_id: string | null
  assessment_score: number | null
  assessment_wpm: number | null
  assigned_at: string | null
  assigned_by: string | null
  assigned_coach_id: string | null
  assignment_type: string | null
  booking_source: string | null
  cal_booking_id: number | null
  cal_booking_uid: string | null
  cal_event_type_id: number | null
  call_completed: boolean | null
  call_outcome: string | null
  child_age: number | null
  child_id: string | null
  child_name: string
  completed_at: string | null
  completed_by: string | null
  concerns: string | null
  converted_at: string | null
  converted_to_enrollment: boolean | null
  created_at: string | null
  enrollment_id: string | null
  follow_up_date: string | null
  follow_up_notes: string | null
  followup_count: number | null
  followup_sent_at: string | null
  google_calendar_event_id: string | null
  google_meet_link: string | null
  id: string
  likelihood: string | null
  meeting_url: string | null
  objections: string | null
  parent_email: string
  parent_goals: string[] | null
  parent_name: string
  parent_phone: string | null
  payment_link: string | null
  payment_link_send_count: number | null
  payment_link_sent_at: string | null
  payment_link_sent_by: string | null
  questionnaire: Json | null
  request_id: string | null
  scheduled_at: string | null
  slot_date: string | null
  slot_time: string | null
  source: string | null
  status: string | null
  updated_at: string | null

## discovery_calls_need_followup (33 columns)
  assessment_feedback: string | null
  assessment_id: string | null
  assessment_score: number | null
  assessment_wpm: number | null
  assigned_at: string | null
  assigned_by: string | null
  assigned_coach_id: string | null
  cal_booking_id: number | null
  cal_booking_uid: string | null
  cal_event_type_id: number | null
  child_age: number | null
  child_id: string | null
  child_name: string | null
  coach_name: string | null
  converted_at: string | null
  converted_to_enrollment: boolean | null
  created_at: string | null
  enrollment_id: string | null
  followup_count: number | null
  followup_sent_at: string | null
  hours_since_payment_link: number | null
  id: string | null
  meeting_url: string | null
  parent_email: string | null
  parent_name: string | null
  parent_phone: string | null
  payment_link: string | null
  payment_link_sent_at: string | null
  questionnaire: Json | null
  scheduled_at: string | null
  source: string | null
  status: string | null
  updated_at: string | null

## discovery_calls_pending_assignment (32 columns)
  assessment_feedback: string | null
  assessment_id: string | null
  assessment_score: number | null
  assessment_wpm: number | null
  assigned_at: string | null
  assigned_by: string | null
  assigned_coach_id: string | null
  cal_booking_id: number | null
  cal_booking_uid: string | null
  cal_event_type_id: number | null
  child_age: number | null
  child_id: string | null
  child_name: string | null
  coach_name: string | null
  converted_at: string | null
  converted_to_enrollment: boolean | null
  created_at: string | null
  enrollment_id: string | null
  followup_count: number | null
  followup_sent_at: string | null
  id: string | null
  meeting_url: string | null
  parent_email: string | null
  parent_name: string | null
  parent_phone: string | null
  payment_link: string | null
  payment_link_sent_at: string | null
  questionnaire: Json | null
  scheduled_at: string | null
  source: string | null
  status: string | null
  updated_at: string | null

## el_badges (15 columns)
  coins_reward: number | null
  created_at: string | null
  criteria_extra: Json | null
  criteria_type: string
  criteria_value: number
  description: string | null
  icon: string | null
  id: string
  image_url: string | null
  is_active: boolean | null
  name: string
  order_index: number | null
  rarity: string | null
  slug: string
  xp_reward: number | null

## el_child_avatars (8 columns)
  avatar_color: string | null
  avatar_name: string | null
  avatar_type: string
  child_id: string | null
  created_at: string | null
  evolution_level: number | null
  id: string
  updated_at: string | null

## el_child_badges (5 columns)
  badge_id: string | null
  child_id: string | null
  earned_at: string | null
  earned_context: string | null
  id: string

## el_child_gamification (15 columns)
  child_id: string | null
  created_at: string | null
  current_level: number | null
  current_streak_days: number | null
  games_played: number | null
  games_won: number | null
  id: string
  last_activity_date: string | null
  longest_streak_days: number | null
  perfect_scores: number | null
  total_coins: number | null
  total_xp: number | null
  units_completed: number | null
  updated_at: string | null
  videos_watched: number | null

## el_child_identity (15 columns)
  best_learning_time: string | null
  child_id: string | null
  created_at: string | null
  favorite_animal: string | null
  favorite_character: string | null
  favorite_color: string | null
  favorite_food: string | null
  id: string
  interests: Json | null
  last_updated_by: string | null
  nickname: string | null
  pet_name: string | null
  pet_type: string | null
  preferred_session_length: string | null
  updated_at: string | null

## el_child_unit_progress (20 columns)
  badge_earned: boolean | null
  best_game_score: number | null
  child_id: string | null
  coins_earned: number | null
  completed_at: string | null
  created_at: string | null
  current_step: number | null
  games_passed: number | null
  games_played: number | null
  id: string
  last_activity_at: string | null
  overall_mastery_percent: number | null
  quiz_score: number | null
  sequence_shown: Json | null
  started_at: string | null
  status: string | null
  unit_id: string | null
  unlocked_at: string | null
  video_watch_percent: number | null
  xp_earned: number | null

## el_child_video_progress (12 columns)
  child_id: string | null
  completed: boolean | null
  completed_at: string | null
  created_at: string | null
  id: string
  times_watched: number | null
  unit_id: string | null
  updated_at: string | null
  video_id: string | null
  watch_percent: number | null
  watch_time_seconds: number | null
  xp_earned: number | null

## el_game_content (10 columns)
  content_data: Json
  created_at: string | null
  difficulty: number | null
  game_engine_id: string | null
  id: string
  is_active: boolean | null
  is_challenge: boolean | null
  is_practice: boolean | null
  is_warmup: boolean | null
  skill_id: string | null

## el_game_engines (15 columns)
  color: string | null
  created_at: string | null
  description: string | null
  game_type: string
  icon: string | null
  id: string
  instructions: string | null
  is_active: boolean | null
  max_age: number | null
  min_age: number | null
  name: string
  points_per_correct: number | null
  points_per_wrong: number | null
  slug: string
  time_limit_seconds: number | null

## el_game_sessions (21 columns)
  accuracy_percent: number | null
  child_id: string | null
  coins_earned: number | null
  completed_at: string | null
  correct_count: number | null
  created_at: string | null
  game_content_id: string | null
  game_engine_id: string | null
  id: string
  max_score: number | null
  mistakes: Json | null
  passed: boolean | null
  score: number | null
  skill_id: string | null
  started_at: string | null
  time_spent_seconds: number | null
  total_count: number | null
  unit_id: string | null
  was_completed: boolean | null
  wrong_count: number | null
  xp_earned: number | null

## el_learning_units (19 columns)
  badge_slug: string | null
  coins_reward: number | null
  created_at: string | null
  description: string | null
  difficulty: number | null
  estimated_minutes: number | null
  game_types: string[] | null
  id: string
  is_active: boolean | null
  min_mastery_percent: number | null
  name: string
  order_index: number | null
  prerequisite_unit_ids: string[] | null
  quest_description: string | null
  quest_title: string | null
  skill_id: string | null
  video_ids: string[] | null
  world_theme: string | null
  xp_reward: number | null

## el_modules (10 columns)
  created_at: string | null
  description: string | null
  estimated_hours: number | null
  icon: string | null
  id: string
  is_active: boolean | null
  name: string
  order_index: number
  slug: string
  stage_id: string | null

## el_skills (10 columns)
  created_at: string | null
  description: string | null
  difficulty: number | null
  estimated_minutes: number | null
  id: string
  is_active: boolean | null
  module_id: string | null
  name: string
  order_index: number
  skill_tag: string

## el_stages (11 columns)
  color: string | null
  created_at: string | null
  description: string | null
  icon: string | null
  id: string
  is_active: boolean | null
  max_age: number
  min_age: number
  name: string
  order_index: number
  slug: string

## el_videos (18 columns)
  created_at: string | null
  description: string | null
  difficulty: number | null
  duration_seconds: number | null
  id: string
  is_active: boolean | null
  is_intro: boolean | null
  is_placeholder: boolean | null
  order_index: number | null
  skill_id: string | null
  thumbnail_url: string | null
  title: string
  updated_at: string | null
  video_id: string | null
  video_source: string | null
  video_type: string | null
  video_url: string | null
  xp_reward: number | null

## elearning_content_pools (14 columns)
  age_group: string | null
  content: Json
  created_at: string | null
  difficulty: string | null
  difficulty_level: string | null
  id: string
  is_active: boolean | null
  item_count: number | null
  name: string
  pool_type: string
  slug: string
  sub_skill_id: string | null
  title: string | null
  updated_at: string | null

## elearning_game_engines (14 columns)
  base_xp_reward: number | null
  component_name: string
  config_schema: Json
  created_at: string | null
  description: string | null
  estimated_minutes: number | null
  icon_emoji: string | null
  id: string
  is_active: boolean | null
  name: string
  perfect_bonus_xp: number | null
  preview_image_url: string | null
  slug: string
  supported_pool_types: string[] | null

## elearning_quizzes (8 columns)
  created_at: string | null
  id: string
  is_active: boolean | null
  name: string
  passing_score: number | null
  questions: Json
  slug: string
  sub_skill_id: string | null

## elearning_skills (12 columns)
  category: string
  color_hex: string | null
  created_at: string | null
  description: string | null
  display_order: number
  icon_emoji: string | null
  id: string
  is_active: boolean | null
  level: number
  name: string
  slug: string
  updated_at: string | null

## elearning_sub_skills (9 columns)
  created_at: string | null
  description: string | null
  display_order: number
  id: string
  is_active: boolean | null
  keywords: string[] | null
  name: string
  skill_id: string
  slug: string

## elearning_units (24 columns)
  activity_count: number | null
  color_hex: string | null
  created_at: string | null
  description: string | null
  difficulty: string | null
  display_order: number | null
  estimated_minutes: number | null
  icon_emoji: string | null
  id: string
  is_featured: boolean | null
  level: number | null
  max_age: number | null
  min_age: number | null
  name: string
  published_at: string | null
  quest_title: string | null
  sequence: Json
  slug: string
  status: string | null
  sub_skill_id: string
  tags: string[] | null
  thumbnail_url: string | null
  total_xp_reward: number | null
  updated_at: string | null

## enrollment_events (7 columns)
  created_at: string | null
  enrollment_id: string
  event_data: Json | null
  event_type: string
  id: string
  triggered_by: string
  triggered_by_id: string | null

## enrollment_revenue (22 columns)
  coach_cost_amount: number
  coach_group_id: string | null
  coach_group_name: string | null
  coaching_coach_id: string
  config_snapshot: Json
  created_at: string | null
  enrollment_id: string
  id: string
  lead_bonus_coach_id: string | null
  lead_cost_amount: number
  lead_source: string
  lead_source_coach_id: string | null
  net_retained_by_platform: number
  net_to_coach: number
  net_to_lead_source: number
  platform_fee_amount: number
  status: string | null
  tds_amount: number | null
  tds_applicable: boolean | null
  tds_rate_applied: number | null
  total_amount: number
  updated_at: string | null

## enrollment_terminations (21 columns)
  coach_settlement_amount: number
  created_at: string | null
  created_by: string
  enrollment_id: string
  id: string
  original_amount: number
  platform_retention: number
  razorpay_payment_id: string
  razorpay_refund_id: string | null
  refund_amount: number
  refund_completed_at: string | null
  refund_failure_reason: string | null
  refund_initiated_at: string | null
  refund_status: string | null
  sessions_completed: number
  sessions_remaining: number
  sessions_total: number
  terminated_by: string
  termination_notes: string | null
  termination_reason: string
  updated_at: string | null

## enrollments (82 columns)
  actual_start_date: string | null
  amount: number | null
  at_risk: boolean | null
  at_risk_reason: string | null
  certificate_id: string | null
  certificate_number: string | null
  child_id: string | null
  coach_assigned_by: string | null
  coach_id: string | null
  coach_settlement: number | null
  completed_at: string | null
  completion_alert_sent_at: string | null
  completion_triggered_at: string | null
  consecutive_no_shows: number | null
  continuation_deadline: string | null
  coupon_code_used: string | null
  coupon_discount_amount: number | null
  coupon_id: string | null
  created_at: string | null
  credit_used: number | null
  discount_amount: number | null
  enrollment_type: string | null
  extension_count: number | null
  final_assessment_completed_at: string | null
  id: string
  is_paused: boolean | null
  last_alert_sent_at: string | null
  lead_source: string | null
  lead_source_coach_id: string | null
  max_reschedules: number | null
  no_show_count: number | null
  nps_score: number | null
  nps_submitted_at: string | null
  original_amount: number | null
  original_coach_id: string | null
  original_end_date: string | null
  original_program_end: string | null
  parent_id: string | null
  pause_count: number | null
  pause_end_date: string | null
  pause_reason: string | null
  pause_start_date: string | null
  payment_id: string | null
  platform_settlement: number | null
  preference_days: Json | null
  preference_start_date: string | null
  preference_start_type: string | null
  preference_time_bucket: string | null
  preferred_day: number | null
  preferred_time: string | null
  product_id: string | null
  program_end: string | null
  program_start: string | null
  referral_code_used: string | null
  referred_by_parent_id: string | null
  refund_amount: number | null
  remedial_sessions_max: number | null
  remedial_sessions_used: number | null
  renewal_offered_at: string | null
  renewal_status: string | null
  renewed_from_enrollment_id: string | null
  requested_start_date: string | null
  reschedules_used: number | null
  risk_level: string | null
  schedule_confirmed: boolean | null
  schedule_confirmed_at: string | null
  schedule_confirmed_by: string | null
  sessions_cancelled_count: number | null
  sessions_completed: number | null
  sessions_purchased: number | null
  sessions_remaining: number | null
  sessions_rescheduled_count: number | null
  sessions_scheduled: number | null
  starter_completed_at: string | null
  starter_enrollment_id: string | null
  status: string | null
  terminated_at: string | null
  terminated_by: string | null
  termination_reason: string | null
  total_no_shows: number | null
  total_pause_days: number | null
  updated_at: string | null

## enrollments_pause_ending (43 columns)
  actual_start_date: string | null
  amount: number | null
  child_id: string | null
  child_name: string | null
  coach_assigned_by: string | null
  coach_email: string | null
  coach_id: string | null
  coach_name: string | null
  coach_settlement: number | null
  created_at: string | null
  id: string | null
  is_paused: boolean | null
  lead_source: string | null
  lead_source_coach_id: string | null
  original_coach_id: string | null
  original_end_date: string | null
  parent_email: string | null
  parent_id: string | null
  parent_name: string | null
  parent_phone: string | null
  pause_count: number | null
  pause_end_date: string | null
  pause_reason: string | null
  pause_start_date: string | null
  payment_id: string | null
  platform_settlement: number | null
  preferred_day: number | null
  preferred_time: string | null
  program_end: string | null
  program_start: string | null
  referral_code_used: string | null
  refund_amount: number | null
  requested_start_date: string | null
  schedule_confirmed: boolean | null
  schedule_confirmed_at: string | null
  schedule_confirmed_by: string | null
  sessions_completed: number | null
  sessions_remaining: number | null
  status: string | null
  terminated_at: string | null
  terminated_by: string | null
  termination_reason: string | null
  total_pause_days: number | null

## enrollments_pending_start (44 columns)
  actual_start_date: string | null
  amount: number | null
  child_age: number | null
  child_id: string | null
  child_name: string | null
  coach_assigned_by: string | null
  coach_email: string | null
  coach_id: string | null
  coach_name: string | null
  coach_settlement: number | null
  created_at: string | null
  id: string | null
  is_paused: boolean | null
  lead_source: string | null
  lead_source_coach_id: string | null
  original_coach_id: string | null
  original_end_date: string | null
  parent_email: string | null
  parent_id: string | null
  parent_name: string | null
  parent_phone: string | null
  pause_count: number | null
  pause_end_date: string | null
  pause_reason: string | null
  pause_start_date: string | null
  payment_id: string | null
  platform_settlement: number | null
  preferred_day: number | null
  preferred_time: string | null
  program_end: string | null
  program_start: string | null
  referral_code_used: string | null
  refund_amount: number | null
  requested_start_date: string | null
  schedule_confirmed: boolean | null
  schedule_confirmed_at: string | null
  schedule_confirmed_by: string | null
  sessions_completed: number | null
  sessions_remaining: number | null
  status: string | null
  terminated_at: string | null
  terminated_by: string | null
  termination_reason: string | null
  total_pause_days: number | null

## extend_program (0 columns)

## failed_payments (12 columns)
  amount: number | null
  attempt_count: number | null
  booking_id: string | null
  converted_at: string | null
  created_at: string | null
  error_code: string | null
  error_description: string | null
  id: string
  notified: boolean | null
  parent_email: string | null
  razorpay_order_id: string
  razorpay_payment_id: string

## feature_flags (6 columns)
  description: string | null
  flag_key: string
  flag_value: boolean | null
  id: string
  updated_at: string | null
  updated_by: string | null

## generate_embedding_content (0 columns)

## generate_parent_referral_code (0 columns)

## get_active_agreement (0 columns)

## get_active_revenue_config (0 columns)

## get_auto_apply_coupon (0 columns)

## get_available_coaches (0 columns)

## get_best_available_coach (0 columns)

## get_coach_available_slots (0 columns)

## get_coach_students_events (0 columns)

## get_completed_session_counts (0 columns)

## get_funnel_stats (0 columns)

## get_reading_rank (0 columns)

## get_session_duration (0 columns)

## get_session_stats (0 columns)

## get_trending_books (0 columns)

## get_unread_notification_count (0 columns)

## group_class_certificates (10 columns)
  certificate_number: string | null
  certificate_url: string | null
  child_id: string
  created_at: string | null
  delivered: boolean | null
  group_session_id: string
  id: string
  registration_id: string
  sent_at: string | null
  sent_via: string | null

## group_class_coupons (20 columns)
  applies_to_class_types: string[] | null
  code: string
  created_at: string | null
  created_by: string | null
  current_uses: number | null
  description: string | null
  discount_type: string
  discount_value: number
  id: string
  is_active: boolean | null
  is_enrolled_only: boolean | null
  is_first_class_only: boolean | null
  is_single_use: boolean | null
  max_uses_per_child: number | null
  max_uses_total: number | null
  min_purchase_amount: number | null
  name: string
  updated_at: string | null
  valid_from: string | null
  valid_until: string | null

## group_class_registrations_summary (9 columns)
  attended_count: number | null
  enrolled_free_count: number | null
  paid_count: number | null
  scheduled_date: string | null
  scheduled_time: string | null
  session_id: string | null
  session_title: string | null
  total_registrations: number | null
  total_revenue: number | null

## group_class_types (25 columns)
  age_max: number | null
  age_min: number | null
  color_hex: string | null
  created_at: string | null
  default_instructor_split_percent: number | null
  description: string | null
  display_order: number | null
  duration_minutes: number
  features: Json | null
  icon_emoji: string | null
  id: string
  image_url: string | null
  is_active: boolean | null
  is_featured: boolean | null
  learning_outcomes: Json | null
  max_participants: number | null
  min_participants: number | null
  name: string
  price_inr: number
  requires_book: boolean | null
  slug: string
  tagline: string | null
  typical_days: string[] | null
  typical_times: string[] | null
  updated_at: string | null

## group_class_waitlist (12 columns)
  child_id: string
  created_at: string | null
  group_session_id: string
  id: string
  notification_expires_at: string | null
  notified_at: string | null
  parent_id: string | null
  position: number
  promoted_at: string | null
  promoted_to_registration_id: string | null
  status: string | null
  updated_at: string | null

## group_session_participants (27 columns)
  amount_original: number | null
  amount_paid: number | null
  attendance_marked_at: string | null
  attendance_marked_by: string | null
  attendance_status: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  certificate_sent: boolean | null
  certificate_sent_at: string | null
  child_id: string | null
  coupon_code_used: string | null
  coupon_id: string | null
  discount_amount: number | null
  group_session_id: string | null
  id: string
  is_enrolled_free: boolean | null
  paid_at: string | null
  parent_id: string | null
  participation_notes: string | null
  participation_rating: number | null
  payment_status: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  refund_amount: number | null
  refund_status: string | null
  registration_date: string | null
  updated_at: string | null

## group_sessions (30 columns)
  age_max: number | null
  age_min: number | null
  book_id: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  class_type_id: string | null
  coach_id: string | null
  completed_at: string | null
  created_at: string | null
  current_participants: number | null
  description: string | null
  duration_minutes: number
  google_calendar_event_id: string | null
  google_event_id: string | null
  google_meet_link: string | null
  id: string
  instructor_id: string | null
  instructor_split_percent: number | null
  max_participants: number | null
  notes: string | null
  price_inr: number | null
  recall_bot_id: string | null
  registration_deadline: string | null
  scheduled_date: string
  scheduled_time: string
  session_type: string
  status: string | null
  title: string
  updated_at: string | null
  waitlist_enabled: boolean | null

## has_active_push_subscription (0 columns)

## homework_assignments (17 columns)
  assigned_at: string | null
  child_id: string
  coach_feedback: string | null
  coach_id: string
  completed_at: string | null
  completion_quality: string | null
  created_at: string | null
  description: string | null
  due_date: string | null
  id: string
  parent_helped: boolean | null
  passage_id: string | null
  session_id: string | null
  status: string | null
  time_spent_minutes: number | null
  topic: string
  updated_at: string | null

## hybrid_match_learning_events (0 columns)

## in_app_notifications (14 columns)
  action_url: string | null
  body: string
  created_at: string | null
  dismissed_at: string | null
  id: string
  is_dismissed: boolean | null
  is_read: boolean | null
  metadata: Json | null
  notification_type: string | null
  read_at: string | null
  title: string
  updated_at: string | null
  user_id: string
  user_type: string

## increment_coupon_usage (0 columns)

## increment_sessions_completed (0 columns)

## interactions (14 columns)
  child_id: string | null
  created_at: string | null
  direction: string | null
  duration_minutes: number | null
  id: string
  logged_by: string
  next_action: string | null
  next_followup_at: string | null
  outcome: string | null
  parent_id: string | null
  status: string | null
  summary: string
  type: string
  updated_at: string | null

## is_unit_unlocked (0 columns)

## launch_waitlist (13 columns)
  child_age: number | null
  child_name: string | null
  converted_at: string | null
  created_at: string | null
  email: string
  id: string
  name: string
  notes: string | null
  notified_at: string | null
  phone: string
  product_slug: string
  source: string | null
  status: string | null

## lead_status_history (7 columns)
  changed_by: string
  child_id: string | null
  created_at: string | null
  from_status: string | null
  id: string
  notes: string | null
  to_status: string

## learning_events (19 columns)
  ai_summary: string | null
  child_id: string
  coach_id: string | null
  content_for_embedding: string | null
  created_at: string | null
  created_by: string | null
  data: Json
  embedding: string | null
  event_data: Json | null
  event_date: string | null
  event_subtype: string | null
  event_type: string
  id: string
  session_id: string | null
  tldv_recording_url: string | null
  tldv_transcript: string | null
  updated_at: string | null
  voice_note_transcript: string | null
  voice_note_url: string | null

## learning_games (17 columns)
  config: Json
  created_at: string | null
  display_order: number | null
  game_type: string
  id: string
  is_active: boolean | null
  level_id: string | null
  module_id: string | null
  passing_score: number | null
  skill_tags: string[] | null
  slug: string | null
  time_limit_seconds: number | null
  title: string
  updated_at: string | null
  video_id: string | null
  xp_per_correct: number | null
  xp_reward: number | null

## learning_levels (13 columns)
  age_range: string
  color: string | null
  created_at: string | null
  description: string | null
  display_order: number
  icon: string | null
  id: string
  is_active: boolean | null
  name: string
  slug: string
  thumbnail_url: string | null
  updated_at: string | null
  xp_bonus: number | null

## learning_modules (15 columns)
  badge_id: string | null
  created_at: string | null
  description: string | null
  display_order: number
  estimated_duration: number | null
  id: string
  is_active: boolean | null
  is_free: boolean | null
  level_id: string | null
  name: string
  prerequisite_module_id: string | null
  slug: string
  thumbnail_url: string | null
  updated_at: string | null
  xp_reward: number | null

## learning_videos (27 columns)
  approved_at: string | null
  approved_by: string | null
  created_at: string | null
  description: string | null
  display_order: number
  duration_seconds: number | null
  game_id: string | null
  game_type: string | null
  has_quiz: boolean | null
  id: string
  is_active: boolean | null
  is_free: boolean | null
  key_concepts: string[] | null
  module_id: string | null
  published_at: string | null
  quiz_pass_percentage: number | null
  slug: string
  status: string | null
  thumbnail_url: string | null
  title: string
  transcript: string | null
  unlock_after_percent: number | null
  updated_at: string | null
  video_id: string | null
  video_source: string | null
  video_url: string | null
  xp_reward: number | null

## log_enrollment_event (0 columns)

## match_learning_events (0 columns)

## messages (14 columns)
  attachment_url: string | null
  child_id: string
  created_at: string | null
  flagged_by: string | null
  flagged_reason: string | null
  id: string
  is_flagged: boolean | null
  is_read: boolean | null
  message_text: string
  message_type: string | null
  read_at: string | null
  sender_id: string
  sender_type: string
  updated_at: string | null

## nps_responses (24 columns)
  category: string | null
  child_id: string
  child_name: string | null
  coach_id: string | null
  coach_rating: number | null
  content_rating: number | null
  created_at: string | null
  enrollment_id: string
  feedback: string | null
  google_review_clicked: boolean | null
  google_review_requested: boolean | null
  google_review_url: string | null
  highlight: string | null
  id: string
  improvement_suggestions: string | null
  parent_email: string | null
  parent_id: string | null
  parent_name: string | null
  platform_rating: number | null
  score: number
  submitted_at: string | null
  testimonial: string | null
  testimonial_approved: boolean | null
  testimonial_consent: boolean | null

## parent_communications (13 columns)
  action_items: string[] | null
  child_id: string
  coach_id: string | null
  communication_type: string
  created_at: string | null
  direction: string
  follow_up_date: string | null
  follow_up_required: boolean | null
  id: string
  sentiment: string | null
  session_id: string | null
  summary: string
  topics_discussed: string[] | null

## parents (15 columns)
  created_at: string | null
  email: string
  id: string
  last_seen_at: string | null
  name: string | null
  notification_preferences: Json | null
  phone: string | null
  referral_code: string | null
  referral_credit_balance: number | null
  referral_credit_expires_at: string | null
  total_credit_earned: number | null
  total_login_count: number | null
  total_referrals: number | null
  updated_at: string | null
  user_id: string | null

## payment_retry_tokens (6 columns)
  booking_id: string | null
  created_at: string | null
  expires_at: string
  id: string
  token: string
  used_at: string | null

## payments (17 columns)
  amount: number
  captured_at: string | null
  child_id: string | null
  coach_id: string | null
  coupon_code: string | null
  created_at: string | null
  currency: string | null
  discount_amount: number | null
  failure_reason: string | null
  id: string
  original_amount: number | null
  package_type: string | null
  parent_id: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  source: string | null
  status: string | null

## pending_assessments (19 columns)
  ai_provider_used: string | null
  audio_data: string
  audio_url: string | null
  child_age: number
  child_name: string
  created_at: string
  error_message: string | null
  id: string
  lead_source: string | null
  lead_source_coach_id: string | null
  parent_email: string
  parent_name: string | null
  parent_phone: string | null
  passage: string
  processed_at: string | null
  referral_code_used: string | null
  result: Json | null
  retry_count: number
  status: string

## phone_backup_20260117 (3 columns)
  id: string | null
  phone: string | null
  tbl: string | null

## pricing_plans (35 columns)
  checkin_duration_mins: number | null
  checkin_week_schedule: Json | null
  coaching_duration_mins: number | null
  coaching_week_schedule: Json | null
  created_at: string | null
  currency: string | null
  description: string | null
  discount_label: string | null
  discounted_price: number
  display_order: number | null
  duration_checkin_mins: number | null
  duration_coaching_mins: number | null
  duration_months: number | null
  duration_skill_mins: number | null
  duration_weeks: number | null
  features: Json | null
  id: string
  is_active: boolean | null
  is_featured: boolean | null
  is_locked: boolean | null
  is_visible: boolean | null
  lock_message: string | null
  name: string
  offer_valid_until: string | null
  original_price: number
  phase_number: number | null
  product_type: string | null
  sessions_checkin: number | null
  sessions_coaching: number | null
  sessions_included: number | null
  sessions_skill_building: number | null
  skill_building_duration_mins: number | null
  slug: string
  updated_at: string | null
  week_range: string | null

## proactive_notifications (15 columns)
  channel: string
  child_id: string | null
  coach_id: string | null
  created_at: string | null
  id: string
  message_sent: string | null
  notification_type: string
  recipient_email: string | null
  recipient_phone: string | null
  recipient_role: string
  sent_at: string | null
  session_id: string | null
  status: string | null
  trigger_data: Json | null
  trigger_reason: string | null

## process_payout_batch (0 columns)

## processed_webhooks (6 columns)
  created_at: string | null
  event_type: string
  id: string
  processed_at: string | null
  request_id: string | null
  webhook_id: string

## push_subscriptions (13 columns)
  auth_key: string
  browser: string | null
  created_at: string | null
  device_type: string | null
  endpoint: string
  error_count: number | null
  id: string
  is_active: boolean | null
  last_used_at: string | null
  p256dh_key: string
  updated_at: string | null
  user_id: string
  user_type: string

## quiz_attempts (12 columns)
  answers: Json | null
  child_id: string | null
  completed_at: string | null
  created_at: string | null
  id: string
  questions: Json | null
  quiz_id: string | null
  quiz_type: string | null
  score: number | null
  session_id: string | null
  time_taken_seconds: number | null
  total: number | null

## quiz_bank (14 columns)
  age_group: string | null
  age_max: number | null
  age_min: number | null
  created_at: string | null
  difficulty_level: string | null
  id: string
  is_active: boolean | null
  passing_score: number | null
  questions: Json
  skills_assessed: string[] | null
  subtopic: string | null
  time_limit_minutes: number | null
  title: string | null
  topic: string

## reading_goals (15 columns)
  achieved_at: string | null
  baseline_value: number | null
  child_id: string
  coach_id: string | null
  created_at: string | null
  current_value: number | null
  goal_description: string | null
  goal_title: string
  goal_type: string
  id: string
  status: string | null
  target_date: string | null
  target_metric: string | null
  target_value: number | null
  updated_at: string | null

## reading_passages (13 columns)
  age_max: number | null
  age_min: number | null
  content: string
  created_at: string | null
  difficulty_level: number
  genre: string | null
  id: string
  is_active: boolean | null
  skills_targeted: string[] | null
  source: string | null
  theme: string | null
  title: string
  word_count: number | null

## reading_ranks (10 columns)
  badge_color: string
  celebration_message: string
  created_at: string | null
  emoji: string
  encouragement_message: string
  id: string
  max_score: number
  min_score: number
  rank_name: string
  sort_order: number

## reading_skills (13 columns)
  age_appropriate_from: number | null
  age_appropriate_to: number | null
  category: string
  common_issues: string | null
  created_at: string | null
  description: string | null
  difficulty_order: number | null
  id: string
  practice_activities: string[] | null
  skill_code: string
  skill_name: string
  subcategory: string | null
  teaching_tips: string | null

## recall_bot_sessions (21 columns)
  actual_join_time: string | null
  audio_url: string | null
  bot_id: string
  child_id: string | null
  coach_id: string | null
  created_at: string | null
  duration_seconds: number | null
  error_message: string | null
  id: string
  last_status_change: string | null
  leave_time: string | null
  meeting_url: string | null
  metadata: Json | null
  processing_completed_at: string | null
  recording_url: string | null
  scheduled_join_time: string | null
  session_id: string | null
  status: string | null
  status_history: Json | null
  transcript_url: string | null
  updated_at: string | null

## recall_reconciliation_logs (6 columns)
  bot_id: string | null
  created_at: string | null
  error_message: string | null
  id: string
  session_id: string | null
  status: string | null

## referral_credit_transactions (12 columns)
  amount: number
  balance_after: number
  coupon_usage_id: string | null
  created_at: string | null
  description: string
  elearning_subscription_id: string | null
  enrollment_id: string | null
  group_class_registration_id: string | null
  id: string
  parent_id: string
  referred_child_id: string | null
  type: string

## referral_visits (9 columns)
  coach_id: string | null
  converted: boolean | null
  converted_child_id: string | null
  created_at: string | null
  id: string
  landing_page: string | null
  referral_code: string
  user_agent: string | null
  visitor_ip: string | null

## revenue_split_config (14 columns)
  coach_cost_percent: number
  created_at: string | null
  created_by: string | null
  effective_from: string
  id: string
  is_active: boolean | null
  lead_cost_percent: number
  notes: string | null
  payout_day_of_month: number | null
  payout_frequency: string
  platform_fee_percent: number
  tds_rate_percent: number
  tds_threshold_annual: number
  updated_at: string | null

## scheduled_sessions (106 columns)
  action_items: string | null
  ai_analysis: Json | null
  ai_summary: string | null
  attendance_count: number | null
  attendance_summary: Json | null
  audio_storage_path: string | null
  audio_url: string | null
  book_id: string | null
  bot_error_at: string | null
  bot_error_reason: string | null
  breakthrough_moment: string | null
  cal_booking_id: string | null
  child_id: string | null
  coach_id: string | null
  coach_notes: string | null
  coach_reminder_1h_sent: boolean | null
  coach_reminder_1h_sent_at: string | null
  coach_reminder_24h_sent: boolean | null
  coach_reminder_24h_sent_at: string | null
  completed_at: string | null
  concern_details: string | null
  concerns_noted: string | null
  concerns_raised: string[] | null
  confidence_level: number | null
  created_at: string | null
  duration_minutes: number
  duration_seconds: number | null
  engagement_level: number | null
  enrollment_id: string | null
  escalate_to_admin: boolean | null
  failure_reason: string | null
  feedback_submitted_at: string | null
  flag_reason: string | null
  flagged_for_attention: boolean | null
  focus_area: string | null
  follow_up_date: string | null
  follow_up_needed: boolean | null
  google_event_id: string | null
  google_meet_link: string | null
  home_helpers: string[] | null
  home_practice_frequency: string | null
  homework_assigned: boolean | null
  homework_description: string | null
  homework_due_date: string | null
  homework_topic: string | null
  id: string
  is_group_session: boolean | null
  is_makeup_session: boolean | null
  last_attempt_at: string | null
  next_retry_at: string | null
  next_session_focus: string[] | null
  no_show_detected_at: string | null
  no_show_reason: string | null
  parent_change_status: string | null
  parent_communication_needed: boolean | null
  parent_feedback: string | null
  parent_sees_progress: string | null
  parent_sentiment: string | null
  parent_summary: string | null
  parent_update_needed: boolean | null
  parent_update_sent_at: string | null
  partial_reason: string | null
  prep_content_ids: string[] | null
  prep_notes: string | null
  progress_rating: number | null
  quiz_assigned: boolean | null
  quiz_assigned_id: string | null
  quiz_topic: string | null
  rating_overall: number | null
  recall_bot_id: string | null
  recall_status: string | null
  recording_processed_at: string | null
  recording_url: string | null
  remedial_trigger_source: string | null
  reminder_sent: boolean | null
  request_id: string | null
  scheduled_date: string
  scheduled_time: string
  scheduling_attempts: number | null
  session_highlights: Json | null
  session_notes: string | null
  session_number: number | null
  session_struggles: Json | null
  session_subtype: string | null
  session_timer_seconds: number | null
  session_title: string | null
  session_type: string
  skills_improved: string[] | null
  skills_need_work: string[] | null
  skills_worked_on: string[] | null
  slot_match_type: string | null
  started_at: string | null
  status: string | null
  title: string | null
  tldv_ai_summary: string | null
  tldv_meeting_id: string | null
  tldv_processed_at: string | null
  tldv_recording_url: string | null
  tldv_transcript: string | null
  transcript: string | null
  updated_at: string | null
  video_expires_at: string | null
  video_url: string | null
  voice_note_transcript: string | null
  voice_note_url: string | null
  week_number: number | null

## scheduling_queue (10 columns)
  assigned_to: string | null
  attempts_made: number | null
  created_at: string | null
  enrollment_id: string | null
  id: string
  reason: string
  resolution_notes: string | null
  resolved_at: string | null
  session_id: string | null
  status: string | null

## session_change_requests (17 columns)
  change_type: string
  child_id: string | null
  created_at: string | null
  enrollment_id: string
  hours_notice: number | null
  id: string
  initiated_by: string
  original_datetime: string
  processed_at: string | null
  processed_by: string | null
  reason: string | null
  reason_category: string | null
  rejection_reason: string | null
  requested_new_datetime: string | null
  session_id: string
  status: string | null
  updated_at: string | null

## session_duration_rules (7 columns)
  created_at: string | null
  duration_minutes: number
  id: string
  is_active: boolean | null
  max_age: number
  min_age: number
  session_type: string | null

## session_holds (13 columns)
  child_id: string | null
  coach_id: string
  converted_to_session_id: string | null
  created_at: string | null
  duration_minutes: number
  expires_at: string | null
  held_at: string | null
  id: string
  parent_email: string | null
  session_type: string | null
  slot_date: string
  slot_time: string
  status: string | null

## session_incidents (16 columns)
  admin_notes: string | null
  child_id: string | null
  coach_id: string
  coach_response: string | null
  created_at: string | null
  detected_at: string
  id: string
  incident_type: string
  parent_communication_notes: string | null
  parent_notified_at: string | null
  resolution: string | null
  resolved_at: string | null
  resolved_by: string | null
  response_received_at: string | null
  score_penalty: number | null
  session_id: string

## session_intelligence_summary (10 columns)
  avg_duration_minutes: number | null
  bot_errors: number | null
  coach_no_shows: number | null
  completed: number | null
  completion_rate: number | null
  flagged_sessions: number | null
  no_shows: number | null
  partial_sessions: number | null
  total_sessions: number | null
  week_start: string | null

## session_notes (11 columns)
  areas_to_improve: string | null
  child_id: string | null
  coach_id: string | null
  created_at: string | null
  highlights: string | null
  homework_assigned: string | null
  id: string
  notes: string
  parent_feedback: string | null
  session_id: string | null
  updated_at: string | null

## session_recording_status (12 columns)
  bot_id: string | null
  bot_status: string | null
  child_name: string | null
  coach_name: string | null
  duration_seconds: number | null
  error_message: string | null
  recording_url: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  session_id: string | null
  session_status: string | null
  session_type: string | null

## session_templates (9 columns)
  created_at: string | null
  duration_minutes: number | null
  id: string
  is_active: boolean | null
  session_type: string
  structure: Json
  target_age_group: string | null
  template_name: string
  tips: string[] | null

## site_settings (10 columns)
  ab_test_enabled: boolean | null
  ab_test_name: string | null
  ab_test_split: number | null
  category: string
  description: string | null
  id: string
  key: string
  updated_at: string | null
  updated_by: string | null
  value: Json

## skill_tags_master (8 columns)
  category: string
  created_at: string | null
  description: string | null
  display_order: number | null
  id: string
  is_active: boolean | null
  tag_name: string
  tag_slug: string

## support_ticket_summary (6 columns)
  count: number | null
  newest_ticket: string | null
  oldest_ticket: string | null
  priority: string | null
  status: string | null
  user_type: string | null

## support_tickets (17 columns)
  assigned_to: string | null
  category: string
  child_name: string | null
  coach_name: string | null
  created_at: string | null
  description: string
  id: string
  priority: string | null
  resolution_notes: string | null
  resolved_at: string | null
  status: string | null
  subject: string | null
  ticket_number: string | null
  updated_at: string | null
  user_email: string
  user_name: string | null
  user_type: string

## system_schedule_defaults (7 columns)
  created_at: string | null
  day_of_week: number
  description: string | null
  end_time: string
  id: string
  is_available: boolean | null
  start_time: string

## tds_ledger (16 columns)
  challan_number: string | null
  coach_id: string
  coach_name: string | null
  coach_pan: string | null
  created_at: string | null
  deposit_date: string | null
  deposited: boolean | null
  financial_year: string
  gross_amount: number
  id: string
  payout_id: string | null
  quarter: string
  section: string | null
  tds_amount: number
  tds_rate: number
  updated_at: string | null

## termination_logs (13 columns)
  amount_paid: number | null
  child_id: string | null
  coach_id: string | null
  coach_settlement: number | null
  created_at: string | null
  enrollment_id: string | null
  id: string
  platform_settlement: number | null
  refund_amount: number | null
  sessions_completed: number | null
  sessions_remaining: number | null
  terminated_by: string | null
  termination_reason: string | null

## testimonials (13 columns)
  child_age: number | null
  child_name: string | null
  created_at: string | null
  display_order: number | null
  id: string
  image_url: string | null
  is_active: boolean | null
  is_featured: boolean | null
  parent_location: string | null
  parent_name: string
  rating: number | null
  testimonial_text: string
  updated_at: string | null

## time_buckets (8 columns)
  default_enabled: boolean | null
  display_name: string
  emoji: string | null
  end_hour: number
  id: string
  name: string
  sort_order: number | null
  start_hour: number

## upcoming_group_sessions (21 columns)
  age_max: number | null
  age_min: number | null
  book_cover: string | null
  book_title: string | null
  class_type_name: string | null
  class_type_slug: string | null
  color_hex: string | null
  current_participants: number | null
  duration_minutes: number | null
  google_meet_link: string | null
  icon_emoji: string | null
  id: string | null
  instructor_name: string | null
  instructor_photo: string | null
  max_participants: number | null
  price_inr: number | null
  scheduled_date: string | null
  scheduled_time: string | null
  spots_available: number | null
  status: string | null
  title: string | null

## update_communication_analytics (0 columns)

## update_daily_goal_progress (0 columns)

## update_streak (0 columns)

## v_remedial_eligibility (12 columns)
  child_id: string | null
  child_name: string | null
  coach_email: string | null
  coach_id: string | null
  coach_name: string | null
  enrollment_id: string | null
  parent_email: string | null
  parent_phone: string | null
  remedial_remaining: number | null
  remedial_sessions_max: number | null
  remedial_sessions_used: number | null
  remedial_status: string | null

## verification_rate_limit (3 columns)
  identifier: string | null
  identifier_type: string | null
  tokens_last_hour: number | null

## verification_tokens (10 columns)
  attempts: number | null
  created_at: string | null
  expires_at: string
  id: string
  identifier: string
  identifier_type: string
  max_attempts: number | null
  purpose: string
  token_hash: string
  verified_at: string | null

## video_details (29 columns)
  age_range: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string | null
  description: string | null
  display_order: number | null
  duration_seconds: number | null
  has_quiz: boolean | null
  id: string | null
  is_active: boolean | null
  is_free: boolean | null
  key_concepts: string[] | null
  level_name: string | null
  level_slug: string | null
  module_id: string | null
  module_name: string | null
  module_slug: string | null
  published_at: string | null
  quiz_count: number | null
  quiz_pass_percentage: number | null
  slug: string | null
  status: string | null
  thumbnail_url: string | null
  title: string | null
  transcript: string | null
  updated_at: string | null
  video_id: string | null
  video_source: string | null
  video_url: string | null

## video_quizzes (11 columns)
  correct_option_id: string
  created_at: string | null
  display_order: number
  explanation: string | null
  id: string
  options: Json
  points: number | null
  question_text: string
  question_type: string | null
  updated_at: string | null
  video_id: string | null

## video_watch_sessions (12 columns)
  child_id: string | null
  device_type: string | null
  end_position_seconds: number | null
  id: string
  pauses: number | null
  replays: number | null
  seeks: number | null
  session_end: string | null
  session_start: string | null
  start_position_seconds: number | null
  user_agent: string | null
  video_id: string | null

## waitlist_stats (7 columns)
  converted: number | null
  first_signup: string | null
  latest_signup: string | null
  notified: number | null
  pending: number | null
  product_slug: string | null
  total_signups: number | null

## wcpm_benchmarks (11 columns)
  assessment_period: string
  created_at: string | null
  grade_level: number
  id: string
  percentile_10: number | null
  percentile_25: number | null
  percentile_50: number | null
  percentile_75: number | null
  percentile_90: number | null
  source: string | null
  year: number | null

## whatsapp_templates (9 columns)
  category: string
  created_at: string | null
  id: string
  is_active: boolean | null
  name: string
  slug: string
  template: string
  updated_at: string | null
  variables: Json | null

## xp_levels (5 columns)
  icon: string | null
  level: number
  perks: Json | null
  title: string | null
  xp_required: number

