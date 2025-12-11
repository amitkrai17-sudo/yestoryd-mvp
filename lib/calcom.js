// lib/calcom.js
// Cal.com API Integration for Yestoryd

const CAL_API_BASE = 'https://api.cal.com/v1';

async function calcomRequest(endpoint, options = {}) {
  const apiKey = process.env.CAL_COM_API_KEY;
  const url = `${CAL_API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
  
  console.log('Cal.com request:', endpoint);
  
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    console.error('Cal.com error:', data);
    throw new Error(`Cal.com API error: ${response.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

export async function getAvailableSlots(eventTypeId, startTime, endTime, timeZone = 'Asia/Kolkata') {
  const params = new URLSearchParams({
    eventTypeId: eventTypeId.toString(),
    startTime,
    endTime,
    timeZone,
  });
  
  const data = await calcomRequest(`/slots?${params}`);
  
  const slots = [];
  if (data.slots && typeof data.slots === 'object') {
    for (const [date, times] of Object.entries(data.slots)) {
      if (Array.isArray(times)) {
        for (const timeObj of times) {
          const timeStr = typeof timeObj === 'string' ? timeObj : timeObj.time;
          if (timeStr) slots.push({ time: timeStr });
        }
      }
    }
  }
  
  console.log(`Found ${slots.length} slots for event ${eventTypeId}`);
  return slots;
}

export async function createBooking({
  eventTypeId, start, name, email, timeZone = 'Asia/Kolkata',
}) {
  // Cal.com v1 API - guests can't be used with responses
  // Coach will be notified separately via email/WhatsApp
  const payload = {
    eventTypeId: parseInt(eventTypeId),
    start,
    timeZone,
    language: 'en',
    metadata: {},
    responses: {
      name: name,
      email: email,
    },
  };

  console.log('Creating booking:', JSON.stringify(payload, null, 2));

  return calcomRequest('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createSessionBooking({
  eventTypeId, startDateTime, durationMinutes,
  childName, parentName, parentEmail, coachEmail,
  sessionType, weekNumber,
}) {
  // Create booking for parent
  // Coach notification will be handled separately
  const booking = await createBooking({
    eventTypeId,
    start: startDateTime,
    name: parentName,
    email: parentEmail,
  });

  // Return booking with coach info for our records
  return {
    ...booking,
    coachEmail: coachEmail,
    childName: childName,
    sessionType: sessionType,
    weekNumber: weekNumber,
  };
}

export async function cancelBooking(bookingId, reason = '') {
  return calcomRequest(`/bookings/${bookingId}/cancel`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export async function findNextAvailableSlot(eventTypeId, startFrom = new Date(), preferredTimeSlot = null) {
  const timeSlotRanges = {
    morning: { start: 9, end: 12 },
    afternoon: { start: 14, end: 17 },
    evening: { start: 17, end: 20 },
  };

  const startDate = new Date(startFrom);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);

  const slots = await getAvailableSlots(eventTypeId, startDate.toISOString(), endDate.toISOString());

  if (!slots || slots.length === 0) {
    console.log('No slots available');
    return null;
  }

  let filteredSlots = slots;
  if (preferredTimeSlot && timeSlotRanges[preferredTimeSlot]) {
    const { start, end } = timeSlotRanges[preferredTimeSlot];
    filteredSlots = slots.filter(slot => {
      const slotHour = new Date(slot.time).getHours();
      return slotHour >= start && slotHour < end;
    });
  }

  const selectedSlot = filteredSlots.length > 0 ? filteredSlots[0] : slots[0];
  console.log('Selected slot:', selectedSlot);
  return selectedSlot;
}

export default {
  getAvailableSlots,
  createBooking,
  createSessionBooking,
  cancelBooking,
  findNextAvailableSlot,
};
