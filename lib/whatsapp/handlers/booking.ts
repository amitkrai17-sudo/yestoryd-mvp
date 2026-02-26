// ============================================================
// Handler: BOOKING - Send discovery call booking link
// ============================================================

import { sendButtons } from '@/lib/whatsapp/cloud-api';
import { getLeadBotUrls } from '@/lib/whatsapp/urls';

export interface BookingResult {
  response: string;
  nextState: 'DISCOVERY_OFFERED';
}

export async function handleBooking(
  phone: string,
  collectedData: Record<string, unknown>
): Promise<BookingResult> {
  const { bookingUrl } = await getLeadBotUrls();
  const childName = (collectedData.child_name as string) || 'your child';

  const body =
    `Great! Our reading coaches would love to chat about ${childName}'s reading journey.\n\n` +
    `Book a free 15-minute discovery call here:\n${bookingUrl}\n\n` +
    `They'll answer all your questions and suggest the best plan.`;

  await sendButtons(phone, body, [
    { id: 'btn_book_call', title: '📞 Book Now' },
    { id: 'btn_assessment', title: '📖 Free Assessment' },
    { id: 'btn_more_questions', title: '❓ Ask a Question' },
  ]);

  return {
    response: body,
    nextState: 'DISCOVERY_OFFERED',
  };
}
