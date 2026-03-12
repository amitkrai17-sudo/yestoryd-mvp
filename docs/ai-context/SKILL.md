# Google Calendar Skill

Query and manage Yestoryd's Google Calendar for coaching sessions, discovery calls, and scheduling.

## Setup
```bash
cd ~/.openclaw/workspace/skills/google-calendar
npm install googleapis
```

## Commands

### View Sessions
- `today_sessions` — All sessions happening today
- `tomorrow_sessions` — All sessions tomorrow
- `week_sessions` — All sessions this week (Mon-Sun)
- `next_week_sessions` — All sessions next week

### Coach-Specific
- `coach_schedule <coach_email>` — A specific coach's upcoming sessions
- `coach_today <coach_email>` — A specific coach's sessions today
- `coaches_today` — All coaches' sessions today (grouped)

### Search & Lookup
- `session_search <query>` — Search events by parent/child name
- `event_details <event_id>` — Full details of a specific event

### Availability
- `free_slots <date> <coach_email>` — Available 1-hour slots for a coach on a date
- `free_slots_week <coach_email>` — Available slots for the whole week

### Create & Modify
- `create_session <date> <time> <coach_email> <parent_email> <summary>` — Create a new coaching session with Google Meet
- `cancel_event <event_id>` — Cancel an event
- `reschedule_event <event_id> <new_date> <new_time>` — Reschedule an event

## Usage Examples
```
> today_sessions
> coach_schedule rucha@yestoryd.com
> free_slots 2026-02-10 rucha@yestoryd.com
> session_search Sharma
> create_session 2026-02-10 16:00 rucha@yestoryd.com parent@gmail.com "Coaching Session - Aarav Sharma"
```

## Notes
- All times are in IST (Asia/Kolkata)
- Service account: yestoryd-calendar@yestoryd-platform.iam.gserviceaccount.com
- Delegated user: engage@yestoryd.com
- Sessions include Google Meet links automatically
- engage@yestoryd.com is always added as attendee (for Recall.ai recording)
