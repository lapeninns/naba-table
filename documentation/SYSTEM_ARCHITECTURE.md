# SajiloReserveX - System Architecture Documentation

**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Production

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [Application Layers](#application-layers)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Security Architecture](#security-architecture)
6. [Deployment Architecture](#deployment-architecture)
7. [Integration Architecture](#integration-architecture)
8. [Scalability & Performance](#scalability--performance)

---

## High-Level Architecture

### System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WebBrowser[Web Browser]
        MobileDevice[Mobile Browser]
    end

    subgraph "CDN & Edge"
        VercelEdge[Vercel Edge Network]
        StaticAssets[Static Assets<br/>Images, CSS, JS]
    end

    subgraph "Application Layer - Next.js 15"
        AppRouter[App Router<br/>React Server Components]
        APIRoutes[API Routes<br/>RESTful Endpoints]
        Middleware[Middleware<br/>Auth & Rate Limiting]
        ServerActions[Server Actions]
    end

    subgraph "Business Logic Layer"
        Services[Service Functions<br/>server/]
        Validation[Zod Validators]
        AuthLogic[Auth Logic]
        BookingEngine[Booking Engine]
        LoyaltyEngine[Loyalty Engine]
    end

    subgraph "Data Layer"
        Supabase[(Supabase PostgreSQL)]
        SupabaseAuth[Supabase Auth]
        SupabaseStorage[Supabase Storage]
        Redis[(Upstash Redis<br/>Rate Limiting)]
    end

    subgraph "External Services"
        Resend[Resend Email API]
        Analytics[Analytics Service]
    end

    WebBrowser --> VercelEdge
    MobileDevice --> VercelEdge
    VercelEdge --> StaticAssets
    VercelEdge --> AppRouter

    AppRouter --> APIRoutes
    AppRouter --> ServerActions
    APIRoutes --> Middleware

    Middleware --> Services
    ServerActions --> Services

    Services --> Validation
    Services --> BookingEngine
    Services --> LoyaltyEngine
    Services --> AuthLogic

    BookingEngine --> Supabase
    LoyaltyEngine --> Supabase
    AuthLogic --> SupabaseAuth
    Services --> SupabaseStorage

    Middleware --> Redis
    Services --> Redis

    Services --> Resend
    Services --> Analytics

    style WebBrowser fill:#e3f2fd
    style MobileDevice fill:#e3f2fd
    style AppRouter fill:#fff4e6
    style Supabase fill:#c8e6c9
    style Redis fill:#ffccbc
```

### Architecture Principles

1. **Server-First Rendering**
   - React Server Components (RSC) for optimal performance
   - Reduced client-side JavaScript
   - Faster Time to First Byte (TTFB)

2. **Progressive Enhancement**
   - Core functionality works without JavaScript
   - Enhanced experience with client-side interactions
   - Graceful degradation

3. **Type Safety End-to-End**
   - TypeScript throughout
   - Zod for runtime validation
   - Database types auto-generated from Supabase

4. **Security by Default**
   - Row-Level Security (RLS) in database
   - HTTP-only cookies
   - Rate limiting on all public endpoints
   - Input validation at every boundary

---

## Technology Stack

### Frontend Architecture

```mermaid
graph LR
    subgraph "UI Layer"
        React[React 19.2]
        TailwindCSS[Tailwind CSS 4.1]
        RadixUI[Radix UI]
        ShadcnUI[shadcn/ui]
    end

    subgraph "State Management"
        TanStackQuery[TanStack Query 5.90]
        ReactHookForm[React Hook Form 7.63]
        Zustand[Local State]
    end

    subgraph "Routing & Rendering"
        NextJS[Next.js 15.5<br/>App Router]
        ServerComponents[React Server<br/>Components]
    end

    NextJS --> React
    React --> TailwindCSS
    React --> RadixUI
    RadixUI --> ShadcnUI

    React --> TanStackQuery
    React --> ReactHookForm
    React --> Zustand

    NextJS --> ServerComponents
    ServerComponents --> React

    style NextJS fill:#fff4e6
    style React fill:#e3f2fd
    style TanStackQuery fill:#c8e6c9
```

**Frontend Technologies:**

| Technology      | Version | Purpose                       |
| --------------- | ------- | ----------------------------- |
| Next.js         | 15.5.4  | React framework, SSR, routing |
| React           | 19.2.0  | UI library                    |
| TypeScript      | 5.9.2   | Type safety                   |
| Tailwind CSS    | 4.1.13  | Utility-first styling         |
| Radix UI        | Latest  | Accessible primitives         |
| shadcn/ui       | 3.4.0   | Component library             |
| TanStack Query  | 5.90.2  | Server state management       |
| React Hook Form | 7.63.0  | Form handling                 |
| Zod             | 4.1.11  | Schema validation             |

---

### Backend Architecture

```mermaid
graph TB
    subgraph "API Layer"
        GuestAPI[Guest API<br/>/api/*]
        OpsAPI[Operations API<br/>/api/ops/*]
        OwnerAPI[Owner API<br/>/api/owner/*]
        VersionedAPI[Versioned API<br/>/api/v1/*]
    end

    subgraph "Service Layer"
        BookingService[Booking Service]
        CustomerService[Customer Service]
        RestaurantService[Restaurant Service]
        LoyaltyService[Loyalty Service]
        TeamService[Team Service]
        EmailService[Email Service]
    end

    subgraph "Data Access Layer"
        SupabaseClient[Supabase Client]
        TypedQueries[Type-Safe Queries]
        RLS[Row-Level Security]
    end

    subgraph "Infrastructure"
        RateLimiter[Rate Limiter<br/>Upstash Redis]
        Observability[Observability<br/>Logging & Metrics]
        Cache[Cache Layer]
    end

    GuestAPI --> BookingService
    OpsAPI --> BookingService
    OwnerAPI --> RestaurantService
    VersionedAPI --> BookingService

    GuestAPI --> RateLimiter
    OpsAPI --> RateLimiter

    BookingService --> CustomerService
    BookingService --> LoyaltyService
    BookingService --> EmailService

    BookingService --> SupabaseClient
    CustomerService --> SupabaseClient
    RestaurantService --> SupabaseClient
    LoyaltyService --> SupabaseClient
    TeamService --> SupabaseClient

    SupabaseClient --> TypedQueries
    TypedQueries --> RLS

    BookingService --> Observability
    CustomerService --> Observability

    style GuestAPI fill:#e3f2fd
    style OpsAPI fill:#fff4e6
    style OwnerAPI fill:#f3e5f5
    style SupabaseClient fill:#c8e6c9
```

**Backend Technologies:**

| Technology    | Version  | Purpose                    |
| ------------- | -------- | -------------------------- |
| Node.js       | 20.11.0+ | Runtime environment        |
| Supabase      | Latest   | PostgreSQL database + Auth |
| Upstash Redis | 1.35.4   | Rate limiting & caching    |
| Resend        | 6.1.0    | Transactional emails       |
| Nodemailer    | 7.0.6    | Email fallback             |
| Zod           | 4.1.11   | API validation             |

---

## Application Layers

### Layer 1: Presentation Layer

**Responsibility:** User interface and user experience

```mermaid
graph TD
    subgraph "Pages"
        HomePage[Home Page<br/>src/app/page.tsx]
        ReservePage[Reserve Page<br/>src/app/reserve/r/[slug]/page.tsx]
        MyBookings[My Bookings<br/>src/app/my-bookings/page.tsx]
        OpsDashboard[Ops Dashboard<br/>src/app/ops/page.tsx]
    end

    subgraph "Components"
        Features[Feature Components<br/>src/components/features/]
        UI[UI Primitives<br/>src/components/ui/]
        Marketing[Marketing Components<br/>src/components/marketing/]
    end

    subgraph "Hooks"
        QueryHooks[React Query Hooks<br/>src/hooks/]
        FormHooks[Form Hooks]
    end

    HomePage --> Marketing
    ReservePage --> Features
    MyBookings --> Features
    OpsDashboard --> Features

    Features --> UI
    Features --> QueryHooks
    Features --> FormHooks

    style HomePage fill:#e3f2fd
    style Features fill:#fff4e6
```

**Key Patterns:**

- Server Components for initial render
- Client Components for interactivity
- Composition over inheritance
- Atomic design principles

---

### Layer 2: API Layer

**Responsibility:** HTTP request handling and routing

```mermaid
graph LR
    subgraph "Public Routes"
        GetRestaurants[GET /api/restaurants]
        PostBooking[POST /api/bookings]
        GetBookings[GET /api/bookings]
        PostLead[POST /api/lead]
        PostEvents[POST /api/events]
    end

    subgraph "Authenticated Routes"
        GetProfile[GET /api/profile]
        PutProfile[PUT /api/profile]
        GetMyBookings[GET /api/bookings?me=1]
    end

    subgraph "Operations Routes"
        OpsSummary[GET /api/ops/dashboard/summary]
        OpsBookings[GET /api/ops/bookings]
        OpsCustomers[GET /api/ops/customers]
    end

    subgraph "Owner Routes"
        RestaurantSettings[PUT /api/owner/restaurants/:id/details]
        OperatingHours[PUT /api/owner/restaurants/:id/hours]
        TeamInvites[POST /api/owner/team/invitations]
    end

    style GetRestaurants fill:#e3f2fd
    style GetProfile fill:#fff4e6
    style OpsSummary fill:#f3e5f5
    style RestaurantSettings fill:#c8e6c9
```

**API Design Principles:**

- RESTful conventions
- Consistent error responses
- Versioned endpoints (/api/v1/\*)
- Rate limiting on all routes
- Idempotency support

---

### Layer 3: Business Logic Layer

**Responsibility:** Core application logic and rules

```mermaid
graph TB
    subgraph "Booking Engine"
        ValidateBooking[Validate Booking]
        CheckAvailability[Check Availability]
        GenerateReference[Generate Reference]
        CalculateEndTime[Calculate End Time]
        ValidateOperatingHours[Validate Operating Hours]
        ValidatePastTime[Validate Past Time]
    end

    subgraph "Loyalty Engine"
        CheckProgram[Check Active Program]
        CalculatePoints[Calculate Points]
        ApplyPoints[Apply Points]
        UpdateTier[Update Tier]
    end

    subgraph "Customer Engine"
        UpsertCustomer[Upsert Customer]
        NormalizeContact[Normalize Contact Info]
        UpdateProfile[Update Profile]
    end

    subgraph "Team Engine"
        CreateInvitation[Create Invitation]
        ValidateToken[Validate Token]
        AcceptInvitation[Accept Invitation]
        ManageMembership[Manage Membership]
    end

    ValidateBooking --> CheckAvailability
    ValidateBooking --> ValidateOperatingHours
    ValidateBooking --> ValidatePastTime
    CheckAvailability --> GenerateReference
    GenerateReference --> CalculateEndTime
    CalculateEndTime --> CheckProgram
    CheckProgram --> CalculatePoints
    CalculatePoints --> ApplyPoints
    ApplyPoints --> UpdateTier

    ValidateBooking --> UpsertCustomer
    UpsertCustomer --> NormalizeContact

    style ValidateBooking fill:#fff4e6
    style CheckProgram fill:#e3f2fd
    style UpsertCustomer fill:#c8e6c9
```

**Business Rules:**

- Operating hours enforcement
- Past time blocking with grace period
- Loyalty point accrual formulas
- Idempotency key handling
- Reference uniqueness

---

### Layer 4: Data Access Layer

**Responsibility:** Database interactions and caching

```mermaid
graph TD
    subgraph "Supabase Client"
        ServiceRole[Service Role Client<br/>Admin Operations]
        AuthClient[Auth Client<br/>User Context]
        AnonClient[Anon Client<br/>Public Access]
    end

    subgraph "Database"
        PostgreSQL[(PostgreSQL)]
        RLS[Row-Level Security]
        Triggers[Database Triggers]
        Functions[Database Functions]
    end

    subgraph "Caching"
        RedisCache[(Redis Cache)]
        QueryCache[React Query Cache]
    end

    ServiceRole --> PostgreSQL
    AuthClient --> PostgreSQL
    AnonClient --> PostgreSQL

    PostgreSQL --> RLS
    PostgreSQL --> Triggers
    PostgreSQL --> Functions

    ServiceRole --> RedisCache
    AuthClient --> QueryCache

    style ServiceRole fill:#ffccbc
    style PostgreSQL fill:#c8e6c9
    style RedisCache fill:#f3e5f5
```

---

## Data Flow Architecture

### Booking Creation Flow

```mermaid
sequenceDiagram
    participant Guest
    participant Browser
    participant NextJS
    participant API
    participant BookingService
    participant LoyaltyService
    participant Database
    participant EmailService
    participant Redis

    Guest->>Browser: Fill booking form
    Browser->>NextJS: POST /api/bookings

    NextJS->>API: Route request
    API->>Redis: Check rate limit
    Redis-->>API: OK

    API->>API: Validate schema (Zod)
    API->>BookingService: Create booking

    BookingService->>Database: Check idempotency key
    Database-->>BookingService: No duplicate

    BookingService->>Database: Get restaurant schedule
    Database-->>BookingService: Schedule data

    BookingService->>BookingService: Validate operating hours
    BookingService->>BookingService: Validate past time
    BookingService->>BookingService: Calculate end time

    BookingService->>Database: Upsert customer
    Database-->>BookingService: Customer ID

    BookingService->>Database: Generate unique reference
    Database-->>BookingService: Reference

    BookingService->>Database: Insert booking
    Database-->>BookingService: Booking record

    BookingService->>LoyaltyService: Calculate points
    LoyaltyService->>Database: Get loyalty program
    Database-->>LoyaltyService: Program config
    LoyaltyService->>LoyaltyService: Calculate points
    LoyaltyService->>Database: Award points
    Database-->>LoyaltyService: Success

    BookingService->>Database: Update booking with points
    Database-->>BookingService: Updated record

    BookingService->>Database: Log audit event

    BookingService->>BookingService: Generate confirmation token
    BookingService->>Database: Store token

    BookingService->>EmailService: Queue confirmation email
    EmailService->>EmailService: Generate calendar attachment
    EmailService-->>BookingService: Queued

    BookingService-->>API: Booking created
    API-->>NextJS: 201 Response
    NextJS-->>Browser: Confirmation page
    Browser-->>Guest: Show success

    EmailService->>EmailService: Send email async
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextJS
    participant Middleware
    participant SupabaseAuth
    participant Database

    User->>Browser: Enter credentials
    Browser->>NextJS: POST /signin

    NextJS->>SupabaseAuth: signInWithPassword
    SupabaseAuth->>Database: Verify credentials
    Database-->>SupabaseAuth: User record

    SupabaseAuth->>SupabaseAuth: Generate JWT
    SupabaseAuth-->>NextJS: Session + tokens

    NextJS->>NextJS: Set HTTP-only cookies
    NextJS-->>Browser: Redirect with cookies

    Browser->>NextJS: Request protected page
    NextJS->>Middleware: Intercept request

    Middleware->>Middleware: Extract cookies
    Middleware->>SupabaseAuth: getUser()
    SupabaseAuth->>SupabaseAuth: Verify JWT
    SupabaseAuth-->>Middleware: User object

    Middleware->>Middleware: Check expiry
    alt Token expired
        Middleware->>SupabaseAuth: Refresh token
        SupabaseAuth-->>Middleware: New tokens
        Middleware->>Middleware: Update cookies
    end

    Middleware-->>NextJS: Continue with user context
    NextJS-->>Browser: Render page
```

---

## Security Architecture

### Authentication & Authorization

```mermaid
graph TB
    subgraph "Authentication Layer"
        SupabaseAuth[Supabase Auth<br/>JWT tokens]
        SessionMgmt[Session Management<br/>HTTP-only cookies]
        TokenRefresh[Automatic Token Refresh]
    end

    subgraph "Authorization Layer"
        RLS[Row-Level Security<br/>Database policies]
        RBAC[Role-Based Access Control<br/>restaurant_memberships]
        Ownership[Ownership Validation]
    end

    subgraph "Security Controls"
        RateLimiting[Rate Limiting<br/>Per endpoint]
        InputValidation[Input Validation<br/>Zod schemas]
        CSRF[CSRF Protection<br/>SameSite cookies]
        XSS[XSS Prevention<br/>React escaping]
    end

    subgraph "Audit & Monitoring"
        AuditLog[Audit Logging<br/>booking_versions]
        Observability[Observability Events]
        Alerting[Security Alerting]
    end

    SupabaseAuth --> SessionMgmt
    SessionMgmt --> TokenRefresh

    TokenRefresh --> RLS
    TokenRefresh --> RBAC
    TokenRefresh --> Ownership

    RLS --> RateLimiting
    RBAC --> RateLimiting

    RateLimiting --> InputValidation
    InputValidation --> CSRF
    CSRF --> XSS

    XSS --> AuditLog
    AuditLog --> Observability
    Observability --> Alerting

    style SupabaseAuth fill:#ffccbc
    style RLS fill:#c8e6c9
    style RateLimiting fill:#fff4e6
    style AuditLog fill:#e3f2fd
```

### Rate Limiting Architecture

```mermaid
graph LR
    subgraph "Rate Limit Tiers"
        Tier1[Public Endpoints<br/>60 req/min]
        Tier2[Guest Lookup<br/>20 req/min]
        Tier3[Confirmation<br/>20 req/min]
    end

    subgraph "Identification"
        IPBased[IP-Based<br/>Anonymous users]
        ResourceBased[Resource + IP<br/>Per restaurant]
        UserBased[User-Based<br/>Authenticated]
    end

    subgraph "Storage"
        Redis[(Upstash Redis<br/>Distributed)]
        SlidingWindow[Sliding Window<br/>Algorithm]
    end

    Tier1 --> ResourceBased
    Tier2 --> ResourceBased
    Tier3 --> IPBased

    IPBased --> Redis
    ResourceBased --> Redis
    UserBased --> Redis

    Redis --> SlidingWindow

    style Redis fill:#ffccbc
    style Tier1 fill:#fff4e6
```

---

## Deployment Architecture

### Production Environment

```mermaid
graph TB
    subgraph "Edge Network"
        CDN[Vercel Edge Network<br/>Global CDN]
        EdgeFunctions[Edge Functions<br/>Middleware]
    end

    subgraph "Compute Layer"
        ServerlessFunctions[Serverless Functions<br/>API Routes]
        SSR[Server-Side Rendering<br/>React Server Components]
    end

    subgraph "Data Persistence"
        SupabaseDB[(Supabase<br/>PostgreSQL)]
        RedisCloud[(Upstash Redis<br/>Global)]
        ObjectStorage[Supabase Storage<br/>S3-compatible]
    end

    subgraph "External Services"
        EmailAPI[Resend<br/>Email Delivery]
        Analytics[Analytics<br/>Events]
    end

    CDN --> EdgeFunctions
    EdgeFunctions --> ServerlessFunctions
    EdgeFunctions --> SSR

    ServerlessFunctions --> SupabaseDB
    ServerlessFunctions --> RedisCloud
    ServerlessFunctions --> ObjectStorage

    SSR --> SupabaseDB

    ServerlessFunctions --> EmailAPI
    ServerlessFunctions --> Analytics

    style CDN fill:#e3f2fd
    style SupabaseDB fill:#c8e6c9
    style RedisCloud fill:#ffccbc
```

### Deployment Pipeline

```mermaid
graph LR
    subgraph "Development"
        LocalDev[Local Development<br/>localhost:3000]
        GitCommit[Git Commit]
    end

    subgraph "CI/CD"
        GitHub[GitHub Repository]
        VercelCI[Vercel CI]
        TypeCheck[Type Check]
        Lint[ESLint]
        UnitTests[Unit Tests]
        E2ETests[E2E Tests]
    end

    subgraph "Preview"
        PreviewDeploy[Preview Deployment<br/>Per PR]
        PreviewURL[Unique URL]
    end

    subgraph "Production"
        ProdDeploy[Production Deploy<br/>main branch]
        ProdURL[sajiloreservex.com]
    end

    LocalDev --> GitCommit
    GitCommit --> GitHub
    GitHub --> VercelCI

    VercelCI --> TypeCheck
    TypeCheck --> Lint
    Lint --> UnitTests
    UnitTests --> E2ETests

    E2ETests --> PreviewDeploy
    PreviewDeploy --> PreviewURL

    GitHub -->|Merge to main| ProdDeploy
    ProdDeploy --> ProdURL

    style LocalDev fill:#fff4e6
    style GitHub fill:#e3f2fd
    style ProdDeploy fill:#c8e6c9
```

---

## Integration Architecture

### External Service Integration

```mermaid
graph TD
    subgraph "SajiloReserveX Core"
        BookingService[Booking Service]
        EmailQueue[Email Queue]
        AnalyticsQueue[Analytics Queue]
    end

    subgraph "Email Service"
        Resend[Resend API]
        Nodemailer[Nodemailer<br/>Fallback]
        EmailTemplates[Email Templates]
    end

    subgraph "Auth Service"
        SupabaseAuth[Supabase Auth]
        OAuth[OAuth Providers<br/>Google, etc.]
    end

    subgraph "Storage Service"
        SupabaseStorage[Supabase Storage]
        S3Compatible[S3-Compatible API]
    end

    subgraph "Monitoring"
        VercelAnalytics[Vercel Analytics]
        CustomEvents[Custom Events]
    end

    BookingService --> EmailQueue
    BookingService --> AnalyticsQueue

    EmailQueue --> Resend
    Resend -->|Failure| Nodemailer
    EmailQueue --> EmailTemplates

    BookingService --> SupabaseAuth
    SupabaseAuth --> OAuth

    BookingService --> SupabaseStorage
    SupabaseStorage --> S3Compatible

    AnalyticsQueue --> VercelAnalytics
    AnalyticsQueue --> CustomEvents

    style BookingService fill:#fff4e6
    style Resend fill:#e3f2fd
    style SupabaseAuth fill:#c8e6c9
```

---

## Scalability & Performance

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Distribution"
        LoadBalancer[Vercel Load Balancer<br/>Auto-scaling]
        Function1[Serverless Function<br/>Instance 1]
        Function2[Serverless Function<br/>Instance 2]
        FunctionN[Serverless Function<br/>Instance N]
    end

    subgraph "Database"
        Primary[(Primary PostgreSQL<br/>Write)]
        ReadReplica1[(Read Replica 1)]
        ReadReplica2[(Read Replica 2)]
    end

    subgraph "Caching"
        RedisCluster[(Redis Cluster<br/>Multi-region)]
        EdgeCache[Edge Cache<br/>Static Assets]
    end

    LoadBalancer --> Function1
    LoadBalancer --> Function2
    LoadBalancer --> FunctionN

    Function1 --> Primary
    Function2 --> ReadReplica1
    FunctionN --> ReadReplica2

    Function1 --> RedisCluster
    Function2 --> RedisCluster
    FunctionN --> RedisCluster

    LoadBalancer --> EdgeCache

    style LoadBalancer fill:#e3f2fd
    style Primary fill:#c8e6c9
    style RedisCluster fill:#ffccbc
```

### Performance Optimization Layers

```mermaid
graph LR
    subgraph "Browser"
        BrowserCache[Browser Cache]
        ServiceWorker[Service Worker<br/>Future]
    end

    subgraph "CDN"
        EdgeCache[Edge Cache<br/>Static Assets]
        EdgeCompute[Edge Compute<br/>Middleware]
    end

    subgraph "Application"
        ReactQuery[TanStack Query<br/>30s stale time]
        Memoization[React Memoization]
        Prefetch[Server Prefetch]
    end

    subgraph "Database"
        Indexes[Database Indexes]
        QueryOpt[Query Optimization]
        ConnectionPool[Connection Pooling]
    end

    BrowserCache --> EdgeCache
    EdgeCache --> EdgeCompute
    EdgeCompute --> ReactQuery

    ReactQuery --> Memoization
    Memoization --> Prefetch

    Prefetch --> Indexes
    Indexes --> QueryOpt
    QueryOpt --> ConnectionPool

    style BrowserCache fill:#e3f2fd
    style EdgeCache fill:#fff4e6
    style ReactQuery fill:#c8e6c9
    style Indexes fill:#f3e5f5
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Next.js App Router over Pages Router

**Status:** Accepted  
**Date:** 2024-01-01

**Context:**
Need to choose between Next.js Pages Router and App Router.

**Decision:**
Use App Router with React Server Components.

**Consequences:**

- ✅ Better performance (RSC)
- ✅ Improved developer experience
- ✅ Built-in loading/error states
- ❌ Newer, less documentation
- ❌ Some libraries not fully compatible

---

### ADR-002: Supabase for Database + Auth

**Status:** Accepted  
**Date:** 2024-01-01

**Context:**
Need managed database and authentication solution.

**Decision:**
Use Supabase for PostgreSQL, Auth, and Storage.

**Consequences:**

- ✅ Managed infrastructure
- ✅ Built-in Row-Level Security
- ✅ Real-time capabilities (future)
- ✅ Great developer experience
- ❌ Vendor lock-in
- ❌ Limited customization

---

### ADR-003: Upstash Redis for Rate Limiting

**Status:** Accepted  
**Date:** 2024-01-15

**Context:**
Need distributed rate limiting for API protection.

**Decision:**
Use Upstash Redis (serverless Redis).

**Consequences:**

- ✅ Global, low-latency access
- ✅ Pay-per-request pricing
- ✅ No infrastructure management
- ✅ Compatible with serverless
- ❌ Additional cost per request

---

### ADR-004: TanStack Query over Redux

**Status:** Accepted  
**Date:** 2024-01-01

**Context:**
Need client-side state management for server data.

**Decision:**
Use TanStack Query for server state, React Context for local UI state.

**Consequences:**

- ✅ Automatic caching and revalidation
- ✅ Optimistic updates
- ✅ Less boilerplate
- ✅ Built-in loading/error states
- ❌ Not suitable for complex local state

---

## System Boundaries

### What This System Does

✅ **Restaurant Reservation Management**

- Guest booking creation and management
- Real-time availability tracking
- Booking confirmation with tokens

✅ **Operations Dashboard**

- Daily booking monitoring
- Customer profile aggregation
- Walk-in management
- Data export

✅ **Team Management**

- Role-based access control
- Team invitations
- Membership management

✅ **Loyalty Program**

- Automatic point accrual
- Tier progression
- Point event tracking

✅ **Security & Compliance**

- Rate limiting
- Audit trails
- Authentication & authorization

---

### What This System Does NOT Do

❌ **Payment Processing**

- No credit card handling
- No payment gateway integration
- No billing/invoicing

❌ **Table Management**

- No floor plan visualization
- No table assignment logic
- No seating charts

❌ **Menu Management**

- No menu items
- No pricing
- No ordering

❌ **Inventory Management**

- No stock tracking
- No ingredient management

❌ **POS Integration**

- No point-of-sale integration
- No order management

❌ **Marketing Automation**

- Basic lead capture only
- No email campaigns
- No SMS marketing

---

## Future Architecture Considerations

### Planned Enhancements

1. **Real-Time Updates**
   - WebSocket integration via Supabase Realtime
   - Live dashboard updates
   - Push notifications

2. **Mobile Applications**
   - React Native mobile apps
   - Shared TypeScript types
   - Native push notifications

3. **Advanced Analytics**
   - Custom analytics dashboard
   - Predictive availability
   - Customer behavior insights

4. **Third-Party Integrations**
   - Google Maps integration
   - Calendar sync (Google, Apple)
   - POS system connectors

5. **Multi-Tenancy Optimization**
   - Restaurant-specific subdomains
   - White-label options
   - Custom branding

---

## Conclusion

The SajiloReserveX architecture is designed for:

- **Scalability:** Serverless functions auto-scale
- **Performance:** Edge caching, RSC, optimized queries
- **Security:** Multi-layered defense, RLS, rate limiting
- **Maintainability:** Type-safe, modular, well-tested
- **Developer Experience:** Modern tooling, clear patterns

**Key Strengths:**

- ✅ Production-ready infrastructure
- ✅ Type-safe end-to-end
- ✅ Comprehensive security
- ✅ Excellent performance metrics
- ✅ Clear separation of concerns

**Areas for Growth:**

- Real-time features
- Mobile applications
- Advanced analytics
- Third-party integrations

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Maintained By:** Engineering Team  
**Review Cycle:** Quarterly
