# Client Calendar JS - Element ID Mapping & Modal Analysis

## Summary
The file uses a **mobile booking modal** system (`mobileBookingModal`) that opens when a calendar slot is selected. It maintains synced values between desktop and mobile selectors. The restructure will consolidate these into a single floating modal with updated element IDs.

---

## 1. MODAL-RELATED CODE

### Current Modal System
- **Mobile Modal Element ID**: `mobileBookingModal`
- **Mobile Modal Functions**:
  - `openMobileBookingModal()` - Opens when slot is selected (Line ~1200)
  - `closeMobileBookingModal()` - Closes modal (Line ~1227)

### Modal Open/Close Logic
```
TRIGGER: When user clicks available slot (slot-btn.available click handler, Line ~1741)
  → Calls openMobileBookingModal() for client context
  → Modal shows with slot details and form fields

CLOSE TRIGGERS:
  1. User clicks close button (closeMobileBookingBtn)
  2. User confirms booking (mobileConfirmReserveBtn)
  3. (No backdrop click handler for mobile modal)
```

### Modal Functions Detail
```javascript
// Line ~1200: Opens mobile booking modal, syncs desktop values
openMobileBookingModal()
  - Gets slot from state.selectedSlot
  - Sets mobileSelectedSlotText with date/time
  - Syncs values from main selectors to mobile selectors
  - Calls computeMobileEstimate()

// Line ~1227: Closes mobile modal
closeMobileBookingModal()
  - Hides mobileBookingModal element
```

---

## 2. FORM FIELD REFERENCES (OLD ELEMENT IDS)

### Main Desktop Selectors/Inputs
| Element ID | Purpose | Type | Referenced In Functions |
|-----------|---------|------|----------------------|
| `serviceName` | Service dropdown (desktop) | `<select>` | `loadCatalogs()`, `createReservation()`, `computeMobileEstimate()`, event listener |
| `stylistName` | Stylist dropdown (desktop) | `<select>` | `loadCatalogs()`, `createReservation()`, event listener |
| `clientCount` | Client count input (desktop) | `<input>` | `getSelectedClientCount()`, `createReservation()`, event listener |

### Mobile Modal Selectors/Inputs
| Element ID | Purpose | Type | Referenced In Functions |
|-----------|---------|------|----------------------|
| `mobileServiceName` | Service dropdown (mobile) | `<select>` | `loadCatalogs()`, `computeMobileEstimate()`, event listener |
| `mobileStylistName` | Stylist dropdown (mobile) | `<select>` | `loadCatalogs()`, `computeMobileEstimate()`, event listener |
| `mobileClientCount` | Client count input (mobile) | `<input>` | `computeMobileEstimate()`, event listener |

### Mobile Modal Display Elements
| Element ID | Purpose | Type | Referenced In Functions |
|-----------|---------|------|----------------------|
| `mobileSelectedSlotText` | Shows "Horario seleccionado: DATE a las TIME" | `<div/span>` | `openMobileBookingModal()` |
| `mobileTimeEstimate` | Shows "Inicio: XX:XX  Fin estimada: XX:XX" | `<div/span>` | `computeMobileEstimate()` |
| `mobileBookingError` | Shows error if time exceeds schedule | `<div>` | `computeMobileEstimate()` |

### Mobile Modal Control Buttons
| Element ID | Purpose | Referenced In Functions |
|-----------|---------|----------------------|
| `mobileConfirmReserveBtn` | Confirm booking button | `computeMobileEstimate()` (disable logic), `registerMobileControls()` event listener |
| `closeMobileBookingBtn` | Close modal button | `registerMobileControls()` event listener |

---

## 3. EVENT LISTENERS - BOOKING MODAL RELATED

### Mobile Modal Control Registration (Lines ~1870-1965)
Wrapped in `registerMobileControls()` IIFE, registered once:

```javascript
// mobileServiceName change event
Event: "change"
Handler: Syncs to mainService, calls computeMobileEstimate()

// mobileStylistName change event  
Event: "change"
Handler: Syncs to mainStylist, updates state.selectedStylist, calls computeMobileEstimate()

// mobileClientCount input event
Event: "input"
Handler: 
  - Validates range (1-5)
  - Syncs to mainClient
  - Calls computeMobileEstimate()

// closeMobileBookingBtn click event
Event: "click"
Handler: Calls closeMobileBookingModal()

// mobileConfirmReserveBtn click event
Event: "click"
Handler: 
  - Syncs all mobile values to main selectors
  - Calls createReservation()
  - On success: closeMobileBookingModal()
  - On error: setFeedback with error message
```

