# ANALYSIS COMPLETE: client-calendar.js DOM Elements & Modal Structure

## Executive Summary

✓ **Analysis Complete** for `/home/sena/Documentos/github/prueba/src/features/ui/scripts/client-calendar.js`

This file implements a **mobile booking modal** that opens when users select a calendar slot. The modal contains form fields for service, stylist, and client count, with real-time validation and time estimation. A restructure will consolidate mobile-specific IDs into unified "booking" namespaced IDs.

---

## KEY FINDINGS

### 1. Modal Architecture
- **Modal Type**: Floating modal (hidden by default, shown on slot selection)
- **Modal ID**: `mobileBookingModal` → Change to: `bookingModal`
- **Open Trigger**: User clicks available slot in calendar
- **Close Trigger**: User clicks close button OR confirm button
- **Backdrop Click**: NOT implemented (can't click outside to close)

### 2. Form Fields Inside Modal
```
Desktop (Main View):        Mobile (Modal View):         New Names:
serviceName          →      mobileServiceName      →     bookingServiceName
stylistName          →      mobileStylistName      →     bookingStylistName
clientCount          →      mobileClientCount      →     bookingClientCount
                            mobileSelectedSlotText        (merged or keep)
                            mobileTimeEstimate     →     bookingTimeEstimate
                            mobileBookingError     →     bookingError
```

### 3. Button Controls in Modal
| Current ID | Purpose | New ID |
|-----------|---------|--------|
| `mobileConfirmReserveBtn` | Confirm booking | `confirmBookingBtn` |
| `closeMobileBookingBtn` | Close modal | `closeBookingBtn` |

### 4. Functions Requiring Updates
| Function | Line | Change Count | Priority |
|----------|------|--------------|----------|
| `loadCatalogs()` | ~1096 | 2 IDs | HIGH |
| `computeMobileEstimate()` | ~1188 | 5 IDs | HIGH |
| `openMobileBookingModal()` | ~1229 | 4 IDs | HIGH |
| `closeMobileBookingModal()` | ~1262 | 1 ID | MEDIUM |
| `registerMobileControls()` | ~1870 | 8 IDs | HIGH |

### 5. Event Listeners Registered
```
Event listeners in registerMobileControls() IIFE:
✓ bookingServiceName.addEventListener("change", ...)
✓ bookingStylistName.addEventListener("change", ...)
✓ bookingClientCount.addEventListener("input", ...)
✓ closeBookingBtn.addEventListener("click", ...)
✓ confirmBookingBtn.addEventListener("click", ...)

Plus other listeners:
✓ calendarBody.addEventListener("click", ...) → opens modal
✓ stylistName.addEventListener("change", ...) → refills calendar
✓ serviceName.addEventListener("change", ...) → updates duration
```

### 6. Data Sync Mechanism

**Desktop → Modal (on open):**
```
serviceName.value        → bookingServiceName.value
stylistName.value        → bookingStylistName.value
clientCount.value        → bookingClientCount.value
state.selectedSlot       → mobileSelectedSlotText display
```

**Modal → Desktop (on change in modal):**
```
bookingServiceName.value → serviceName.value
bookingStylistName.value → stylistName.value
bookingClientCount.value → clientCount.value
```

### 7. Validation Logic (computeMobileEstimate)

```
1. Read form values from modal
2. Calculate service duration based on stylist
3. Multiply by client count
4. Calculate end time: startTime + duration
5. Validate: endTime <= workSchedule.end
   ✓ If valid:    Show estimate, enable button
   ✗ If invalid:  Show error, disable button
```

### 8. Show/Hide Logic for Modal

```
Hidden State (default):
├─ modal.classList contains "hidden"
└─ CSS: display: none

Visible State (after slot selection):
├─ modal.classList.remove("hidden")
├─ All form fields populated from desktop
├─ computeMobileEstimate() validates
└─ CSS: display: block (or flex)

Close Triggers:
├─ closeBookingBtn click → closeMobileBookingModal()
├─ confirmBookingBtn click → createReservation() → closeMobileBookingModal()
└─ (No backdrop click handler currently)
```

---

## DETAILED ELEMENT REFERENCE TABLE

### All OLD Element IDs (17 total)

| # | Old ID | Type | Component | New ID | Functions Using It |
|---|--------|------|-----------|--------|-------------------|
| 1 | `mobileBookingModal` | DIV (container) | Modal wrapper | `bookingModal` | open/closeMobileBookingModal |
| 2 | `mobileServiceName` | SELECT | Service dropdown | `bookingServiceName` | loadCatalogs, computeMobileEstimate, registerMobileControls, openMobileBookingModal |
| 3 | `mobileStylistName` | SELECT | Stylist dropdown | `bookingStylistName` | loadCatalogs, computeMobileEstimate, registerMobileControls, openMobileBookingModal |
| 4 | `mobileClientCount` | INPUT | Client count field | `bookingClientCount` | computeMobileEstimate, registerMobileControls, openMobileBookingModal |
| 5 | `mobileSelectedSlotText` | SPAN/DIV | Slot display | (merge or `bookingSlotText`) | openMobileBookingModal |
| 6 | `mobileTimeEstimate` | SPAN/DIV | Duration display | `bookingTimeEstimate` | computeMobileEstimate |
| 7 | `mobileBookingError` | DIV | Error message | `bookingError` | computeMobileEstimate |
| 8 | `mobileConfirmReserveBtn` | BUTTON | Confirm button | `confirmBookingBtn` | computeMobileEstimate, registerMobileControls |
| 9 | `closeMobileBookingBtn` | BUTTON | Close button | `closeBookingBtn` | registerMobileControls |

### DESKTOP Elements (NOT changing)

| Element ID | Type | Component | Keep As-Is |
|-----------|------|-----------|-----------|
| `serviceName` | SELECT | Desktop service dropdown | ✓ YES |
| `stylistName` | SELECT | Desktop stylist dropdown | ✓ YES |
| `clientCount` | INPUT | Desktop client count | ✓ YES |

---

## CODE LOCATIONS REQUIRING UPDATES

### Function 1: loadCatalogs() - Lines ~1096-1180
**Location**: Between `state.stylists` population and service population
**Changes**: 2 ID updates
```javascript
Line ~1125: byId("mobileStylistName")  →  byId("bookingStylistName")
Line ~1162: byId("mobileServiceName")  →  byId("bookingServiceName")
```

### Function 2: computeMobileEstimate() - Lines ~1188-1225
**Location**: Modal validation function called every time form changes
**Changes**: 5 ID updates
```javascript
Line ~1189: byId("mobileServiceName")     →  byId("bookingServiceName")
Line ~1190: byId("mobileClientCount")     →  byId("bookingClientCount")
Line ~1201: byId("mobileTimeEstimate")    →  byId("bookingTimeEstimate")
Line ~1211: byId("mobileBookingError")    →  byId("bookingError")
Line ~1214: byId("mobileConfirmReserveBtn") →  byId("confirmBookingBtn")
```

### Function 3: openMobileBookingModal() - Lines ~1229-1260
**Location**: Opens modal and syncs desktop values
**Changes**: 4 ID updates
```javascript
Line ~1229: byId("mobileBookingModal")     →  byId("bookingModal")
Line ~1239: byId("mobileServiceName")      →  byId("bookingServiceName")
Line ~1244: byId("mobileStylistName")      →  byId("bookingStylistName")
Line ~1248: byId("mobileClientCount")      →  byId("bookingClientCount")
```

### Function 4: closeMobileBookingModal() - Lines ~1262-1268
**Location**: Closes modal by hiding
**Changes**: 1 ID update
```javascript
Line ~1264: byId("mobileBookingModal")  →  byId("bookingModal")
```

### Function 5: registerMobileControls() - Lines ~1870-1965
**Location**: IIFE that registers 5 event listeners
**Changes**: 8 ID updates
```javascript
Line ~1872: byId("mobileServiceName")      →  byId("bookingServiceName")  [change listener]
Line ~1884: byId("mobileStylistName")      →  byId("bookingStylistName")  [change listener]
Line ~1899: byId("mobileClientCount")      →  byId("bookingClientCount")  [input listener]
Line ~1920: byId("closeMobileBookingBtn")   →  byId("closeBookingBtn")     [click listener]
Line ~1927: byId("mobileServiceName")      →  byId("bookingServiceName")  [in confirm handler]
Line ~1928: byId("mobileStylistName")      →  byId("bookingStylistName")  [in confirm handler]
Line ~1929: byId("mobileClientCount")      →  byId("bookingClientCount")  [in confirm handler]
Line ~1932: byId("mobileConfirmReserveBtn") →  byId("confirmBookingBtn")  [click listener]
```

---

## EVENT LISTENER MAPPING

### Slot Selection Handler
```javascript
Location: Line ~1741
Trigger:  Click on .slot-btn.available button
Handler:  Updates state.selectedSlot → Calls openMobileBookingModal()
Effect:   Modal opens with slot info and synced form values
```

### Modal Form Change Handlers
```javascript
Location: Lines ~1872-1916 (in registerMobileControls)

1. bookingServiceName.addEventListener("change", ...)
   ├─ Syncs to serviceName
   └─ Calls computeMobileEstimate()

2. bookingStylistName.addEventListener("change", ...)
   ├─ Syncs to stylistName
   ├─ Updates state.selectedStylist
   └─ Calls computeMobileEstimate()

3. bookingClientCount.addEventListener("input", ...)
   ├─ Validates range 1-5
   ├─ Syncs to clientCount
   └─ Calls computeMobileEstimate()
```

### Modal Control Button Handlers
```javascript
Location: Lines ~1918-1955 (in registerMobileControls)

1. closeBookingBtn.addEventListener("click", ...)
   └─ Calls closeMobileBookingModal()

2. confirmBookingBtn.addEventListener("click", ...)
   ├─ Syncs modal form values to desktop selectors
   ├─ Calls createReservation()
   ├─ On success: closeMobileBookingModal()
   └─ On error: setFeedback(error.message)
```

---

## MODAL STATE TRANSITIONS

```
┌─────────────────────────────────────────────┐
│ INITIAL STATE: Modal Hidden                  │
│ ├─ modal.classList = "hidden"                │
│ └─ display: none (CSS)                       │
└─────────────────────────────────────────────┘
           │
           │ User clicks available slot
           ↓
┌─────────────────────────────────────────────┐
│ OPENING: Modal preparing to show             │
│ ├─ Get slot from state.selectedSlot          │
│ ├─ Update mobileSelectedSlotText             │
│ ├─ Sync: serviceName → bookingServiceName    │
│ ├─ Sync: stylistName → bookingStylistName    │
│ ├─ Sync: clientCount → bookingClientCount    │
│ └─ Call computeMobileEstimate()              │
└─────────────────────────────────────────────┘
           │
           │ modal.classList.remove("hidden")
           ↓
┌─────────────────────────────────────────────┐
│ VISIBLE: Modal shown to user                 │
│ ├─ display: block/flex (CSS)                 │
│ ├─ All form fields populated                 │
│ ├─ Time estimate displayed                   │
│ └─ Confirm button enabled/disabled based     │
│    on validation                             │
└─────────────────────────────────────────────┘
           │
           ├─────────────────┬─────────────────┐
           │                 │                 │
      [Close]            [Change Form]      [Confirm]
           │                 │                 │
           ↓                 ↓                 ↓
    CLOSING              VALIDATING        CONFIRMING
    (no booking)         (re-estimate)     (create API call)
           │                 │                 │
           └─────────────────┴─────────────────┘
                        │
                        ↓
        ┌─────────────────────────────────────────┐
        │ HIDDEN: Modal hidden again              │
        │ ├─ modal.classList.add("hidden")        │
        │ └─ display: none (CSS)                  │
        └─────────────────────────────────────────┘
```

---

## VALIDATION FLOW (computeMobileEstimate)

```
Input Variables:
├─ slot: {date: "2026-05-06", time: "14:00"}
├─ serviceName: "Corte" (from bookingServiceName)
├─ stylistId: "1" (from bookingStylistName)
└─ clientCount: 2 (from bookingClientCount)
   │
   ├─→ baseDuration = serviceDurationByName["Corte"] = 30 min
   ├─→ adjustedDuration = 30 × 2 clients = 60 min
   ├─→ startDate = "2026-05-06T14:00:00"
   ├─→ endDate = startDate + 60 min = "2026-05-06T15:00:00"
   │
   ├─→ workSchedule = state.workScheduleByDate["2026-05-06"]
   │                = {offDay: false, start: "06:00", end: "22:00"}
   │
   ├─→ endMinutes = 15 * 60 = 900
   ├─→ allowedEndMinutes = 22 * 60 = 1320
   │
   ├─→ Validation: 900 ≤ 1320?
   │   │
   │   ├─ YES: ✓ VALID
   │   │  ├─ mobileTimeEstimate.textContent = "Inicio: 14:00  Fin estimada: 15:00"
   │   │  ├─ mobileBookingError.classList.add("hidden")
   │   │  └─ mobileConfirmReserveBtn.disabled = false
   │   │
   │   └─ NO: ✗ INVALID
   │      ├─ mobileTimeEstimate.textContent = "Inicio: 14:00  Fin estimada: 22:30"
   │      ├─ mobileBookingError.textContent = "Se sobrepasa el tiempo estimado..."
   │      ├─ mobileBookingError.classList.remove("hidden")
   │      └─ mobileConfirmReserveBtn.disabled = true
   │
   └─→ Output: Display updated, button state changed

Note: This function is called:
  1. When modal opens
  2. When service select changes
  3. When stylist select changes
  4. When client count changes
```

---

## DESKTOP VS MODAL ELEMENTS

```
Desktop View (Always Visible):
┌─────────────────────────────────┐
│ Calendar Controls:              │
├─────────────────────────────────┤
│ Service:  [serviceName ▼]       │
│ Stylist:  [stylistName ▼]       │
│ Clients:  [clientCount  ]       │
│ [Refresh] [Book]                │
├─────────────────────────────────┤
│ Calendar Table                  │
│ (7-day grid of slots)           │
│ [Reservar] [Ocupado] [...]      │
└─────────────────────────────────┘

Mobile Modal (Opens on Slot Click):
┌──────────────────────────────────┐
│ Slot: 2026-05-06 a las 14:00     │
├──────────────────────────────────┤
│ Service: [bookingServiceName ▼]  │
│ Stylist: [bookingStylistName ▼]  │
│ Clients: [bookingClientCount  ]  │
├──────────────────────────────────┤
│ Inicio: 14:00 Fin: 15:00         │
├──────────────────────────────────┤
│ ⚠ Error msg (if invalid)         │
├──────────────────────────────────┤
│ [Confirmar] [Cerrar]             │
└──────────────────────────────────┘
```

---

## TOTAL CHANGES REQUIRED

| Metric | Count |
|--------|-------|
| **Functions to update** | 5 |
| **Element IDs to change** | 9 |
| **Total byId() calls to update** | 20 |
| **Event listeners to update** | 5 |
| **Functions to keep unchanged** | 3 (createReservation, etc.) |
| **Desktop selectors to preserve** | 3 (serviceName, stylistName, clientCount) |

---

## MIGRATION STRATEGY

### Phase 1: Update IDs in loadCatalogs()
- Update mobileStylistName → bookingStylistName
- Update mobileServiceName → bookingServiceName
- Test: Catalog loads in both desktop and modal

### Phase 2: Update computeMobileEstimate()
- Update all 5 element ID references
- Test: Open modal, change form fields, see estimate update

### Phase 3: Update open/close functions
- Update openMobileBookingModal() (4 IDs)
- Update closeMobileBookingModal() (1 ID)
- Test: Slot selection opens modal with correct values

### Phase 4: Update registerMobileControls()
- Update all 5 event listener element references
- Update all elements in confirm button handler
- Test: Each form change updates estimate and confirm button

### Phase 5: Integration Testing
- Test slot selection → modal open → form changes → confirm
- Test desktop selector changes reflected in modal
- Test error validation
- Test close without confirming
- Verify no console errors

---

## LINKED ANALYSIS DOCUMENTS

Created 4 comprehensive analysis files in `/home/sena/Documentos/github/prueba/.agent/analysis/`:

1. **client-calendar-element-mapping.md** (9 sections)
   - Complete element reference table
   - All DOM references
   - Event listener setup
   - Modal functions
   - Show/hide logic
   - Dependencies
   - Summary table
   - Implementation checklist

2. **client-calendar-update-guide.md** (Line numbers & code patterns)
   - Quick reference for each section
   - Find & replace commands
   - Element ID mapping table
   - Testing checklist

3. **client-calendar-architecture.md** (Visual diagrams & flows)
   - Overall architecture diagram
   - Data flow diagrams
   - Function call tree
   - State object structure
   - CSS classes reference
   - Element dependency graph
   - Testing scenarios

4. **client-calendar-quick-ref.md** (One-page summary)
   - New element IDs
   - Functions needing updates
   - All byId() calls reference
   - Automated find & replace patterns
   - Validation checklist
   - Common mistakes
   - Line-by-line summary

---

## NEXT STEPS

1. ✓ Review all 4 analysis documents
2. → Update [src/features/ui/scripts/client-calendar.js](src/features/ui/scripts/client-calendar.js)
3. → Update HTML template with new element IDs
4. → Test modal functionality
5. → Verify data synchronization
6. → Test all edge cases (validation, errors, close, confirm)
