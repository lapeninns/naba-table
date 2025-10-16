# SajiloReserveX - API Integration Guide

**Version:** 1.0  
**Date:** 2025-01-15  
**API Version:** v1

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Core Endpoints](#core-endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Webhooks](#webhooks)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## Getting Started

### Base URLs

| Environment | Base URL                                 |
| ----------- | ---------------------------------------- |
| Production  | `https://api.sajiloreservex.com`         |
| Staging     | `https://staging-api.sajiloreservex.com` |
| Development | `http://localhost:3000`                  |

### API Versioning

The API uses URL versioning:

- **Unversioned:** `/api/*` (current, may change)
- **Versioned:** `/api/v1/*` (stable, recommended)

**Example:**

```bash
# Current API (may change)
GET /api/bookings

# Versioned API (stable)
GET /api/v1/bookings
```

### Content Type

All requests should use `application/json`:

```http
Content-Type: application/json
Accept: application/json
```

---

## Authentication

### Public Endpoints

Some endpoints don't require authentication:

- `GET /api/restaurants` - List restaurants
- `POST /api/bookings` - Create booking
- `POST /api/lead` - Capture lead
- `POST /api/events` - Track analytics

### Authenticated Endpoints

Use Supabase Auth tokens:

**Option 1: Session Cookie (Web)**

```javascript
// Browser automatically sends cookies
fetch('/api/profile', {
  credentials: 'include',
});
```

**Option 2: Bearer Token (Mobile/API)**

```http
Authorization: Bearer <supabase_access_token>
```

**Getting a Token:**

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://your-project.supabase.co', 'your-anon-key');

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});

// Use access token
const accessToken = data.session.access_token;

