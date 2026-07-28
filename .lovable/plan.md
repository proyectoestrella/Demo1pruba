
# Los Mosqueteros — Plan

A premium, mobile-first salon SaaS clickable MVP. Two surfaces: a public booking website and a private salon dashboard. Multi-tenant data shape, but only one demo salon ("Los Mosqueteros") is seeded. No real auth, no real payments, no backend — pure frontend with mock data and an in-memory store so a booking made on the public site appears live in the dashboard.

## 1. Tech & Architecture

- TanStack Start + React + Tailwind + shadcn/ui + Recharts + Zustand for the shared in-memory store.
- Mock data in `src/lib/mock/` (salon, services, employees, clients, appointments, derive). Seeded deterministically so charts and the calendar look real.
- Multi-tenant shape: every entity carries `salonId`; routes are scoped by `:salonSlug` even though only `los-mosqueteros` is seeded.
- Design tokens in `src/styles.css` — premium minimal palette (off-white, ink black, single warm accent), display serif for headings (e.g. Fraunces) + clean sans (Inter Tight) for body. All colors via semantic tokens, no hardcoded hex.
- Each route gets its own `head()` with title + description + og tags.

## 2. Route Map

```text
src/routes/
  index.tsx                              → Marketing landing (sells to salon owners)
  s.$salonSlug.tsx                       → Public salon site layout (header + footer)
  s.$salonSlug.index.tsx                 → Salon home (hero, about, services, team, cancellation, footer)
  s.$salonSlug.book.tsx                  → 4-step booking wizard
  s.$salonSlug.confirmation.tsx          → Booking confirmation
  s.$salonSlug.waitlist.tsx              → Join waiting list flow
  app.tsx                                → Dashboard layout (sidebar + topbar + Outlet)
  app.index.tsx                          → Dashboard home (KPIs)
  app.calendar.tsx                       → Day/Week/Month calendar
  app.appointments.tsx                   → Appointments list
  app.clients.tsx                        → CRM
  app.employees.tsx                      → Employees mgmt
  app.services.tsx                       → Services CRUD
  app.insights.tsx                       → AI Analytics & Insights
  app.marketing.tsx                      → AI Marketing Assistant
  app.waitlist.tsx                       → Waitlist queue
  app.settings.tsx                       → Salon profile, hours, policies
```

Public demo salon slug: `los-mosqueteros`. The dashboard is open (no login) and acts as the owner of that salon.

## 3. Public Client Website (`/s/los-mosqueteros`)

Mobile-first, conversion-focused. Sections:

1. **Sticky header** — logo, nav (Services, Team, About, Contact), prominent "Book Appointment" CTA.
2. **Hero** — full-bleed salon image, serif headline "Book Your Hair Appointment in Seconds", subtitle, two CTAs (Book Now, View Services).
3. **About** — short editorial paragraph + 3 trust stats.
4. **Services** — card grid (image, name, duration, price, "Book" button). 6 services: Haircut, Beard Trim, Hair Color, Highlights, Keratin Treatment, Hairstyling.
5. **Team** — 3 stylists (Ines, Manuela, Luna) with photo, specialty, years of experience.
6. **Cancellation policy** — 3 clean cards: free until 24h, deposit non-refundable after 24h, no-show loses deposit.
7. **Footer** — legal links, socials, contact, opening hours.

### Booking wizard (`/s/:slug/book`)

Single page with stepped state + progress bar. NO login until step 4.

- **Step 1 — Service**: card grid, click to select.
- **Step 2 — Professional**: Ines / Manuela / Luna / "No preference".
- **Step 3 — Date & time**: horizontal date strip (next 21 days) + time-slot grid. Color coding: green = available, gray = taken, red = closed/blocked. Slots derived from employee schedule + existing appointments in the mock store.
- **Step 4 — Identify**: only now ask for phone/email + Google/Apple buttons (mock; click → fills demo identity). Show inline "or continue as guest".
- **Step 5 — Confirmation screen**: service, stylist, date, time, duration, total, and a deposit block if duration > 90 min (20%). Apple Pay / Google Pay mock buttons + "Confirm booking" primary CTA. On confirm: push appointment into the Zustand store, navigate to `/s/:slug/confirmation`.

