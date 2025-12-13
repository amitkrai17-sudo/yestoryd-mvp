// test-calcom-guests.js
// Test Cal.com API with guests

async function test() {
  const apiKey = process.env.CAL_COM_API_KEY;

  if (!apiKey) {
    console.error('❌ Missing CAL_COM_API_KEY');
    return;
  }

  console.log('🔍 Testing Cal.com API with guests...');
  console.log('API Key:', apiKey.substring(0, 15) + '...\n');

  // Step 1: Get event types
  console.log('1️⃣ Fetching event types...');
  const v1Res = await fetch(`https://api.cal.com/v1/event-types?apiKey=${apiKey}`);
  const v1Data = await v1Res.json();

  if (!v1Res.ok) {
    console.error('❌ Failed:', v1Data);
    return;
  }

  const eventTypes = v1Data.event_types || [];
  console.log('✅ Event types found:');
  eventTypes.forEach(et => {
    console.log(`   ID: ${et.id} | ${et.title} (${et.length}min) | slug: ${et.slug}`);
  });

  // Use coaching event type
  const coachingEvent = eventTypes.find(et => et.slug === 'coaching' || et.title.toLowerCase().includes('coaching'));
  const eventType = coachingEvent || eventTypes[0];
  console.log(`\n📌 Using: ${eventType.id} (${eventType.title})\n`);

  // Step 2: Get slots using PUBLIC availability endpoint
  // This uses the username/slug format instead of API key
  console.log('2️⃣ Fetching available slots (public endpoint)...');
  
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  // Format dates as YYYY-MM-DD
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Get username from event type
  const username = eventType.users?.[0]?.username || 'yestoryd';
  const slug = eventType.slug;

  console.log(`   Checking: ${username}/${slug}`);
  console.log(`   Date range: ${startStr} to ${endStr}`);

  // Use the public slots endpoint
  const slotsUrl = `https://cal.com/api/trpc/public/slots.getSchedule?input=${encodeURIComponent(JSON.stringify({
    json: {
      isTeamEvent: false,
      usernameList: [username],
      eventTypeSlug: slug,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      timeZone: 'Asia/Kolkata',
    }
  }))}`;

  const slotsRes = await fetch(slotsUrl);
  const slotsData = await slotsRes.json();

  let allSlots = [];
  
  if (slotsRes.ok && slotsData.result?.data?.json?.slots) {
    const slots = slotsData.result.data.json.slots;
    for (const [date, times] of Object.entries(slots)) {
      for (const slot of times) {
        allSlots.push(slot.time);
      }
    }
  }

  // If public endpoint didn't work, try a hardcoded future time
  if (allSlots.length === 0) {
    console.log('⚠️ Could not fetch slots, using manual time...');
    // Use a slot 3 days from now at 10 AM IST
    const manualSlot = new Date();
    manualSlot.setDate(manualSlot.getDate() + 3);
    manualSlot.setHours(10, 0, 0, 0);
    allSlots.push(manualSlot.toISOString());
  }

  console.log(`✅ Using slot: ${allSlots[0]}\n`);

  // Step 3: Create booking WITH guests
  console.log('3️⃣ Creating booking with GUESTS...');

  const booking = {
    eventTypeId: Number(eventType.id),
    start: allSlots[0],
    responses: {
      name: 'Test Parent',
      email: 'test-parent@yestoryd.com',
      location: { optionValue: '', value: 'integrations:google:meet' },
    },
    timeZone: 'Asia/Kolkata',
    language: 'en',
    metadata: {
      childName: 'Test Child',
      sessionType: 'coaching',
    },
    // GUESTS - Coach and Admin
    guests: [
      'rucha.rai@yestoryd.com',
      'engage@yestoryd.com',
    ],
  };

  console.log('📤 Payload with guests:');
  console.log(JSON.stringify(booking, null, 2));

  const bookRes = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });

  const bookData = await bookRes.json();

  if (!bookRes.ok) {
    console.error('\n❌ BOOKING WITH GUESTS FAILED');
    console.error('Status:', bookRes.status);
    console.error('Response:', JSON.stringify(bookData, null, 2));

    // Check if it's a guests issue
    if (JSON.stringify(bookData).includes('guest')) {
      console.log('\n⚠️ GUESTS feature may not be supported.');
    }

    // Try without guests
    console.log('\n🔄 Trying WITHOUT guests...');
    const bookingNoGuests = { ...booking };
    delete bookingNoGuests.guests;

    const bookRes2 = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingNoGuests),
    });

    const bookData2 = await bookRes2.json();

    if (bookRes2.ok) {
      console.log('\n✅ Booking WITHOUT guests WORKS!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('CONCLUSION: Cal.com V1 API does NOT support guests');
      console.log('SOLUTION: Use Google Calendar API to invite coach');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Cleanup
      if (bookData2.id) {
        await fetch(`https://api.cal.com/v1/bookings/${bookData2.id}?apiKey=${apiKey}`, {
          method: 'DELETE',
        });
        console.log('\n✅ Test booking cancelled');
      }
    } else {
      console.log('\n❌ Booking without guests also failed:');
      console.log(JSON.stringify(bookData2, null, 2));
      
      // Check if it's a slot availability issue
      if (JSON.stringify(bookData2).includes('slot') || JSON.stringify(bookData2).includes('available')) {
        console.log('\n💡 The time slot may not be available.');
        console.log('   Check Cal.com availability settings.');
      }
    }
    return;
  }

  // SUCCESS!
  console.log('\n✅ BOOKING WITH GUESTS CREATED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`ID:       ${bookData.id}`);
  console.log(`UID:      ${bookData.uid}`);
  console.log(`Start:    ${bookData.startTime}`);
  console.log(`End:      ${bookData.endTime}`);
  console.log(`Status:   ${bookData.status}`);

  const meetRef = bookData.references?.find(r => r.type?.includes('meet') || r.type?.includes('video'));
  if (meetRef) {
    console.log(`Meet URL: ${meetRef.meetingUrl}`);
  }

  if (bookData.attendees?.length > 0) {
    console.log('\n👥 Attendees:');
    bookData.attendees.forEach(a => {
      console.log(`   - ${a.name} <${a.email}>`);
    });
  }

  console.log('\n🎉 SUCCESS! Guests feature WORKS!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Cleanup
  console.log('\n4️⃣ Cleaning up...');
  await fetch(`https://api.cal.com/v1/bookings/${bookData.id}?apiKey=${apiKey}`, {
    method: 'DELETE',
  });
  console.log('✅ Test booking cancelled');
}

test().catch(console.error);