// Make authenticated request
fetch('/api/profile', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});
```

---

## Core Endpoints

### 1. List Restaurants

**Endpoint:** `GET /api/restaurants`

**Description:** Get all active restaurants

**Authentication:** None

**Request:**

```http
GET /api/restaurants HTTP/1.1
Host: api.sajiloreservex.com
Accept: application/json
```

**Response:** `200 OK`

```json
{
  "restaurants": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Bella Vista",
      "slug": "bella-vista",
      "cuisine_type": "Italian",
      "location": "London",
      "timezone": "Europe/London",
      "is_active": true
    }
  ]
}
```

---

### 2. Get Restaurant Schedule

**Endpoint:** `GET /api/restaurants/{slug}/schedule`

**Description:** Get restaurant operating hours and availability

**Authentication:** None

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| date | string | No | Date in YYYY-MM-DD format (default: today) |

**Request:**

```http
GET /api/restaurants/bella-vista/schedule?date=2025-02-01 HTTP/1.1
Host: api.sajiloreservex.com
Accept: application/json
```

**Response:** `200 OK`

```json
{
  "restaurant_id": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2025-02-01",
  "timezone": "Europe/London",
  "is_open": true,
  "opens_at": "17:00",
  "closes_at": "23:00",
  "service_periods": [
    {
      "name": "Dinner",
      "start_time": "17:30",
      "end_time": "22:00",
      "booking_type": "dinner"
    }
  ]
}
```

---

### 3. Create Booking

**Endpoint:** `POST /api/bookings`

**Description:** Create a new restaurant booking

**Authentication:** None (guest booking)

**Idempotency:** Supports `Idempotency-Key` header

**Request:**

```http
POST /api/bookings HTTP/1.1
Host: api.sajiloreservex.com
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "restaurantId": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2025-02-01",
  "time": "19:00",
  "party": 4,
  "bookingType": "dinner",
  "seating": "indoor",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+44 7700 900123",
  "notes": "Anniversary celebration",
  "marketingOptIn": true
}
```

**Request Body Schema:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| restaurantId | string (uuid) | No\* | Valid restaurant UUID |
| date | string | Yes | YYYY-MM-DD format |
| time | string | Yes | HH:MM format (24h) |
| party | number | Yes | Min: 1, Max: 20 |
| bookingType | enum | Yes | "breakfast", "lunch", "dinner", "drinks" |
| seating | enum | Yes | "any", "indoor", "outdoor", "bar", "window", "quiet", "booth" |
| name | string | Yes | Min: 2, Max: 120 chars |
| email | string | Yes | Valid email format |
| phone | string | Yes | Min: 7, Max: 50 chars |
| notes | string | No | Max: 500 chars |
| marketingOptIn | boolean | No | Default: false |

\*If not provided, uses default restaurant

**Response:** `201 Created`

```json
{
  "booking": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "reference": "ABC123XYZ9",
    "restaurant_id": "123e4567-e89b-12d3-a456-426614174000",
    "booking_date": "2025-02-01",
    "start_time": "19:00",
    "end_time": "21:00",
    "start_at": "2025-02-01T19:00:00Z",
    "end_at": "2025-02-01T21:00:00Z",
    "party_size": 4,
    "status": "confirmed",
    "booking_type": "dinner",
    "seating_preference": "indoor",
    "customer_name": "John Smith",
    "customer_email": "john@example.com",
    "customer_phone": "+44 7700 900123",
    "notes": "Anniversary celebration",
    "loyalty_points_awarded": 30,
    "created_at": "2025-01-15T14:30:00Z"
  },
  "confirmationToken": "a1b2c3d4e5f6...",
  "loyaltyPointsAwarded": 30,
  "bookings": [
    // All bookings for this email/phone
  ],
  "clientRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "duplicate": false
}
```

**Error Responses:**

**400 Bad Request** - Validation failed

```json
{
  "error": "Invalid payload",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email format"],
      "party": ["Must be at least 1"]
    }
  }
}
```

**422 Unprocessable Entity** - Past booking time

```json
{
  "error": "Cannot book a time in the past",
  "code": "PAST_BOOKING_TIME",
  "details": {
    "currentTime": "2025-01-15T15:00:00Z",
    "requestedTime": "2025-01-15T14:00:00Z",
    "graceMinutes": 15
  }
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "error": "Too many booking requests",
  "code": "RATE_LIMITED",
  "retryAfter": 30
}
```

---

### 4. Get My Bookings

**Endpoint:** `GET /api/bookings?me=1`

**Description:** Get bookings for authenticated user

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| me | string | Yes | Must be "1" |
| status | enum | No | "pending", "confirmed", "cancelled", "active" |
| from | string (ISO) | No | Filter bookings from this date |
| to | string (ISO) | No | Filter bookings until this date |
| sort | enum | No | "asc" or "desc" (default: "asc") |
| page | number | No | Page number (default: 1) |
| pageSize | number | No | Items per page (default: 10, max: 50) |

**Request:**

```http
GET /api/bookings?me=1&status=confirmed&sort=asc&page=1&pageSize=10 HTTP/1.1
Host: api.sajiloreservex.com
Authorization: Bearer <token>
Accept: application/json
```

**Response:** `200 OK`

```json
{
  "items": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174000",
      "restaurantName": "Bella Vista",
      "partySize": 4,
      "startIso": "2025-02-01T19:00:00Z",
      "endIso": "2025-02-01T21:00:00Z",
      "status": "confirmed",
      "notes": "Anniversary celebration"
    }
  ],
  "pageInfo": {
    "page": 1,
    "pageSize": 10,
    "total": 25,
    "hasNext": true
  }
}
```

---

### 5. Get Booking by ID

**Endpoint:** `GET /api/bookings/{id}`

**Description:** Get single booking details

**Authentication:** Required (must own booking or be restaurant staff)

**Request:**

```http
GET /api/bookings/456e7890-e89b-12d3-a456-426614174000 HTTP/1.1
Host: api.sajiloreservex.com
Authorization: Bearer <token>
Accept: application/json
```

**Response:** `200 OK`

```json
{
  "booking": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "reference": "ABC123XYZ9",
    "restaurant_id": "123e4567-e89b-12d3-a456-426614174000",
    "booking_date": "2025-02-01",
    "start_time": "19:00",
    "end_time": "21:00",
    "party_size": 4,
    "status": "confirmed",
    "customer_name": "John Smith",
    "notes": "Anniversary celebration",
    "created_at": "2025-01-15T14:30:00Z"
  }
}
```

---

### 6. Update Booking

**Endpoint:** `PATCH /api/bookings/{id}`

**Description:** Update booking details

**Authentication:** Required

**Request:**

```http
PATCH /api/bookings/456e7890-e89b-12d3-a456-426614174000 HTTP/1.1
Host: api.sajiloreservex.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "party_size": 6,
  "notes": "Anniversary celebration - need high chair"
}
```

**Response:** `200 OK`

```json
{
  "booking": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "party_size": 6,
    "notes": "Anniversary celebration - need high chair",
    "updated_at": "2025-01-15T15:00:00Z"
  }
}
```

---

### 7. Cancel Booking

**Endpoint:** `PATCH /api/bookings/{id}`

**Description:** Cancel a booking

**Authentication:** Required

**Request:**

```http
PATCH /api/bookings/456e7890-e89b-12d3-a456-426614174000 HTTP/1.1
Host: api.sajiloreservex.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "cancelled"
}
```

**Response:** `200 OK`

```json
{
  "booking": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "status": "cancelled",
    "updated_at": "2025-01-15T15:30:00Z"
  }
}
```

---

### 8. Get Booking History

**Endpoint:** `GET /api/bookings/{id}/history`

**Description:** Get audit trail for a booking

**Authentication:** Required

**Request:**

```http
GET /api/bookings/456e7890-e89b-12d3-a456-426614174000/history HTTP/1.1
Host: api.sajiloreservex.com
Authorization: Bearer <token>
Accept: application/json
```

**Response:** `200 OK`

```json
[
  {
    "version_id": "789e0123-e89b-12d3-a456-426614174000",
    "change_type": "created",
    "changed_by": "john@example.com",
    "changed_at": "2025-01-15T14:30:00Z",
    "changes": []
  },
  {
    "version_id": "890e1234-e89b-12d3-a456-426614174000",
    "change_type": "updated",
    "changed_by": "john@example.com",
    "changed_at": "2025-01-15T15:00:00Z",
    "changes": [
      {
        "field": "party_size",
        "before": 4,
        "after": 6
      }
    ]
  }
]
```

---

### 9. Validate Confirmation Token

**Endpoint:** `GET /api/bookings/confirm`

**Description:** Validate confirmation token and view booking details

**Authentication:** None (uses token)

**Rate Limit:** 20 requests/min per IP

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | 64-character confirmation token |

**Request:**

```http
GET /api/bookings/confirm?token=a1b2c3d4e5f6... HTTP/1.1
Host: api.sajiloreservex.com
Accept: application/json
```

**Response:** `200 OK`

```json
{
  "booking": {
    "reference": "ABC123XYZ9",
    "restaurantName": "Bella Vista",
    "date": "2025-02-01",
    "startTime": "19:00",
    "endTime": "21:00",
    "partySize": 4,
    "status": "confirmed",
    "bookingType": "dinner",
    "seatingPreference": "indoor",
    "notes": "Anniversary celebration"
  }
}
```

**Note:** Token is single-use and expires after 1 hour

---

### 10. Update User Profile

**Endpoint:** `PUT /api/profile`

**Description:** Update current user's profile

**Authentication:** Required

**Request:**

```http
PUT /api/profile HTTP/1.1
Host: api.sajiloreservex.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Smith",
  "phone": "+44 7700 900123"
}
```

**Response:** `200 OK`

```json
{
  "profile": {
    "id": "user-uuid",
    "email": "john@example.com",
    "name": "John Smith",
    "phone": "+44 7700 900123",
    "image": null,
    "updated_at": "2025-01-15T16:00:00Z"
  }
}
```

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional context
  }
}
```

