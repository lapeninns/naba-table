const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const {
  LOAD_TEST_BASE_URL,
  LOAD_TEST_RESTAURANT_ID,
  LOAD_TEST_SUPABASE_URL,
  LOAD_TEST_SUPABASE_SERVICE_KEY,
} = process.env;

if (!LOAD_TEST_BASE_URL) {
  console.warn('[capacity-load] LOAD_TEST_BASE_URL not set – requests will hit undefined host');
}

const supabase =
  LOAD_TEST_SUPABASE_URL && LOAD_TEST_SUPABASE_SERVICE_KEY
    ? createClient(LOAD_TEST_SUPABASE_URL, LOAD_TEST_SUPABASE_SERVICE_KEY)
    : null;

async function ensureTestCustomer() {
  if (!supabase || !LOAD_TEST_RESTAURANT_ID) {
    return null;
  }

  const email = 'load-test@example.com';
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('restaurant_id', LOAD_TEST_RESTAURANT_ID)
    .eq('email', email)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[capacity-load] failed to fetch customer', error);
    return null;
  }

  if (data?.id) {
    return data.id;
  }

  const { data: created, error: createError } = await supabase
    .from('customers')
    .insert({
      restaurant_id: LOAD_TEST_RESTAURANT_ID,
      email,
      full_name: 'Load Test Customer',
      phone: '+10000000000',
    })
    .select('id')
    .single();

  if (createError) {
    console.error('[capacity-load] failed to create customer', createError);
    return null;
  }

  return created?.id ?? null;
}

module.exports = {
  async prepareBookingPayload(context, events, done) {
    const now = new Date();
    const bookingDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const hour = 17 + Math.floor(Math.random() * 5); // 17-21
    const minute = ['00', '15', '30', '45'][Math.floor(Math.random() * 4)];
    const startTime = `${String(hour).padStart(2, '0')}:${minute}`;

    const idempotencyKey = randomUUID();
    const customerId = (await ensureTestCustomer()) ?? null;

    context.vars.idempotencyKey = idempotencyKey;
    context.vars.bookingPayload = {
      restaurantId: LOAD_TEST_RESTAURANT_ID,
      customerId,
      customerEmail: 'load-test@example.com',
      customerName: 'Load Test Runner',
      customerPhone: '+10000000000',
      bookingDate,
      startTime,
      partySize: 2,
      bookingType: 'dinner',
      seatingPreference: 'any',
      marketingOptIn: false,
      idempotencyKey,
      source: 'load-test',
    };

    return done();
  },
};
