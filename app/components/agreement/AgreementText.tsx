// file: app/components/agreement/AgreementText.tsx
// Full agreement text with dynamic variables from database
// Usage: <AgreementText config={agreementConfig} coachName="John" />

'use client';

import { useMemo } from 'react';

interface AgreementConfig {
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_website: string;
  lead_cost_percent: string;
  coach_cost_percent: string;
  platform_fee_percent: string;
  tds_rate_standard: string;
  tds_rate_no_pan: string;
  tds_threshold: string;
  tds_section: string;
  payout_day: string;
  cancellation_notice_hours: string;
  termination_notice_days: string;
  no_show_wait_minutes: string;
  non_solicitation_months: string;
  liquidated_damages: string;
  liquidated_damages_multiplier: string;
  agreement_version: string;
  agreement_effective_date: string;
}

interface AgreementTextProps {
  config: AgreementConfig;
  coachName?: string;
  coachAddress?: string;
  currentDate?: string;
}

// Helper to format currency
const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

// Helper to convert number to words (simplified for Indian numbering)
const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
};

export default function AgreementText({ config, coachName = '_______________', coachAddress = '_______________', currentDate }: AgreementTextProps) {
  
  const formattedDate = currentDate || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calculate coach earnings for different scenarios
  const yestorydLeadPercent = parseInt(config.coach_cost_percent);
  const coachLeadPercent = parseInt(config.coach_cost_percent) + parseInt(config.lead_cost_percent);

  return (
    <div className="agreement-text prose prose-sm max-w-none text-gray-800 leading-relaxed">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-purple-800 mb-1">{config.company_name}</h1>
        <p className="text-sm text-gray-500 italic">AI-Powered Reading Intelligence Platform</p>
        <div className="border-b-2 border-gray-300 w-48 mx-auto mt-4"></div>
      </div>

      <h2 className="text-xl font-bold text-center mb-6">COACH SERVICE & PLATFORM USAGE AGREEMENT</h2>

      {/* Preamble */}
      <p className="mb-4">
        This Agreement is made on this <strong>{formattedDate}</strong> at Navi Mumbai, Maharashtra.
      </p>

      <p className="font-semibold mb-2">BETWEEN:</p>
      
      <p className="ml-4 mb-4">
        <strong>{config.company_name}</strong>, a Limited Liability Partnership incorporated under the Limited Liability Partnership Act, 2008, 
        having its registered office at <strong>{config.company_address}</strong>, India 
        (hereinafter referred to as the "<strong>Company</strong>" or "<strong>Platform</strong>", which expression shall include its successors and assigns);
      </p>

      <p className="text-center font-semibold mb-2">AND</p>

      <p className="ml-4 mb-6">
        <strong>{coachName}</strong>, an individual/sole proprietor residing at <strong>{coachAddress}</strong> 
        (hereinafter referred to as the "<strong>Coach</strong>" or "<strong>Service Provider</strong>").
      </p>

      <p className="mb-4">The Company and Coach are individually referred to as "Party" and collectively as "Parties".</p>

      {/* Recitals */}
      <p className="font-semibold mb-2">RECITALS:</p>
      <ol className="list-[lower-alpha] ml-6 mb-6 space-y-2">
        <li>WHEREAS, Yestoryd operates an AI-powered reading intelligence platform that combines advanced technology (including AI-powered assessments) with human coaching expertise to deliver comprehensive reading improvement programs for children aged 4-12 years;</li>
        <li>WHEREAS, the Coach possesses the skills, experience, and commitment required to deliver high-quality reading coaching services to children;</li>
        <li>WHEREAS, the Parties wish to enter into an arrangement for the delivery of coaching services on the terms and conditions set forth herein.</li>
      </ol>

      <p className="mb-6">NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter set forth, the Parties agree as follows:</p>

      {/* Section 1 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">1. RELATIONSHIP & SCOPE OF SERVICES</h3>
      
      <p className="bg-gray-100 p-3 rounded text-sm italic mb-4">
        📋 This clause establishes the Coach as an Independent Contractor, NOT an employee.
      </p>

      <h4 className="font-semibold mb-2">1.1 Independent Contractor Status</h4>
      <p className="mb-4">
        The Coach is engaged strictly as an Independent Contractor on a non-exclusive basis. Nothing in this Agreement 
        shall be construed to create an employer-employee, partnership, joint venture, or agency relationship between the Company and the Coach.
      </p>

      <h4 className="font-semibold mb-2">1.2 No Labor Law Benefits</h4>
      <p className="mb-2">
        <span className="text-red-600 font-semibold">IMPORTANT:</span> The Coach expressly acknowledges and agrees that they are 
        <strong> NOT entitled to any employment benefits</strong>, including but not limited to:
      </p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Provident Fund (PF) contributions</li>
        <li>Employee State Insurance (ESIC)</li>
        <li>Gratuity or Bonus payments</li>
        <li>Paid leave, sick leave, or vacation benefits</li>
        <li>Any other statutory or non-statutory employee benefits</li>
      </ul>

      <h4 className="font-semibold mb-2">1.3 Scope of Services</h4>
      <p className="mb-4">
        The Coach shall provide reading fluency coaching and related educational services ("Services") to students ("Users") 
        enrolled on the Yestoryd Platform, adhering strictly to the curriculum and methodologies prescribed by the Company.
      </p>

      <h4 className="font-semibold mb-2">1.4 Non-Exclusivity</h4>
      <p className="mb-4">
        This Agreement is non-exclusive. The Coach may provide similar services to other organizations, provided such activities 
        do not conflict with obligations under this Agreement or involve solicitation of Yestoryd's Users.
      </p>

      {/* Section 2 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">2. INTELLECTUAL PROPERTY RIGHTS</h3>
      
      <p className="bg-gray-100 p-3 rounded text-sm italic mb-4">
        🔒 This clause protects Yestoryd's proprietary curriculum, AI models, and platform technology.
      </p>

      <h4 className="font-semibold mb-2">2.1 Company Ownership</h4>
      <p className="mb-2">The Company retains all rights, title, and interest in and to:</p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>The Yestoryd Curriculum, including all phonics modules, lesson plans, and teaching methodologies</li>
        <li>Platform technology, AI models, assessment tools, and software interfaces</li>
        <li>Brand name, logos, trademarks, and marketing materials</li>
        <li>All teaching aids, worksheets, and materials provided to the Coach</li>
      </ul>

      <h4 className="font-semibold mb-2">2.2 Work for Hire</h4>
      <p className="mb-4">
        Any content created by the Coach specifically for the Platform (including but not limited to recorded sessions, feedback notes, 
        customized worksheets, progress reports) shall be deemed "<strong>Work Made for Hire</strong>" under the Copyright Act, 1957, 
        and ownership shall vest <strong>immediately and exclusively</strong> with {config.company_name}.
      </p>

      <h4 className="font-semibold mb-2">2.3 Limited License to Coach</h4>
      <p className="mb-4">
        The Company grants the Coach a limited, revocable, non-transferable, non-sublicensable license to use the Company's materials 
        solely for the purpose of delivering Services to Yestoryd Users. This license terminates automatically upon termination of this Agreement.
      </p>

      <h4 className="font-semibold mb-2">2.4 Session Recordings</h4>
      <p className="mb-2">
        The Coach hereby consents to the recording of all coaching sessions via the Platform's integrated recording system for the purposes of:
      </p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Quality assurance and service improvement</li>
        <li>Child safety verification</li>
        <li>AI-powered session analysis and progress tracking</li>
        <li>Coach training and development</li>
      </ul>
      <p className="mb-4">The Company owns these recordings exclusively and may use them for any lawful business purpose.</p>

      <h4 className="font-semibold mb-2">2.5 Marketing & Publicity Rights</h4>
      <p className="mb-2">
        <strong>(a) License Grant:</strong> The Coach grants the Company a worldwide, perpetual, royalty-free, non-exclusive license 
        to use their name, photograph, profile video, bio, and testimonials on the Platform, website, social media channels, and 
        advertising campaigns to promote Yestoryd services.
      </p>
      <p className="mb-2">
        <strong>(b) Permitted Uses:</strong> The Company may feature the Coach in marketing materials including but not limited to: 
        website coach profiles, social media posts (Instagram, Facebook, LinkedIn, YouTube), email campaigns, video advertisements, 
        print materials, and press releases.
      </p>
      <p className="mb-2">
        <strong>(c) Removal Request:</strong> The Coach may request removal of specific marketing materials featuring them by written notice, 
        and the Company shall use reasonable efforts to remove such materials within 30 days (except for materials already in physical 
        circulation, archived content, or third-party platforms beyond the Company's control).
      </p>
      <p className="mb-4">
        <strong>(d) Survival:</strong> This license shall survive termination of the Agreement for materials created during the term of the Agreement.
      </p>

      {/* Section 3 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">3. REVENUE SHARING & COMPENSATION</h3>
      
      <p className="bg-gray-100 p-3 rounded text-sm italic mb-4">
        💰 Revenue is calculated on NET basis after deducting GST and gateway charges.
      </p>

      <h4 className="font-semibold mb-2">3.1 Revenue Model Overview</h4>
      <p className="mb-4">
        The Company and Coach agree to a revenue-sharing model based on the Net Revenue generated from coaching engagements. 
        The Program Fee collected from parents is divided into three components:
      </p>

      {/* Revenue Table */}
      <table className="w-full border-collapse mb-4 text-sm">
        <thead>
          <tr className="bg-purple-800 text-white">
            <th className="border p-2 text-left">Component</th>
            <th className="border p-2 text-center">Default %</th>
            <th className="border p-2 text-left">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-white">
            <td className="border p-2">Lead Cost</td>
            <td className="border p-2 text-center">{config.lead_cost_percent}%</td>
            <td className="border p-2">Paid to whoever sourced the lead (Company or Coach)</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="border p-2">Coach Cost</td>
            <td className="border p-2 text-center">{config.coach_cost_percent}%</td>
            <td className="border p-2">Paid to Coach for delivering coaching sessions</td>
          </tr>
          <tr className="bg-white">
            <td className="border p-2">Platform Fee</td>
            <td className="border p-2 text-center">{config.platform_fee_percent}%</td>
            <td className="border p-2">Retained by Company for platform services, technology, support</td>
          </tr>
        </tbody>
      </table>

      <h4 className="font-semibold mb-2">3.2 Coach Earnings by Lead Source</h4>
      
      <table className="w-full border-collapse mb-4 text-sm">
        <thead>
          <tr className="bg-pink-600 text-white">
            <th className="border p-2 text-left">Scenario</th>
            <th className="border p-2 text-center">Coach Receives</th>
            <th className="border p-2 text-center">Default Share</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-white">
            <td className="border p-2">Yestoryd-sourced Lead</td>
            <td className="border p-2 text-center">Coach Cost only</td>
            <td className="border p-2 text-center font-bold">{yestorydLeadPercent}% of Net Revenue</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="border p-2">Coach-sourced Lead (via Referral)</td>
            <td className="border p-2 text-center">Coach Cost + Lead Cost</td>
            <td className="border p-2 text-center font-bold">{coachLeadPercent}% of Net Revenue</td>
          </tr>
        </tbody>
      </table>

      <h4 className="font-semibold mb-2">3.3 Definition of Net Revenue</h4>
      <div className="bg-blue-50 p-3 rounded mb-4">
        <p className="mb-0">
          <strong>"Net Revenue"</strong> = (Gross Fee paid by Parent) <span className="text-red-600 font-bold">MINUS</span> (GST + Payment Gateway Charges + Platform Transaction Fees)
        </p>
      </div>

      <h4 className="font-semibold mb-2">3.4 Right to Modify Pricing & Revenue Share</h4>
      <p className="mb-2">
        <span className="text-red-600 font-semibold">IMPORTANT:</span> The Company reserves the right to modify the Program Fee 
        and Revenue Share percentages at any time. Such modifications shall:
      </p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Be communicated to Coach via email and/or Platform notification at least 15 days in advance</li>
        <li>Apply to NEW enrollments only (existing enrolled children continue at originally agreed terms)</li>
        <li>Be reflected on the Coach Dashboard, which serves as the authoritative source for current rates</li>
        <li>Not require formal amendment to this Agreement</li>
      </ul>
      <p className="mb-4">Continued provision of Services after such notification constitutes acceptance of the modified terms.</p>

      <h4 className="font-semibold mb-2">3.5 Payment Schedule</h4>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Payments shall be processed on the <strong>{config.payout_day}th</strong> of each calendar month</li>
        <li>Payments cover sessions completed in the previous calendar month</li>
        <li>Payments shall be made via bank transfer (NEFT/IMPS) to Coach's registered bank account</li>
        <li>Payment details and history shall be visible on the Coach Dashboard</li>
      </ul>

      <h4 className="font-semibold mb-2">3.6 Tax Deduction & Identification (Aadhaar/PAN Interchangeability)</h4>
      <p className="mb-2">
        <strong>(a) Primary ID & Signing:</strong> The Coach may use their valid Aadhaar Number for the purpose of identity verification 
        and digital signing (eSign) of this Agreement.
      </p>
      <p className="mb-2">
        <strong>(b) Aadhaar in Lieu of PAN:</strong> Pursuant to <strong>Section 139A(5E) of the Income Tax Act, 1961</strong>, 
        the Coach may quote their Aadhaar Number in lieu of a Permanent Account Number (PAN). The Company shall treat this as a valid 
        PAN quotation provided the Coach's Aadhaar is correctly linked to a valid PAN as per government records.
      </p>
      <p className="mb-2">
        <strong>(c) Validation & Higher TDS:</strong> The Company reserves the right to verify the Coach's Aadhaar-PAN linkage on the Income Tax Portal:
      </p>
      <ul className="list-disc ml-6 mb-2 space-y-1">
        <li><strong>If linkage is verified:</strong> TDS shall be deducted at the standard rate of <strong>{config.tds_rate_standard}% under Section {config.tds_section}</strong></li>
        <li><strong>If linkage is failed/invalid or Coach has no PAN:</strong> TDS shall be deducted at the penal rate of <strong>{config.tds_rate_no_pan}% under Section 206AA</strong> without further notice</li>
      </ul>
      <p className="mb-2">
        <strong>(d) TDS Threshold:</strong> TDS shall be applicable only when the Coach's aggregate payments exceed 
        <strong> {formatCurrency(config.tds_threshold)} ({numberToWords(parseInt(config.tds_threshold))} Rupees Only)</strong> in a financial year. 
        TDS certificates (Form 16A) shall be provided quarterly.
      </p>
      <div className="bg-red-50 p-3 rounded mb-4">
        <p className="mb-0">
          <strong>(e) Indemnity for Tax Default:</strong> The Coach agrees to indemnify and hold harmless the Company against any interest, 
          penalty, demand, or liability raised by tax authorities due to the invalidity, inoperability, or incorrect quotation of the 
          Coach's Aadhaar/PAN details.
        </p>
      </div>

      <h4 className="font-semibold mb-2">3.7 Refund Clawback</h4>
      <div className="bg-red-50 p-3 rounded mb-4">
        <p className="mb-0">
          ⚠️ In the event a User (parent) requests a refund due to Coach negligence, misconduct, or "No-Show" (missing a scheduled session 
          without valid reason), the Company reserves the right to deduct the corresponding payout amount from the Coach's future dues.
        </p>
      </div>

      <h4 className="font-semibold mb-2">3.8 Parent Cancellations & No-Shows</h4>
      <p className="mb-2">The following rules apply when a parent/child fails to attend a scheduled session:</p>
      <p className="mb-2">
        <strong>(a) Late Cancellation:</strong> If a User cancels a session with less than <strong>{config.cancellation_notice_hours} hours'</strong> notice, 
        the session shall be rescheduled within the same billing cycle at no additional cost to the parent. 
        Sessions cancelled with {config.cancellation_notice_hours} hours or more notice may be rescheduled freely.
      </p>
      <p className="mb-2">
        <strong>(b) User No-Show:</strong> If a User fails to join within 10 minutes of the scheduled start time ("No-Show"), 
        the Coach shall wait for a total of <strong>{config.no_show_wait_minutes} minutes</strong>, document the No-Show on the Platform, 
        and the session shall be marked as "Completed" for payout purposes at <strong>100% of the standard Coach Cost</strong>.
      </p>
      <p className="mb-2">
        <strong>(c) Cost Recovery:</strong> The Company reserves the right to recover the cost of No-Show sessions from the parent 
        by deducting from future session credits or as a deduction from any refund claims.
      </p>
      <p className="mb-4">
        <strong>(d) Chronic No-Shows:</strong> If a User has 3 or more No-Shows in any calendar month, the Company may terminate 
        the User's enrollment without refund of remaining sessions.
      </p>

      {/* Section 4 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">4. DATA PRIVACY & CHILD SAFETY</h3>
      
      <p className="bg-gray-100 p-3 rounded text-sm italic mb-4">
        🔐 Compliance with Digital Personal Data Protection Act, 2023 (DPDP Act)
      </p>

      <h4 className="font-semibold mb-2">4.1 Data Fiduciary & Data Processor Roles</h4>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li><strong>The Company acts as the Data Fiduciary</strong> under the DPDP Act, 2023</li>
        <li><strong>The Coach acts as a Data Processor</strong> and shall process student data ONLY for the purpose of delivering coaching services</li>
        <li>The Coach shall comply with all instructions from the Company regarding data handling</li>
      </ul>

      <h4 className="font-semibold mb-2">4.2 Prohibition on Data Storage</h4>
      <div className="bg-red-50 p-3 rounded mb-4">
        <p className="mb-0">
          <span className="text-red-600 font-bold">🚫 STRICTLY PROHIBITED:</span> The Coach shall NOT save, download, record, screenshot, 
          or store any personal data (including videos, photos, audio recordings, phone numbers, addresses) of students or parents 
          on ANY personal devices, cloud storage, or external media. All data must remain within the Platform's secure environment.
        </p>
      </div>

      <h4 className="font-semibold mb-2">4.3 No Direct Contact Outside Platform</h4>
      <div className="bg-red-50 p-3 rounded mb-4">
        <p className="mb-0">
          <span className="text-red-600 font-bold">🚫 STRICTLY PROHIBITED:</span> The Coach shall NOT contact students or parents 
          outside the Platform via personal WhatsApp, SMS, email, phone calls, social media, or any other communication channel 
          for ANY reason. All communication must occur through the Yestoryd Platform or official Yestoryd channels only.
        </p>
      </div>

      <h4 className="font-semibold mb-2">4.4 Child Safety Standards</h4>
      <p className="mb-2">The Coach shall strictly adhere to appropriate behavior standards during all interactions with children:</p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Maintain professional, age-appropriate language at all times</li>
        <li>Wear appropriate attire during video sessions</li>
        <li>Avoid discussion of sensitive, political, religious, or inappropriate topics</li>
        <li>Never use profanity, abusive language, or intimidating behavior</li>
        <li>Report any concerns about child welfare to the Company immediately</li>
      </ul>
      <div className="bg-red-50 p-3 rounded mb-4">
        <p className="mb-0">
          <span className="text-red-600 font-bold">⚠️ WARNING:</span> Any violation of child safety standards will result in 
          <strong> immediate termination</strong> and may be reported to law enforcement authorities if warranted.
        </p>
      </div>

      <h4 className="font-semibold mb-2">4.5 Confidential Information</h4>
      <p className="mb-2">The Coach acknowledges that the following constitute Confidential Information:</p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Personal information of children (name, age, learning data, assessment results)</li>
        <li>Parent contact details and communication records</li>
        <li>Company's curriculum, business information, pricing, and strategic plans</li>
        <li>Information about other coaches and their performance</li>
      </ul>

      <h4 className="font-semibold mb-2">4.6 Post-Termination Obligations</h4>
      <p className="mb-4">
        Confidentiality and data protection obligations under this Section shall survive termination of this Agreement indefinitely.
      </p>

      {/* Section 5 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">5. NON-SOLICITATION & NON-COMPETE</h3>
      
      <p className="bg-gray-100 p-3 rounded text-sm italic mb-4">
        🛡️ This clause prevents "poaching" of students for private coaching outside the Platform.
      </p>

      <h4 className="font-semibold mb-2">5.1 Non-Solicitation of Students</h4>
      <p className="mb-2">
        During the term of this Agreement and for a period of <strong>{config.non_solicitation_months} MONTHS</strong> thereafter, 
        the Coach shall NOT, directly or indirectly:
      </p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Solicit, induce, or encourage any current or former User (Student/Parent) of Yestoryd to leave the Platform</li>
        <li>Offer to provide private coaching or tuition services to any Yestoryd User outside the Platform</li>
        <li>Accept any request from a Yestoryd User for coaching services outside the Platform</li>
        <li>Share contact information obtained through the Platform for any purpose other than delivering Services</li>
      </ul>

      <h4 className="font-semibold mb-2">5.2 Liquidated Damages</h4>
      <div className="bg-red-50 p-3 rounded mb-4">
        <p className="mb-0">
          <span className="text-red-600 font-bold">💰 BREACH PENALTY:</span> In the event of a breach of Clause 5.1, the Coach agrees 
          to pay liquidated damages of <strong>{formatCurrency(config.liquidated_damages)} ({numberToWords(parseInt(config.liquidated_damages))} Rupees Only)</strong> OR 
          <strong> {config.liquidated_damages_multiplier} times the lifetime value</strong> of the solicited student, whichever is HIGHER.
        </p>
      </div>
      <p className="mb-4">
        The Coach acknowledges that this amount represents a genuine pre-estimate of the damages the Company would suffer from such breach.
      </p>

      {/* Section 6 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">6. REPRESENTATIONS, WARRANTIES & INDEMNITY</h3>

      <h4 className="font-semibold mb-2">6.1 Coach Representations</h4>
      <p className="mb-2">The Coach represents and warrants that:</p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>All information provided during onboarding is true, accurate, and complete</li>
        <li>The Coach has NO criminal record, particularly related to offenses against children</li>
        <li>The Coach is NOT a registered sex offender in any jurisdiction</li>
        <li>The Coach has the requisite academic qualifications as presented during onboarding</li>
        <li>The Coach has the legal right to work in India and provide services under this Agreement</li>
        <li>The Coach will maintain all necessary equipment (computer, webcam, microphone, stable internet) to deliver Services</li>
      </ul>

      <h4 className="font-semibold mb-2">6.2 Indemnification</h4>
      <p className="mb-2">
        The Coach agrees to indemnify, defend, and hold harmless {config.company_name}, its partners, employees, and agents from 
        and against any and all claims, damages, losses, liabilities, costs, and expenses (including legal fees) arising out of:
      </p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>The Coach's negligence, misconduct, or breach of this Agreement</li>
        <li>Any intellectual property infringement by the Coach (e.g., using copyrighted materials without license)</li>
        <li>Any harm, injury, or damage caused to a student during coaching sessions</li>
        <li>Violation of any applicable laws, including data protection laws</li>
      </ul>

      {/* Section 7 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">7. TERMINATION</h3>

      <h4 className="font-semibold mb-2">7.1 Termination for Convenience</h4>
      <p className="mb-4">
        Either Party may terminate this Agreement by giving <strong>{config.termination_notice_days} DAYS</strong> written notice 
        to the other Party via the Platform or registered email.
      </p>

      <h4 className="font-semibold mb-2">7.2 Immediate Termination for Cause</h4>
      <p className="mb-2">The Company may terminate this Agreement immediately without notice if the Coach:</p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Breaches child safety or data privacy provisions (Clause 4)</li>
        <li>Engages in student poaching or solicitation (Clause 5)</li>
        <li>Misses 3 or more scheduled sessions without valid reason in any calendar month</li>
        <li>Receives 3 or more parent complaints regarding conduct or service quality</li>
        <li>Consistently receives poor ratings (below 3 stars average)</li>
        <li>Engages in fraud, misrepresentation, or unethical conduct</li>
        <li>Breaches any material provision of this Agreement</li>
      </ul>

      <h4 className="font-semibold mb-2">7.3 Exit Process</h4>
      <p className="mb-2">Upon termination, the Coach shall:</p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>Complete all scheduled sessions during the notice period, OR forfeit payment for incomplete sessions</li>
        <li>Provide handover documentation for each assigned child (progress notes, observations, recommendations)</li>
        <li>Return or permanently delete all Company materials, including curriculum and teaching aids</li>
        <li>Cease use of Yestoryd branding, referral codes, and any Company intellectual property</li>
      </ul>

      <h4 className="font-semibold mb-2">7.4 Payment on Termination</h4>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>All payments earned up to the last completed month shall be paid as per regular schedule</li>
        <li>If Coach exits mid-month without proper notice, that month's partial payment may be forfeited</li>
        <li>If Company terminates without cause, all pending payments shall be cleared within 15 days</li>
      </ul>

      {/* Section 8 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">8. DISPUTE RESOLUTION & GOVERNING LAW</h3>

      <h4 className="font-semibold mb-2">8.1 Amicable Settlement</h4>
      <p className="mb-4">
        The Parties shall first attempt to resolve any dispute arising out of or in connection with this Agreement 
        through good-faith negotiations within 30 days.
      </p>

      <h4 className="font-semibold mb-2">8.2 Arbitration</h4>
      <p className="mb-2">
        If the dispute cannot be resolved amicably, it shall be referred to arbitration in accordance with the 
        Arbitration and Conciliation Act, 1996:
      </p>
      <ul className="list-disc ml-6 mb-4 space-y-1">
        <li>The arbitration shall be conducted by a sole arbitrator mutually appointed by the Parties</li>
        <li>If the Parties cannot agree on an arbitrator within 15 days, the Company shall appoint the arbitrator</li>
        <li>The seat of arbitration shall be Navi Mumbai, Maharashtra</li>
        <li>The language of arbitration shall be English</li>
      </ul>

      <h4 className="font-semibold mb-2">8.3 Jurisdiction</h4>
      <p className="mb-4">
        Subject to Clause 8.2, the courts in Navi Mumbai / Thane, Maharashtra shall have exclusive jurisdiction 
        over any disputes arising under this Agreement.
      </p>

      <h4 className="font-semibold mb-2">8.4 Governing Law</h4>
      <p className="mb-4">This Agreement shall be governed by and construed in accordance with the laws of India.</p>

      {/* Section 9 */}
      <h3 className="text-lg font-bold text-purple-800 mt-8 mb-4">9. GENERAL PROVISIONS</h3>

      <h4 className="font-semibold mb-2">9.1 Entire Agreement</h4>
      <p className="mb-4">
        This Agreement constitutes the entire agreement between the Parties with respect to its subject matter 
        and supersedes all prior negotiations, representations, warranties, and agreements.
      </p>

      <h4 className="font-semibold mb-2">9.2 Amendments</h4>
      <p className="mb-4">
        The Company may amend terms of this Agreement with 30 days written notice. Continued provision of Services 
        after such notice constitutes acceptance of the amended terms.
      </p>

      <h4 className="font-semibold mb-2">9.3 Severability</h4>
      <p className="mb-4">
        If any provision of this Agreement is found to be invalid, illegal, or unenforceable, the remaining provisions 
        shall continue in full force and effect.
      </p>

      <h4 className="font-semibold mb-2">9.4 Waiver</h4>
      <p className="mb-4">
        No waiver of any provision shall be effective unless in writing and signed by the waiving Party. 
        Failure to enforce any provision shall not constitute a waiver of that provision.
      </p>

      <h4 className="font-semibold mb-2">9.5 Assignment</h4>
      <p className="mb-4">
        The Coach may not assign or transfer any rights or obligations under this Agreement without the prior written 
        consent of the Company. The Company may freely assign this Agreement to any successor or affiliate.
      </p>

      <h4 className="font-semibold mb-2">9.6 Notices</h4>
      <p className="mb-4">
        All notices under this Agreement shall be sent to the email addresses registered on the Platform or via the 
        Platform's official communication channels.
      </p>

      <h4 className="font-semibold mb-2">9.7 Platform Availability & Force Majeure</h4>
      <p className="mb-2">
        <strong>(a) No Uptime Guarantee:</strong> The Company does not guarantee uninterrupted or error-free availability 
        of the Platform. The Coach acknowledges that temporary outages may occur due to scheduled maintenance, software updates, 
        server issues, or third-party service failures.
      </p>
      <p className="mb-2">
        <strong>(b) Limitation of Liability:</strong> The Company shall NOT be liable for any lost earnings, business losses, 
        damages, or claims of any kind arising from Platform downtime, technical failures, internet connectivity issues, or 
        events beyond the Company's reasonable control (including but not limited to natural disasters, acts of God, government 
        actions, cyberattacks, pandemic-related disruptions, or third-party service provider failures).
      </p>
      <p className="mb-2">
        <strong>(c) Scheduled Maintenance:</strong> In the event of scheduled maintenance expected to exceed 4 hours, the Company 
        shall endeavor to provide at least 24 hours' advance notice to Coaches via email or Platform notification.
      </p>
      <p className="mb-4">
        <strong>(d) Session Rescheduling:</strong> If a scheduled session cannot be conducted due to Platform downtime, the Company 
        shall facilitate rescheduling of the affected session at no penalty to either the Coach or the User.
      </p>

      <h4 className="font-semibold mb-2">9.8 Electronic Acceptance & Signature</h4>
      <p className="mb-2">
        <strong>(a)</strong> The Coach acknowledges that clicking "I Accept" and providing a digital signature on the Platform 
        constitutes valid acceptance of this Agreement under the Information Technology Act, 2000.
      </p>
      <p className="mb-2">
        <strong>(b)</strong> The Company shall record the following metadata as evidence of acceptance: timestamp, IP address, 
        device information, and Aadhaar/PAN number provided.
      </p>
      <p className="mb-4">
        <strong>(c)</strong> The Coach waives any objection to the validity of this Agreement based solely on it being executed electronically.
      </p>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t-2 border-gray-300">
        <p className="text-center text-sm text-gray-500">
          {config.company_name} | AI-Powered Reading Intelligence Platform
          <br />
          Website: {config.company_website} | Email: {config.company_email} | WhatsApp: {config.company_phone}
          <br />
          <span className="text-xs">Agreement Version {config.agreement_version} | Effective {config.agreement_effective_date}</span>
        </p>
      </div>
    </div>
  );
}