### HTTP Status Codes

| Status | Meaning               | When Used                      |
| ------ | --------------------- | ------------------------------ |
| 200    | OK                    | Successful GET/PATCH/PUT       |
| 201    | Created               | Successful POST                |
| 400    | Bad Request           | Invalid input/validation error |
| 401    | Unauthorized          | Authentication required        |
| 403    | Forbidden             | Insufficient permissions       |
| 404    | Not Found             | Resource doesn't exist         |
| 409    | Conflict              | Resource already exists        |
| 410    | Gone                  | Resource expired/used          |
| 422    | Unprocessable Entity  | Business logic error           |
| 429    | Too Many Requests     | Rate limit exceeded            |
| 500    | Internal Server Error | Server error                   |

### Error Codes

| Code                      | Description                      |
| ------------------------- | -------------------------------- |
| `INVALID_INPUT`           | Request validation failed        |
| `RATE_LIMITED`            | Rate limit exceeded              |
| `PAST_BOOKING_TIME`       | Cannot book past time            |
| `OUTSIDE_OPERATING_HOURS` | Booking outside restaurant hours |
| `TOKEN_NOT_FOUND`         | Confirmation token not found     |
| `TOKEN_EXPIRED`           | Confirmation token expired       |
| `TOKEN_ALREADY_USED`      | Token already used               |
| `UNAUTHORIZED`            | Authentication required          |
| `FORBIDDEN`               | Insufficient permissions         |
| `NOT_FOUND`               | Resource not found               |

---

## Rate Limiting

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705329600000
```

### Limits by Endpoint

| Endpoint                         | Limit | Window   |
| -------------------------------- | ----- | -------- |
| POST /api/bookings               | 60    | 1 minute |
| GET /api/bookings (guest lookup) | 20    | 1 minute |
| GET /api/bookings/confirm        | 20    | 1 minute |
| Other endpoints                  | 100   | 1 minute |

### Handling Rate Limits

```javascript
async function createBooking(data) {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);

    // Wait and retry
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return createBooking(data); // Retry
  }

  return response.json();
}
```

---

## Webhooks

### Coming Soon

Webhook support for real-time event notifications is planned for Q2 2025.

**Planned Events:**

- `booking.created`
- `booking.updated`
- `booking.cancelled`
- `booking.completed`
- `booking.no_show`

---

## Code Examples

### JavaScript/TypeScript

**Creating a Booking:**

```typescript
interface BookingPayload {
  restaurantId?: string;
  date: string;
  time: string;
  party: number;
  bookingType: 'breakfast' | 'lunch' | 'dinner' | 'drinks';
  seating: 'any' | 'indoor' | 'outdoor' | 'bar' | 'window' | 'quiet' | 'booth';
  name: string;
  email: string;
  phone: string;
  notes?: string;
  marketingOptIn?: boolean;
}