If a chosen slot is taken, offer "Join waiting list" → `/s/:slug/waitlist` (name, phone, service, preferred stylist, time range).

## 4. Private Dashboard (`/app/*`)

Persistent left sidebar: Home · Calendar · Appointments · Clients · Employees · Services · Insights · Marketing · Waitlist · Settings. Topbar with salon switcher (single salon for demo), date, "New appointment" button.

- **Home** — KPI strip (today's appointments, today's revenue, weekly occupancy %, new customers this week, cancellations, most booked service) + revenue line chart (30d) + bookings-per-day bar.
- **Calendar** — Day / Week / Month tabs. Week view is the hero: hour rows × employee columns, appointment blocks color-coded per employee (Ines pink, Manuela blue, Luna black). Drag-and-drop reschedule (using `dnd-kit`), click block → drawer with details, "+ New appointment" modal, block-time modal, mark break/lunch, cancel.
- **Appointments** — filterable table (status, date range, service, employee).
- **Clients (CRM)** — list + detail drawer: name, phone, history, total spent, favorite services, visit frequency.
- **Employees** — CRUD: schedules, vacations, specialties, blocked days, working hours.
- **Services** — CRUD: name, image, duration, price, active toggle, deposit-required indicator (auto if >90 min).
- **Insights (AI cards)** — generated from `derive.ts` against mock data, rendered as premium AI cards with sparkline/icon. Examples seeded:
  - "Tuesday afternoons have 38% occupancy — your lowest window."
  - "Highlights generate 42% of revenue this month."
  - "Luna has 78% client retention — highest on the team."
  - "Keratin clients return on average every 8 weeks."
- **Marketing assistant** — AI suggestion cards with one-click "Generate campaign" mock action: Tuesday-afternoon promo, win-back for 6+ week dormant clients, loyalty push, Instagram caption draft. WhatsApp integration shown as a mocked panel ("Coming soon — connect WhatsApp Business").
- **Waitlist** — queue list with match indicators ("Matches Tuesday 4pm slot"), notify button (mock), auto-flow explanation panel describing the 2h-before WhatsApp confirmation logic.
- **Settings** — salon profile, hours, cancellation policy, deposit %.

## 5. Mock Data

`src/lib/mock/`:
- `salon.ts` — Los Mosqueteros (slug, logo, address, hours, socials, policy).
- `services.ts` — 6 services with images, durations, prices. `requiresDeposit = duration > 90`.
- `employees.ts` — Ines / Manuela / Luna with color tokens, specialties, schedules.
- `clients.ts` — ~50 clients with visit history.
- `appointments.ts` — ~300 appointments across last 90d + next 21d, weighted statuses (~8% no-show, ~5% cancelled), distributed across employees and hours.
- `waitlist.ts` — ~6 entries.
- `derive.ts` — pure compute fns for KPIs, occupancy, revenue, retention, top services, busiest hours, AI insight strings.

Shared Zustand store wraps appointments + waitlist so the public booking → dashboard handoff is live during demo.

## 6. Out of Scope (left for later)

- Real auth, real Google/Apple OAuth, real payments / Apple Pay / Google Pay.
- Real WhatsApp / SMS / email.
- True multi-salon tenancy UI (signup, salon switcher with real data, billing).
- Real backend / database — no Lovable Cloud for the MVP.
- Reviews, loyalty point math, POS, inventory, payroll.

## 7. Demo Script

1. Land on `/` → click "View demo salon" → `/s/los-mosqueteros`.
2. Browse hero/services/team → click Book on "Keratin Treatment" (>90 min).
3. Wizard: pick Luna → pick tomorrow 4pm → identify as "Sofia" → see 20% deposit + Apple Pay mock → Confirm.
4. Land on confirmation.
5. Open `/app` → Home shows the booking in today's KPIs.
6. Calendar (Week) → new booking visible as a black block under Luna's column → drag to 5pm.
7. Insights → walk the AI cards.
8. Marketing → trigger "Send Tuesday promo" mock.
9. Waitlist → show queue and match indicator.

---

Want me to adjust anything (sidebar order, accent color direction, which sections to drop/add, or seed a second salon) before I start building?
