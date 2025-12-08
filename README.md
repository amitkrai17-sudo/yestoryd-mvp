# Yestoryd Platform - MVP

AI-powered reading assessment and coaching platform with white-label coach pages.

## Features

- **AI Reading Assessment**: Gemini-powered analysis of children's reading
- **Personalized Coaching**: 1-on-1 sessions with expert coaches
- **Coach Marketplace**: White-label pages for coaches (subdomain.yestoryd.com)
- **Revenue Split**: Automated 70/30 split between coaches and platform
- **Service Access Control**: Coaching clients unlock all services free

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Google Workspace (Sheets, Calendar, Gmail, Drive)
- **AI**: Google Gemini 2.0 Flash
- **Payments**: Razorpay
- **Deployment**: Vercel

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:
```bash
cp .env.example .env.local
```

Fill in the required values (see Configuration section below).

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the platform.

### 4. Test Coach Pages

In development, use query params to test coach subdomains:
```
http://localhost:3000?coach=rucha
http://localhost:3000/assessment?coach=rucha
```

## Configuration

### Google Workspace Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project: "Yestoryd Platform"

2. **Enable APIs**
   - Google Sheets API
   - Google Calendar API
   - Gmail API
   - Google Drive API

3. **Create Service Account**
   - IAM & Admin → Service Accounts → Create
   - Download JSON key
   - Extract `client_email` and `private_key` for `.env.local`

4. **Create Google Sheet Database**
   - Create a new Google Sheet
   - Add these tabs (sheets):
     - Coaches
     - Parents
     - Students
     - Assessments
     - Bookings
     - Sessions
     - Payments
   - Share with service account email (Editor permission)
   - Copy Sheet ID from URL

### Gemini API Setup

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Add to `.env.local` as `GEMINI_API_KEY`

### Razorpay Setup

1. Create account at [Razorpay](https://razorpay.com)
2. Get API keys from Dashboard → Settings → API Keys
3. Create webhook endpoint: `https://yestoryd.com/api/payment/webhook`
4. Add keys to `.env.local`

## Database Schema

### Coaches Sheet
| Column | Description |
|--------|-------------|
| coachId | Unique identifier |
| name | Full name |
| email | Email address |
| phone | Phone number |
| specialization | Areas of expertise |
| ageGroups | Target ages (e.g., "4-8") |
| availability | Schedule |
| status | active/inactive |
| subdomain | For coach pages |

### Students Sheet
| Column | Description |
|--------|-------------|
| studentId | Unique identifier |
| childName | Child's name |
| age | Current age |
| parentId | Reference to Parents |
| coachId | Assigned coach |
| source | Where they came from |
| assignmentType | auto_rucha/direct/rucha_assigned |

### Assessments Sheet
| Column | Description |
|--------|-------------|
| assessmentId | Unique identifier |
| studentId | Reference to Students |
| score | 1-10 rating |
| wpm | Words per minute |
| fluency | Poor/Fair/Good/Excellent |
| geminiAnalysis | Full AI analysis (JSON) |

### Payments Sheet
| Column | Description |
|--------|-------------|
| paymentId | Unique identifier |
| studentId | Reference to Students |
| coachId | Reference to Coaches |
| amount | Total amount |
| coachShare | 70% to coach |
| yestorydShare | 30% to platform |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Custom Domain Setup

1. Add domain in Vercel: `yestoryd.com`
2. Add DNS records at registrar:
   ```
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   CNAME *     cname.vercel-dns.com
   ```
3. Wait for DNS propagation

## Folder Structure

```
yestoryd-mvp/
├── app/
│   ├── page.tsx              # Homepage
│   ├── assessment/
│   │   └── page.tsx          # Assessment form
│   │   └── results/[id]/     # Results page
│   ├── coach/
│   │   └── [subdomain]/      # Coach landing pages
│   └── api/
│       ├── assessment/analyze/
│       └── payment/
├── components/
│   ├── ui/                   # UI components
│   ├── assessment/           # Assessment components
│   ├── coach/               # Coach components
│   └── shared/              # Header, Footer, etc.
├── lib/
│   ├── google/              # Google API clients
│   ├── gemini/              # Gemini AI client
│   ├── razorpay/            # Payment client
│   └── utils/               # Utilities
└── middleware.ts            # Subdomain routing
```

## Revenue Model

```
COACHING PAYMENTS:
- Coach receives: 70%
- Platform receives: 30%

SPECIAL CASE - Rucha (Founder):
- As coach: 70%
- As platform owner: 30%
- Total: 100% when she coaches
```

## License

Private - Yestoryd © 2024
