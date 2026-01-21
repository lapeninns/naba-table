import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BookingInput {
  restaurantId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
  bookingType: 'lunch' | 'dinner';
  seatingPreference: string;
  notes?: string;
}

const FIRST_NAMES = [
  'James',
  'Sarah',
  'Michael',
  'Emma',
  'David',
  'Olivia',
  'Robert',
  'Sophia',
  'William',
  'Ava',
  'Richard',
  'Isabella',
  'Thomas',
  'Mia',
  'Charles',
  'Charlotte',
  'John',
  'Amelia',
  'Christopher',
  'Harper',
  'Daniel',
  'Evelyn',
  'Matthew',
  'Abigail',
  'Anthony',
  'Emily',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
];

const SEATING_PREFERENCES = ['any', 'window', 'bar', 'booth'];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCustomerName(): string {
  return `${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)}`;
}

function generateEmail(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '.')}+${Date.now()}@example.com`;
}

function generatePhone(): string {
  return `+447${Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, '0')}`;
}

function generateRandomId(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function getRestaurantId(): Promise<string> {
  const { data, error } = await supabase.from('restaurants').select('id').limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No restaurants found');
  }

  return data[0].id;
}

async function getOrCreateCustomer(
  restaurantId: string,
  name: string,
  email: string,
  phone: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      restaurant_id: restaurantId,
      full_name: name,
      email,
      phone,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  Error creating customer: ${error.message}`);
    throw error;
  }
  return data.id;
}

async function createBooking(input: BookingInput): Promise<string> {
  const customerId = await getOrCreateCustomer(
    input.restaurantId,
    input.customerName,
    input.customerEmail,
    input.customerPhone,
  );

  const reference = `STG-${generateRandomId()}`;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      restaurant_id: input.restaurantId,
      customer_id: customerId,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      booking_date: input.bookingDate,
      start_time: input.startTime,
      end_time: input.endTime,
      party_size: input.partySize,
      booking_type: input.bookingType,
      seating_preference: input.seatingPreference,
      status: 'confirmed',
      source: 'api',
      reference,
      notes: input.notes || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  Error creating booking: ${error.message}`);
    throw error;
  }
  return data.id;
}

async function seedBookingsForWeek() {
  try {
    const restaurantId = await getRestaurantId();
    console.log(`Using restaurant: ${restaurantId}\n`);

    const today = new Date(2026, 0, 21);
    const daysToAdd = 7;

    let successCount = 0;
    let failureCount = 0;

    for (let dayOffset = 0; dayOffset < daysToAdd; dayOffset++) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split('T')[0];

      const dayName = currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
      });
      console.log(`Seeding bookings for ${dayName}, ${dateStr}`);

      const lunchCount = Math.floor(Math.random() * 6) + 10;
      for (let i = 0; i < lunchCount; i++) {
        const minutes = Math.floor(Math.random() * 105);
        const hour = 12;
        const startTime = `${hour.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:00`;
        const endHour = hour + 2;
        const endTime = `${endHour.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:00`;

        const customerName = generateCustomerName();
        const booking: BookingInput = {
          restaurantId,
          customerName,
          customerEmail: generateEmail(customerName),
          customerPhone: generatePhone(),
          bookingDate: dateStr,
          startTime,
          endTime,
          partySize: Math.floor(Math.random() * 5) + 2,
          bookingType: 'lunch',
          seatingPreference: getRandomElement(SEATING_PREFERENCES),
          notes: Math.random() > 0.7 ? 'Special request or allergy info' : undefined,
        };

        try {
          await createBooking(booking);
          successCount++;
          console.log(`  ✓ Lunch booking at ${startTime}`);
        } catch (error) {
          failureCount++;
          if (failureCount === 1) {
            console.error(`  First error encountered, showing details:`, error);
          }
        }
      }

      const dinnerCount = Math.floor(Math.random() * 6) + 10;
      for (let i = 0; i < dinnerCount; i++) {
        const minutes = Math.floor(Math.random() * 165);
        const hour = 18;
        const startHour = hour + Math.floor(minutes / 60);
        const startMinutes = minutes % 60;
        const startTime = `${startHour.toString().padStart(2, '0')}:${startMinutes
          .toString()
          .padStart(2, '0')}:00`;

        const endHour = (hour + 2 + Math.floor(minutes / 60)) % 24;
        const endTime = `${endHour.toString().padStart(2, '0')}:${startMinutes
          .toString()
          .padStart(2, '0')}:00`;

        const customerName = generateCustomerName();
        const booking: BookingInput = {
          restaurantId,
          customerName,
          customerEmail: generateEmail(customerName),
          customerPhone: generatePhone(),
          bookingDate: dateStr,
          startTime,
          endTime,
          partySize: Math.floor(Math.random() * 5) + 2,
          bookingType: 'dinner',
          seatingPreference: getRandomElement(SEATING_PREFERENCES),
          notes: Math.random() > 0.8 ? 'High chair needed' : undefined,
        };

        try {
          await createBooking(booking);
          successCount++;
          console.log(`  ✓ Dinner booking at ${startTime}`);
        } catch (error) {
          failureCount++;
          if (failureCount === 1) {
            console.error(`  First error encountered, showing details:`, error);
          }
        }
      }

      console.log('');
    }

    console.log(`\n✅ Successfully created ${successCount} bookings for the week`);
    console.log(`Total failures: ${failureCount}`);
    console.log(`Target per day: 20-30 (10-15 lunch + 10-15 dinner)`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedBookingsForWeek();
