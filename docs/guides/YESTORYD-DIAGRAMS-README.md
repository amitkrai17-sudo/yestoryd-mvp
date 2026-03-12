# YESTORYD Process Diagrams - Complete Package

## 📁 Files Included

| File | Purpose | Best For |
|------|---------|----------|
| `yestoryd-sequence-diagram.mermaid` | **Business View** - High-level process flow | Stakeholders, Investors, Team |
| `yestoryd-technical-sequence.mermaid` | **Technical View** - API calls, database ops | Developers, Technical Reference |
| `yestoryd-swimlane-business.mermaid` | **Flowchart View** - Alternative business layout | Presentations |
| `yestoryd-swimlane-technical.mermaid` | **Flowchart View** - Alternative technical layout | Architecture Docs |

---

## 🌐 FREE Platforms to Render Mermaid Diagrams

### 1. **Mermaid Live Editor** (RECOMMENDED)
- **URL:** https://mermaid.live
- **How to use:**
  1. Go to https://mermaid.live
  2. Clear the default code
  3. Paste any `.mermaid` file content
  4. Diagram renders instantly on right panel
  5. Click **Actions** → **Export as PNG/SVG**
- **Features:** Real-time preview, export options, shareable links
- **Best for:** Quick edits, sharing, exporting images

### 2. **GitHub** (For Documentation)
- **How to use:**
  1. Create a `.md` file in your repo
  2. Add mermaid code block:
  ```markdown
  ```mermaid
  <paste diagram code here>
  ```
  ```
  3. GitHub renders it automatically
- **Best for:** Technical documentation, README files

### 3. **Notion** (For Team Collaboration)
- **How to use:**
  1. Create a new page
  2. Type `/code` and select "Code Block"
  3. Change language to "Mermaid"
  4. Paste diagram code
- **Best for:** Team wikis, process documentation

### 4. **Confluence** (Enterprise)
- **How to use:**
  1. Install "Mermaid Diagrams" app from Marketplace
  2. Insert Mermaid macro
  3. Paste code
- **Best for:** Enterprise documentation

### 5. **VS Code** (Local Development)
- **Extension:** "Markdown Preview Mermaid Support"
- **How to use:**
  1. Install extension
  2. Open `.md` file with mermaid code
  3. Preview shows rendered diagram
- **Best for:** Local editing, version control

---

## 📊 Diagram Phases Explained

### Business Sequence Diagram - 8 Phases

| Phase | Color | Description |
|-------|-------|-------------|
| **1. Lead Acquisition** | Pink | Website → Assessment → AI Analysis → Certificate |
| **2. Discovery Booking** | Blue | Results → Book Call → Cal.com → CRM |
| **3. Coach Assignment** | Purple | Admin assigns coach in CRM |
| **4. Discovery Call** | Yellow | Call execution → Questionnaire → Follow-up if no-show |
| **5. Payment & Enrollment** | Green | Razorpay → 9 sessions scheduled → Coach intro |
| **6. Service Delivery** | Pink | 6 coaching + 3 check-ins + Vedant AI |
| **7. Program Completion** | Blue | Exit assessment → Certificate or Renewal |
| **8. Retention & Community** | Purple | Renewal → Community → Master Key events |

### Technical Sequence Diagram - Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `children` | Lead/Student data | name, age, score, lead_status |
| `parents` | Parent accounts | email, phone, name |
| `discovery_calls` | Discovery call tracking | status, coach_id, questionnaire_data |
| `coaches` | Coach profiles | email, name, calendar_id |
| `enrollments` | Active enrollments | child_id, coach_id, start_date, status |
| `scheduled_sessions` | Session calendar | scheduled_date, meet_link, status |
| `bookings` | Payment records | amount, razorpay_order_id, status |
| `learning_events` | Progress tracking (JSONB) | event_type, event_data |
| `site_settings` | Dynamic content | key, value |

---

## 🔄 Process Summary

```
ENTRY POINTS
├── yestoryd.com (organic/ads)
├── Direct booking link
├── WhatsApp shared link
└── Coach subdomain (future)
        ↓
ASSESSMENT (FREE)
├── Child reads passage aloud
├── Gemini AI analyzes: Clarity, Fluency, Speed
├── Lead captured in 'children' table
└── Certificate emailed
        ↓
DISCOVERY CALL
├── Parent books via Cal.com
├── Admin assigns coach
├── Coach conducts 30-min call
├── Questionnaire filled
└── If no-show: 24hr follow-up (once)
        ↓
PAYMENT (₹5,999)
├── Razorpay processes
├── 9 sessions auto-scheduled (Google Calendar)
├── Coach introduction (WhatsApp + Email)
└── Revenue split: 50-50 or 70-30
        ↓
SERVICE DELIVERY (3 months)
├── 6 coaching sessions (tl;dv records)
├── 3 parent check-ins (Week 4, 8, 12)
├── AI summaries → Parent dashboard
└── Vedant AI RAG chat available
        ↓
COMPLETION
├── Exit assessment
├── Pass → Completion Certificate
├── Fail → Recommend another term
└── Either → Renewal offer
        ↓
RETENTION
├── Join Parent Community
├── Access Master Key events (free)
└── Register for workshops/e-learning
```

---

## 📱 Quick Access Links

| Platform | Link |
|----------|------|
| **Mermaid Live** | https://mermaid.live |
| **Mermaid Docs** | https://mermaid.js.org/syntax/sequenceDiagram.html |
| **GitHub Mermaid** | https://github.blog/2022-02-14-include-diagrams-markdown-files-mermaid/ |

---

## 💡 Tips for Best Results

1. **For Presentations:** Export as PNG from Mermaid Live, set zoom to 150%
2. **For Documentation:** Use GitHub or Notion for live rendering
3. **For Editing:** Use Mermaid Live for real-time preview
4. **For Printing:** Export as SVG for scalable quality
5. **Color Customization:** Edit the `rect rgb()` values in the code

---

## 📝 Updating the Diagrams

When Yestoryd process changes:

1. Open the relevant `.mermaid` file
2. Find the phase that changed
3. Update the participant actions
4. Preview in Mermaid Live
5. Export and replace in documentation

**Version:** 1.0
**Last Updated:** December 17, 2025
**Author:** Yestoryd Tech Team