async function createBooking(payload: BookingPayload) {
  const response = await fetch('https://api.sajiloreservex.com/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(), // Prevent duplicates
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
const booking = await createBooking({
  date: '2025-02-01',
  time: '19:00',
  party: 4,
  bookingType: 'dinner',
  seating: 'indoor',
  name: 'John Smith',
  email: 'john@example.com',
  phone: '+44 7700 900123',
  notes: 'Anniversary',
  marketingOptIn: true,
});

console.log('Booking reference:', booking.booking.reference);
console.log('Loyalty points earned:', booking.loyaltyPointsAwarded);
```

---

### Python

**Creating a Booking:**

```python
import requests
import uuid

def create_booking(payload: dict) -> dict:
    url = 'https://api.sajiloreservex.com/api/bookings'
    headers = {
        'Content-Type': 'application/json',
        'Idempotency-Key': str(uuid.uuid4())
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()

    return response.json()

# Usage
booking_data = {
    'date': '2025-02-01',
    'time': '19:00',
    'party': 4,
    'bookingType': 'dinner',
    'seating': 'indoor',
    'name': 'John Smith',
    'email': 'john@example.com',
    'phone': '+44 7700 900123',
    'marketingOptIn': True
}

result = create_booking(booking_data)
print(f"Booking reference: {result['booking']['reference']}")
print(f"Loyalty points: {result['loyaltyPointsAwarded']}")
```

---

### cURL

**Creating a Booking:**

```bash
curl -X POST https://api.sajiloreservex.com/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "date": "2025-02-01",
    "time": "19:00",
    "party": 4,
    "bookingType": "dinner",
    "seating": "indoor",
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+44 7700 900123",
    "notes": "Anniversary celebration",
    "marketingOptIn": true
  }'
```

**Getting Authenticated User's Bookings:**

```bash
curl -X GET "https://api.sajiloreservex.com/api/bookings?me=1&page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

---

## Best Practices

### 1. Use Idempotency Keys

Always include `Idempotency-Key` header for POST requests:

```javascript
const idempotencyKey = crypto.randomUUID();

fetch('/api/bookings', {
  method: 'POST',
  headers: {
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify(data),
});
```

### 2. Handle Rate Limits Gracefully

Implement exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 * 2 ** i));
  }

  throw new Error('Max retries exceeded');
}
```

### 3. Validate Input Client-Side

Reduce API calls by validating before sending:

```typescript
import { z } from 'zod';

const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1).max(20),
  email: z.string().email(),
  // ...
});

const result = bookingSchema.safeParse(data);
if (!result.success) {
  console.error('Validation errors:', result.error);
  return;
}
```

### 4. Cache Restaurant Data

Restaurant list rarely changes:

```javascript
const CACHE_TTL = 3600 * 1000; // 1 hour

let restaurantsCache = {
  data: null,
  timestamp: 0,
};

async function getRestaurants() {
  const now = Date.now();

  if (restaurantsCache.data && now - restaurantsCache.timestamp < CACHE_TTL) {
    return restaurantsCache.data;
  }

  const response = await fetch('/api/restaurants');
  const data = await response.json();

  restaurantsCache = {
    data: data.restaurants,
    timestamp: now,
  };

  return data.restaurants;
}
```

### 5. Log All API Calls

For debugging and monitoring:

```javascript
function apiRequest(url, options) {
  const requestId = crypto.randomUUID();

  console.log(`[${requestId}] ${options.method} ${url}`, {
    headers: options.headers,
    body: options.body,
  });

  return fetch(url, options)
    .then((response) => {
      console.log(`[${requestId}] Response ${response.status}`);
      return response;
    })
    .catch((error) => {
      console.error(`[${requestId}] Error:`, error);
      throw error;
    });
}
```

---

## SDK Libraries

### Official SDKs

**Coming Soon:**

- JavaScript/TypeScript SDK
- Python SDK
- Ruby SDK
- PHP SDK

### Community SDKs

Check GitHub for community-maintained SDKs in other languages.

---

## Support

### Technical Support

- **Email:** api-support@sajiloreservex.com
- **Documentation:** https://docs.sajiloreservex.com
- **Status Page:** https://status.sajiloreservex.com

### Feature Requests

Submit feature requests via:

- GitHub Issues: https://github.com/your-org/SajiloReserveX/issues
- Email: product@sajiloreservex.com

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**API Version:** v1  
**Maintained By:** API Team