### Calendar Slot Selection (Lines ~1741-1770)
```javascript
Element: calendarBody
Event: "click" on .slot-btn.available buttons
Handler:
  - Stores selected slot in state.selectedSlot
  - Updates visual selection (added/removed "selected" class)
  - Updates selectedSlotLabel
  - If isClientContext: CALLS openMobileBookingModal()
  - Sets feedback messages
```

### Desktop Selector Changes (Lines ~1825-1860)
```javascript
// stylistName change event
Event: "change"
Handler: 
  - Updates state.selectedStylist
  - Preserves weekStart
  - Calls refreshCalendar()

// serviceName change event
Event: "change"
Handler:
  - Updates service duration
  - Clears state.selectedSlot
  - Calls renderCalendar()
  - NOTE: Does NOT open modal (desktop-only workflow)
```

---

## 4. ELEMENT ID CHANGE MAPPING

### Migration Plan: Mobile Modal → Floating Modal

| Current ID | New ID | Component | Notes |
|-----------|--------|-----------|-------|
| `mobileBookingModal` | `bookingModal` | Modal container | Primary booking modal |
| `mobileServiceName` | `bookingServiceName` | Service select | Can keep reference logic |
| `mobileStylistName` | `bookingStylistName` | Stylist select | Can keep reference logic |
| `mobileClientCount` | `bookingClientCount` | Client count input | Can keep reference logic |
| `mobileSelectedSlotText` | (merged) | Slot display | Could merge into modal title |
| `mobileTimeEstimate` | `bookingTimeEstimate` | Duration display | Renamed for clarity |
| `mobileBookingError` | `bookingError` | Error message | Simplified name |
| `mobileConfirmReserveBtn` | `confirmBookingBtn` | Confirm button | Simplified name |
| `closeMobileBookingBtn` | `closeBookingBtn` | Close button | Simplified name |

### Desktop Selector Status
| ID | Status | Notes |
|----|--------|-------|
| `serviceName` | KEEP | Still used for desktop view & syncing |
| `stylistName` | KEEP | Still used for desktop view & syncing |
| `clientCount` | KEEP | Still used for desktop view & syncing |

---

## 5. SHOW/HIDE LOGIC FOR BOOKING MODAL

### Open Conditions (openMobileBookingModal)
```javascript
Prerequisites:
  ✓ Modal element exists (byId("mobileBookingModal"))
  ✓ state.selectedSlot is not null

Side Effects:
  - Sets mobileSelectedSlotText with current slot info
  - Syncs values: main → mobile selectors
  - Calls computeMobileEstimate() to validate
  - Removes "hidden" class from modal
```

### Close Conditions (closeMobileBookingModal)
```javascript
Always:
  - Adds "hidden" class to modal

Manual triggers:
  1. User clicks closeMobileBookingBtn
  2. User confirms reservation (in mobileConfirmReserveBtn handler)
  3. Could add backdrop click handler (currently NOT present)
```

### Visual State (computeMobileEstimate)
```javascript
Updates:
  - mobileTimeEstimate: Shows start and estimated end time
  - mobileBookingError: Shows/hides error if exceeds schedule
  - mobileConfirmReserveBtn: Disables/enables based on:
    * Schedule validation
    * isClientContext check
    * Token existence (getToken())

Triggers:
  - When modal opens
  - When any modal select/input changes
  - When main selectors change (if mobile modal open)
```

---

## 6. DATA FLOW & SYNC MECHANISM

### Slot Selection Flow
```
User clicks available slot button
  ↓
calendarBody click handler
  ↓
state.selectedSlot = {date, time}
  ↓
If isClientContext:
  openMobileBookingModal()
    ↓
    Sync desktop values → mobile inputs
    ↓
    computeMobileEstimate() validates & updates display
    ↓
    Modal visible with populated form
```

### Form Value Syncing
```
Desktop → Mobile (on modal open):
  serviceName → mobileServiceName
  stylistName → mobileStylistName
  clientCount → mobileClientCount

Mobile → Desktop (on field change):
  mobileServiceName → serviceName
  mobileStylistName → stylistName
  mobileClientCount → clientCount

Mobile → Desktop (on confirm):
  All mobile values → desktop values
  Then createReservation() uses desktop values
```

