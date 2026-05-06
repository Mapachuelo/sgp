# client-calendar.js - Architecture & Flow Diagram

## Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT CALENDAR VIEW                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌──────────────────┐             │
│  │ Calendar Table   │      │ Desktop Controls │             │
│  │ (slot-btn)       │      │ (serviceName,    │             │
│  │                  │      │  stylistName,    │             │
│  │ [Reservar]       │      │  clientCount)    │             │
│  │ [Ocupado]        │      │                  │             │
│  │ [No laboral]     │      └──────────────────┘             │
│  └────────┬─────────┘             ▲                         │
│           │                        │                        │
│           │ Click available slot   │ Synced values          │
│           │                        │ (if modal open)        │
│           ▼                        │                        │
│  ┌────────────────────────────────┴──────────────┐         │
│  │      MOBILE BOOKING MODAL (Floating)           │         │
│  │  ┌─────────────────────────────────────────┐  │         │
│  │  │ Selected Slot: 2026-05-06 a las 14:00   │  │         │
│  │  ├─────────────────────────────────────────┤  │         │
│  │  │ Service:  [bookingServiceName ▼]        │  │         │
│  │  │ Stylist:  [bookingStylistName ▼]        │  │         │
│  │  │ Clients:  [bookingClientCount  ]        │  │         │
│  │  ├─────────────────────────────────────────┤  │         │
│  │  │ Inicio: 14:00  Fin estimada: 14:30      │  │         │
│  │  ├─────────────────────────────────────────┤  │         │
│  │  │ ⚠ Error (if exceeds schedule)           │  │         │
│  │  ├─────────────────────────────────────────┤  │         │
│  │  │ [Confirmar]  [Cerrar]                   │  │         │
│  │  └─────────────────────────────────────────┘  │         │
│  └───────────────────────────────────────────────┘         │
│                        ▲                                    │
│                        │ openMobileBookingModal()           │
│                        │ closeMobileBookingModal()          │
│                        │                                    │
└────────────────────────┼────────────────────────────────────┘
                         │
                   ┌─────▼────────┐
                   │ STATE OBJECT │
                   ├──────────────┤
                   │selectedSlot  │
                   │stylists      │
                   │services      │
                   │workSchedule  │
                   └──────────────┘
```

---

## Data Flow: Slot Selection to Reservation

```
1. USER CLICKS AVAILABLE SLOT
   │
   ├─→ calendarBody.addEventListener("click") handler triggered
   │
   ├─→ state.selectedSlot = {date, time} ✓ Stored
   │
   ├─→ Visual update: slot-btn.selected class added
   │
   ├─→ updateSelectedSlotLabel() → Updates UI feedback
   │
   └─→ if (isClientContext) openMobileBookingModal()
       │
       ├─→ Get modal element: byId("bookingModal")
       │
       ├─→ Set display text: byId("mobileSelectedSlotText")
       │
       ├─→ SYNC PHASE: Main selectors → Mobile modal
       │   ├─→ serviceName.value → bookingServiceName.value
       │   ├─→ stylistName.value → bookingStylistName.value
       │   └─→ clientCount.value → bookingClientCount.value
       │
       ├─→ computeMobileEstimate() - VALIDATION PHASE
       │   ├─→ Get modal form values
       │   ├─→ Calculate service duration
       │   ├─→ Calculate end time
       │   ├─→ Validate against work schedule
       │   ├─→ Set bookingTimeEstimate text
       │   ├─→ Show/hide bookingError
       │   └─→ Enable/disable confirmBookingBtn
       │
       └─→ modal.classList.remove("hidden") → VISIBLE


2. USER CHANGES MODAL FORM FIELDS
   │
   ├─→ bookingServiceName.addEventListener("change")
   │   ├─→ Update serviceName (sync back)
   │   └─→ Call computeMobileEstimate()
   │
   ├─→ bookingStylistName.addEventListener("change")
   │   ├─→ Update stylistName (sync back)
   │   ├─→ Update state.selectedStylist
   │   └─→ Call computeMobileEstimate()
   │
   └─→ bookingClientCount.addEventListener("input")
       ├─→ Validate: 1-5 range
       ├─→ Update clientCount (sync back)
       └─→ Call computeMobileEstimate()


3. USER CLICKS "CONFIRMAR" BUTTON
   │
   ├─→ confirmBookingBtn.addEventListener("click") handler triggered
   │
   ├─→ SYNC PHASE: Modal values → Main selectors (final)
   │   ├─→ bookingServiceName.value → serviceName.value
   │   ├─→ bookingStylistName.value → stylistName.value
   │   └─→ bookingClientCount.value → clientCount.value
   │
   ├─→ createReservation() called
   │   ├─→ Validate: token exists, slot selected, service/stylist filled
   │   ├─→ API POST /api/reservations
   │   ├─→ On success:
   │   │   ├─→ setFeedback("Reserva registrada...")
   │   │   ├─→ refreshCalendar()
   │   │   └─→ loadMyReservations()
   │   └─→ On error:
   │       └─→ setFeedback(error.message)
   │
   └─→ closeMobileBookingModal()
       └─→ modal.classList.add("hidden") → HIDDEN


