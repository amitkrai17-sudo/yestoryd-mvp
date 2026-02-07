// ============================================================
// Handler: GREETING - First message welcome
// ============================================================

import { sendButtons } from '@/lib/whatsapp/cloud-api';

export interface GreetingResult {
  response: string;
  nextState: 'QUALIFYING';
}

export async function handleGreeting(
  phone: string,
  contactName: string
): Promise<GreetingResult> {
  const firstName = contactName?.split(' ')[0] || 'there';

  const body =
    `Hi ${firstName}! I'm Yestoryd's AI assistant 🤖\n\n` +
    `We help children aged 4-12 become confident readers through personalized 1-on-1 coaching.\n\n` +
    `How can I help you today?`;

  await sendButtons(phone, body, [
    { id: 'btn_assessment', title: '📖 Check Reading' },
    { id: 'btn_pricing', title: '💰 See Pricing' },
    { id: 'btn_human', title: '🙋 Talk to Someone' },
  ]);

  return {
    response: body,
    nextState: 'QUALIFYING',
  };
}