---

## 7. KEY FUNCTIONS REQUIRING UPDATES

### Functions Directly Using Old Element IDs
| Function | Current IDs | Update Required |
|----------|------------|-----------------|
| `computeMobileEstimate()` | mobileServiceName, mobileClientCount, mobileTimeEstimate, mobileBookingError, mobileConfirmReserveBtn | Map all to new IDs |
| `openMobileBookingModal()` | mobileBookingModal, mobileSelectedSlotText, mobileServiceName, mobileStylistName, mobileClientCount | Map all to new IDs |
| `closeMobileBookingModal()` | mobileBookingModal | Map to bookingModal |
| `registerMobileControls()` | All mobile element IDs | Map all to new IDs |
| `loadCatalogs()` | mobileStylistName, mobileServiceName | Map to new IDs |

### Functions Using Existing Desktop IDs (No Change Needed)
- `getSelectedClientCount()` - Uses clientCount ✓
- `createReservation()` - Uses serviceName, stylistName, clientCount ✓
- `setAuthUi()` - Uses reserveBtn ✓

---

## 8. DEPENDENCIES & CAUTIONS

### Critical Dependencies
1. **state.selectedSlot** - Must exist before modal can open
2. **computeMobileEstimate()** - Called frequently, must be optimized
3. **Sync mechanism** - Desktop and mobile values must stay in sync
4. **Token validation** - confirmBookingBtn enable/disable logic depends on getToken()

### Potential Breaking Changes
- If removing backdrop click handlers, add one for new modal
- If changing modal positioning, ensure slot selection is still visible
- Form validation happens in computeMobileEstimate() - don't remove it

### Current Limitations (to consider)
- Mobile modal has NO backdrop click handler (can't close by clicking outside)
- mobileSelectedSlotText might have limited space on very small screens
- No explicit "loading" state during API calls to createReservation()

---

## 9. SUMMARY TABLE: ALL ELEMENT REFERENCES

| Element ID | Current Location | Type | Used In | Change To |
|-----------|------------------|------|---------|-----------|
| `mobileBookingModal` | Modal container | DIV | openMobileBookingModal, closeMobileBookingModal | `bookingModal` |
| `mobileServiceName` | Form select | SELECT | loadCatalogs, computeMobileEstimate, registerMobileControls, openMobileBookingModal | `bookingServiceName` |
| `mobileStylistName` | Form select | SELECT | loadCatalogs, computeMobileEstimate, registerMobileControls, openMobileBookingModal | `bookingStylistName` |
| `mobileClientCount` | Form input | INPUT | computeMobileEstimate, registerMobileControls, openMobileBookingModal | `bookingClientCount` |
| `mobileSelectedSlotText` | Display text | SPAN/DIV | openMobileBookingModal | Keep or merge |
| `mobileTimeEstimate` | Display text | SPAN/DIV | computeMobileEstimate | `bookingTimeEstimate` |
| `mobileBookingError` | Error display | DIV | computeMobileEstimate | `bookingError` |
| `mobileConfirmReserveBtn` | Button | BUTTON | computeMobileEstimate, registerMobileControls | `confirmBookingBtn` |
| `closeMobileBookingBtn` | Button | BUTTON | registerMobileControls | `closeBookingBtn` |
| `serviceName` | Form select | SELECT | **KEEP** - used by desktop & sync | No change |
| `stylistName` | Form select | SELECT | **KEEP** - used by desktop & sync | No change |
| `clientCount` | Form input | INPUT | **KEEP** - used by desktop & sync | No change |

---

## Implementation Checklist

- [ ] Update all `byId("mobile*")` calls to new ID names
- [ ] Update `loadCatalogs()` mobile section
- [ ] Update `computeMobileEstimate()` completely
- [ ] Update `openMobileBookingModal()` completely  
- [ ] Update `closeMobileBookingModal()` 
- [ ] Update `registerMobileControls()` IIFE
- [ ] Test slot selection → modal opening flow
- [ ] Test form value syncing (desktop ↔ mobile)
- [ ] Test service/stylist/count changes in modal
- [ ] Test confirmation button enable/disable logic
- [ ] Test error display on schedule validation
- [ ] Consider adding backdrop click handler for UX