4. USER CLICKS "CERRAR" BUTTON
   │
   ├─→ closeBookingBtn.addEventListener("click")
   │
   └─→ closeMobileBookingModal()
       └─→ modal.classList.add("hidden") → HIDDEN
           (No reservation created)
```

---

## Function Call Tree

```
boot()
├── refreshClientSessionState()
├── loadCatalogs()
│   ├── Populate serviceName options
│   ├── Populate stylistName options
│   ├── Populate bookingServiceName options    ← OLD: mobileServiceName
│   └── Populate bookingStylistName options    ← OLD: mobileStylistName
├── refreshCalendar()
│   ├── fetchWorkScheduleRange()
│   ├── fetchAvailabilityByDay() × N days
│   └── renderCalendar()
└── loadMyReservations()
    └── Render reservation list


User Interaction Handlers:
├── calendarBody click → openMobileBookingModal()
│   ├── computeMobileEstimate()
│   │   ├── inferServiceDurationMinutes()
│   │   └── getSelectedClientCount()
│   └── sync desktop → modal values
│
├── bookingServiceName change → computeMobileEstimate()
├── bookingStylistName change → computeMobileEstimate()
├── bookingClientCount input → computeMobileEstimate()
│
├── confirmBookingBtn click → createReservation()
│   ├── sync modal → desktop values
│   ├── refreshCalendar()
│   └── loadMyReservations()
│   └── closeMobileBookingModal()
│
└── closeBookingBtn click → closeMobileBookingModal()
```

---

## State Object Structure

```javascript
state = {
  // Calendar data
  days: [Date, Date, ...],
  weekStart: "2026-05-06",
  availabilityByDate: {
    "2026-05-06": [reservation, reservation, ...],
    "2026-05-07": [...]
  },
  workScheduleByDate: {
    "2026-05-06": {offDay: false, start: "06:00", end: "22:00"},
    "2026-05-07": {...}
  },
  
  // Selection state
  selectedSlot: null,  // {date: "2026-05-06", time: "14:00"}
  selectedStylist: "__any__",  // or stylist ID
  selectedServiceDuration: 30,  // minutes
  
  // User data
  currentUser: {id, name, role, email, phone},
  
  // Catalogs
  stylists: [{id, name}, ...],
  serviceDurationByName: {"Corte": 30, "Tinte": 60},
  serviceDurationByNameAndStylist: {
    "Corte": {"1": 25, "2": 30},
    "Tinte": {"1": 60}
  },
  
  // Reservations (client)
  myReservations: [reservation, ...],
  myReservationsLoadVersion: 1,
  reservationQrById: {"123": "data:image/png;base64,..."},
  
  // Viewport
  viewportConfig: {
    dayCount: 7,
    startHour: 6,
    endHour: 22
  }
}
```

---

## computeMobileEstimate() Logic Detail

```
computeMobileEstimate() {
  1. GET INPUTS
     serviceName = bookingServiceName.value
     clientCount = bookingClientCount.value (1-5)
  
  2. CALCULATE DURATION
     baseDuration = inferServiceDurationMinutes(serviceName)
     totalDuration = baseDuration × clientCount
  
  3. CALCULATE END TIME
     startDate = {date}T{time}:00
     endDate = startDate + totalDuration minutes
     endText = format(endDate.hours:minutes)
  
  4. DISPLAY ESTIMATE
     SET bookingTimeEstimate.textContent = "Inicio: HH:MM  Fin estimada: HH:MM"
  
  5. VALIDATE AGAINST SCHEDULE
     workSchedule = state.workScheduleByDate[date]
     endMinutes = toMinutes(endText)
     allowedEndMinutes = toMinutes(workSchedule.end)
     
     IF endMinutes > allowedEndMinutes:
       ├─→ SHOW bookingError (set textContent, remove "hidden")
       ├─→ DISABLE confirmBookingBtn
       └─→ Return (don't allow booking)
     
     ELSE:
       ├─→ HIDE bookingError (add "hidden")
       └─→ ENABLE confirmBookingBtn (if token + isClientContext)
}
```

---

## Modal Visibility States

```
State 1: HIDDEN (default)
├─ modal.classList contains "hidden"
└─ Display: none (via CSS)

State 2: OPENING (when slot selected)
├─ modal.classList.remove("hidden")
├─ Sync values from desktop
├─ computeMobileEstimate() validates
└─ Display: visible

State 3: FORM ACTIVE (user interacting)
├─ User changes service/stylist/count
├─ computeMobileEstimate() re-runs
├─ Display updates dynamically
└─ Confirm button enable/disable state changes

State 4: CONFIRMING (user clicks confirm)
├─ Sync values back to desktop
├─ createReservation() API call
├─ (If success) closeMobileBookingModal()
└─ Modal returns to HIDDEN

State 5: CLOSING (user clicks close)
├─ No validation/sync needed
├─ modal.classList.add("hidden")
└─ Modal returns to HIDDEN
```

---

## CSS Classes Used

```
Modal Container:
├─ .hidden           = display: none (toggleable)
└─ (other modal styles)

Form Elements:
├─ (standard select/input styles)
└─ (no special toggle classes)

Display Elements:
├─ bookingTimeEstimate: plain text update
├─ bookingError: toggles .hidden class
└─ bookingError.textContent: set on display

Buttons:
├─ confirmBookingBtn: .disabled attribute (property)
└─ (no toggle classes for buttons)

Calendar Slots:
├─ .slot-btn                 = all slot buttons
├─ .slot-btn.available       = clickable slots
├─ .slot-btn.reserved        = disabled slots
├─ .slot-btn.selected        = currently selected slot
└─ (colors via CSS classes)
```

---

## Element Dependency Graph

```
bookingModal (container)
├─ mobileSelectedSlotText (display: slot info)
├─ bookingServiceName (select: tied to serviceName)
├─ bookingStylistName (select: tied to stylistName)
├─ bookingClientCount (input: tied to clientCount)
├─ bookingTimeEstimate (display: computed output)
├─ bookingError (display: conditional, toggled hidden)
├─ confirmBookingBtn (button: disable logic)
│  └─ depends on: computeMobileEstimate() validation
└─ closeBookingBtn (button: always enabled)

State Dependencies:
state.selectedSlot
├─ required for: openMobileBookingModal() to work
├─ set by: calendar slot click
└─ cleared by: service change, client count change

state.selectedStylist
├─ used by: computeMobileEstimate() (via inferServiceDurationMinutes)
├─ synced with: bookingStylistName
└─ updated by: stylistName change

state.serviceDurationByName[serviceName]
└─ used by: computeMobileEstimate() → inferServiceDurationMinutes()

state.workScheduleByDate[date]
└─ used by: computeMobileEstimate() → validation logic
```

---

## Migration Impact Summary

| Aspect | Impact | Action |
|--------|--------|--------|
| **Function Updates** | 5 functions need ID changes | Update byId() calls |
| **Event Listeners** | 5 listeners use old IDs | Update element references |
| **Data Flow** | No changes (internal logic stays same) | Test thoroughly |
| **CSS Classes** | No changes (still uses .hidden) | No action needed |
| **State Object** | No changes | No action needed |
| **API Endpoints** | No changes | No action needed |
| **Desktop Selectors** | NO changes (serviceName, stylistName, clientCount stay same) | Keep as-is |
| **Sync Mechanism** | No logic changes (just ID updates) | Test sync flows |
| **Validation Logic** | No changes (computeMobileEstimate stays same internally) | No action needed |

---

## Backward Compatibility

⚠️ **BREAKING CHANGE**: If HTML still uses old IDs, these functions will fail silently:
- Modal won't open
- Form fields won't sync
- Buttons won't bind events

✓ **SAFE**: Desktop selectors (serviceName, stylistName, clientCount) are not changing, so desktop workflow unaffected.

✓ **SAFE**: Slot selection mechanism unchanged.

---

## Testing Scenarios

```
Scenario 1: First Load
├─ App boots
├─ Catalogs load (desktop + modal selectors)
├─ Calendar renders
└─ Modal is hidden ✓

Scenario 2: Slot Selection
├─ Click available slot
├─ Modal opens ✓
├─ Slot text displays ✓
├─ Form values synced from desktop ✓
└─ computeMobileEstimate() runs ✓

Scenario 3: Service Change (modal open)
├─ Change bookingServiceName
├─ serviceName updates ✓
├─ computeMobileEstimate() runs ✓
├─ Time estimate updates ✓
└─ Confirm button state changes (if needed) ✓

Scenario 4: Validation Error
├─ Select service/count that exceeds schedule
├─ computeMobileEstimate() detects ✓
├─ bookingError shows ✓
├─ confirmBookingBtn disabled ✓
└─ Can't submit ✓

Scenario 5: Successful Booking
├─ Select valid service/stylist/count
├─ All values sync to desktop
├─ Click confirm
├─ API call succeeds ✓
├─ Modal closes ✓
├─ Calendar refreshes ✓
└─ Reservations list updates ✓

Scenario 6: Modal Close
├─ Click close button
├─ Modal hides ✓
├─ No reservation created ✓
└─ No API call made ✓
```
