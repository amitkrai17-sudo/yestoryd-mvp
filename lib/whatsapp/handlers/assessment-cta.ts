// ============================================================
// Handler: ASSESSMENT_CTA - Send assessment link with buttons
// ============================================================

import { sendButtons } from '@/lib/whatsapp/cloud-api';
import { getLeadBotUrls } from '@/lib/whatsapp/urls';

export interface AssessmentCtaResult {
  response: string;
  nextState: 'ASSESSMENT_OFFERED';
}

export async function handleAssessmentCta(
  phone: string,
  collectedData: Record<string, unknown>
): Promise<AssessmentCtaResult> {
  const { assessmentUrl } = await getLeadBotUrls();
  const childName = (collectedData.child_name as string) || 'your child';

  const body =
    `Here's a free 5-minute AI reading assessment for ${childName}! It'll tell you their exact reading level and areas to improve.\n\n` +
    `${assessmentUrl}\n\n` +
    `It's completely free — give it a try!`;

  await sendButtons(phone, body, [
    { id: 'btn_assessment', title: 'Take Assessment' },
    { id: 'btn_book_call', title: 'Book a Call' },
    { id: 'btn_more_questions', title: 'More Questions' },
  ]);

  return {
    response: body,
    nextState: 'ASSESSMENT_OFFERED',
  };
}
