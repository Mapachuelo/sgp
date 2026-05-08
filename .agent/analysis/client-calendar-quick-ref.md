# QUICK REFERENCE: Element ID Changes

## One-Page Summary

### NEW ELEMENT IDs (Use These)
```javascript
// Modal & Container
bookingModal                  // was: mobileBookingModal
bookingServiceName            // was: mobileServiceName
bookingStylistName            // was: mobileStylistName
bookingClientCount            // was: mobileClientCount
bookingTimeEstimate           // was: mobileTimeEstimate
bookingError                  // was: mobileBookingError
confirmBookingBtn             // was: mobileConfirmReserveBtn
closeBookingBtn               // was: closeMobileBookingBtn
mobileSelectedSlotText        // consider merging or renaming
```

### KEEP THESE UNCHANGED
```javascript
serviceName                   // Desktop selector (used for sync)
stylistName                   // Desktop selector (used for sync)
clientCount                   // Desktop input (used for sync)
```

---

## Functions That Need Updating

### 1. loadCatalogs() 
**Lines: ~1125, ~1162**
```diff
- const mobileStylistSelect = byId("mobileStylistName");
+ const mobileStylistSelect = byId("bookingStylistName");

- const mobileServiceSelect = byId("mobileServiceName");
+ const mobileServiceSelect = byId("bookingServiceName");
```

### 2. computeMobileEstimate()
**Lines: ~1189, 1190, 1201, 1211, 1214**
```diff
- const serviceName = (byId("mobileServiceName") || byId("serviceName")).value || "";
+ const serviceName = (byId("bookingServiceName") || byId("serviceName")).value || "";

- const clientCount = Number((byId("mobileClientCount") || byId("clientCount")).value || 1);
+ const clientCount = Number((byId("bookingClientCount") || byId("clientCount")).value || 1);

- const estimateEl = byId("mobileTimeEstimate");
+ const estimateEl = byId("bookingTimeEstimate");

- const errorEl = byId("mobileBookingError");
+ const errorEl = byId("bookingError");

- const confirmBtn = byId("mobileConfirmReserveBtn");
+ const confirmBtn = byId("confirmBookingBtn");
```

### 3. openMobileBookingModal()
**Lines: ~1229-1250**
```diff
- const modal = byId("mobileBookingModal");
+ const modal = byId("bookingModal");

- const mobileService = byId("mobileServiceName");
+ const mobileService = byId("bookingServiceName");

- const mobileStylist = byId("mobileStylistName");
+ const mobileStylist = byId("bookingStylistName");

- const mobileClientCount = byId("mobileClientCount");
+ const mobileClientCount = byId("bookingClientCount");
```

### 4. closeMobileBookingModal()
**Lines: ~1264**
```diff
- const modal = byId("mobileBookingModal");
+ const modal = byId("bookingModal");
```

### 5. registerMobileControls() IIFE
**Lines: ~1870-1955** (5 event listeners)

#### Service change handler:
```diff
- const mobileService = byId("mobileServiceName");
+ const mobileService = byId("bookingServiceName");
```

#### Stylist change handler:
```diff
- const mobileStylist = byId("mobileStylistName");
+ const mobileStylist = byId("bookingStylistName");
```

#### Client count input handler:
```diff
- const mobileClientCount = byId("mobileClientCount");
+ const mobileClientCount = byId("bookingClientCount");
```

#### Close button handler:
```diff
- const closeMobileBtn = byId("closeMobileBookingBtn");
+ const closeMobileBtn = byId("closeBookingBtn");
```

#### Confirm button handler (multiple lines):
```diff
- const mobileService = byId("mobileServiceName");
+ const mobileService = byId("bookingServiceName");

- const mobileStylist = byId("mobileStylistName");
+ const mobileStylist = byId("bookingStylistName");

- const mobileClientCount = byId("mobileClientCount");
+ const mobileClientCount = byId("bookingClientCount");

- const mobileConfirmBtn = byId("mobileConfirmReserveBtn");
+ const mobileConfirmBtn = byId("confirmBookingBtn");
```

---

## All byId() Calls to Update

Search for these patterns and update:

| Old Pattern | New Pattern |
|------------|-----------|
| `byId("mobileBookingModal")` | `byId("bookingModal")` |
| `byId("mobileServiceName")` | `byId("bookingServiceName")` |
| `byId("mobileStylistName")` | `byId("bookingStylistName")` |
| `byId("mobileClientCount")` | `byId("bookingClientCount")` |
| `byId("mobileTimeEstimate")` | `byId("bookingTimeEstimate")` |
| `byId("mobileBookingError")` | `byId("bookingError")` |
| `byId("mobileConfirmReserveBtn")` | `byId("confirmBookingBtn")` |
| `byId("closeMobileBookingBtn")` | `byId("closeBookingBtn")` |

---

## All String Literals to Update

| Old String | New String |
|-----------|-----------|
| `"mobileBookingModal"` | `"bookingModal"` |
| `"mobileServiceName"` | `"bookingServiceName"` |
| `"mobileStylistName"` | `"bookingStylistName"` |
| `"mobileClientCount"` | `"bookingClientCount"` |
| `"mobileTimeEstimate"` | `"bookingTimeEstimate"` |
| `"mobileBookingError"` | `"bookingError"` |
| `"mobileConfirmReserveBtn"` | `"confirmBookingBtn"` |
| `"closeMobileBookingBtn"` | `"closeBookingBtn"` |

---

## Event Listeners That Need Updating

All in `registerMobileControls()` function (Lines 1870-1965):

1. ✓ `byId("bookingServiceName").addEventListener("change", ...)`
2. ✓ `byId("bookingStylistName").addEventListener("change", ...)`
3. ✓ `byId("bookingClientCount").addEventListener("input", ...)`
4. ✓ `byId("closeBookingBtn").addEventListener("click", ...)`
5. ✓ `byId("confirmBookingBtn").addEventListener("click", ...)`

---

## Cross-References (Desktop Selectors - DO NOT CHANGE)

These are referenced in multiple places but should STAY AS-IS:

```javascript
// DO NOT CHANGE:
byId("serviceName")           // Main desktop service select
byId("stylistName")           // Main desktop stylist select
byId("clientCount")           // Main desktop client count input
```

They are used for:
- Desktop calendar view
- Syncing TO modal on open
- Syncing FROM modal on confirm
- Creating the actual reservation

---

## Form Value Sync Flow (Before & After)

### BEFORE (Old IDs)
```javascript
// Opening modal (sync desktop → mobile)
mobileServiceName.value = serviceName.value
mobileStylistName.value = stylistName.value
mobileClientCount.value = clientCount.value

// On confirm (sync modal → desktop)
serviceName.value = mobileServiceName.value
stylistName.value = mobileStylistName.value
clientCount.value = mobileClientCount.value
```

### AFTER (New IDs)
```javascript
// Opening modal (sync desktop → mobile)
bookingServiceName.value = serviceName.value
bookingStylistName.value = stylistName.value
bookingClientCount.value = clientCount.value

// On confirm (sync modal → desktop)
serviceName.value = bookingServiceName.value
stylistName.value = bookingStylistName.value
clientCount.value = bookingClientCount.value
```

---

## Automated Find & Replace (VS Code)

### Find all `byId("mobile*")` calls:
```regex
byId\("mobile([A-Z][a-zA-Z]*)"\)
```

### Replace with:
```regex
byId("booking$1")
```

⚠️ **Exceptions** (need manual handling):
- `byId("mobileStylistName")` → Special pattern with "Stylist"
- `byId("mobileServiceName")` → Special pattern with "Service"
- `byId("mobileClientCount")` → Special pattern with "Client"
- `byId("closeMobileBookingBtn")` → Non-standard naming

---

## Validation Checklist

- [ ] Find and replace all `mobileBookingModal` → `bookingModal`
- [ ] Find and replace all `mobileServiceName` → `bookingServiceName`
- [ ] Find and replace all `mobileStylistName` → `bookingStylistName`
- [ ] Find and replace all `mobileClientCount` → `bookingClientCount`
- [ ] Find and replace all `mobileTimeEstimate` → `bookingTimeEstimate`
- [ ] Find and replace all `mobileBookingError` → `bookingError`
- [ ] Find and replace all `mobileConfirmReserveBtn` → `confirmBookingBtn`
- [ ] Find and replace all `closeMobileBookingBtn` → `closeBookingBtn`
- [ ] Verify `serviceName` NOT changed (desktop selector)
- [ ] Verify `stylistName` NOT changed (desktop selector)
- [ ] Verify `clientCount` NOT changed (desktop selector)
- [ ] Test: Slot selection opens modal
- [ ] Test: Form fields sync from desktop
- [ ] Test: Changing modal fields updates estimate
- [ ] Test: Error display works
- [ ] Test: Confirm button works
- [ ] Test: Modal closes
- [ ] Browser console: No errors about missing elements

---

## Common Mistakes to Avoid

❌ **DON'T** change desktop selectors:
- `serviceName` ← KEEP
- `stylistName` ← KEEP
- `clientCount` ← KEEP

❌ **DON'T** change function names:
- `openMobileBookingModal()` ← KEEP name
- `closeMobileBookingModal()` ← KEEP name
- `computeMobileEstimate()` ← KEEP name
- `registerMobileControls()` ← KEEP name

❌ **DON'T** change CSS class names:
- `.hidden` ← KEEP
- `.available` ← KEEP
- `.selected` ← KEEP
- `.slot-btn` ← KEEP

✓ **DO** update only element IDs used in `byId()` calls

✓ **DO** test after each function update

✓ **DO** verify sync mechanism works (desktop ↔ modal)

---

## Line-by-Line Update Summary

| Function | Line(s) | Changes Needed |
|----------|---------|----------------|
| `loadCatalogs()` | ~1125, ~1162 | 2 ID updates |
| `computeMobileEstimate()` | ~1189, ~1190, ~1201, ~1211, ~1214 | 5 ID updates |
| `openMobileBookingModal()` | ~1229, ~1239, ~1244, ~1248 | 4 ID updates |
| `closeMobileBookingModal()` | ~1264 | 1 ID update |
| `registerMobileControls()` | ~1872, ~1884, ~1899, ~1920, ~1927, ~1928, ~1929, ~1932 | 8 ID updates |
| **TOTAL** | **5 functions** | **20 ID updates** |

---

## Testing with Browser DevTools

```javascript
// Verify all element IDs exist:
console.log(document.getElementById("bookingModal"));              // should exist
console.log(document.getElementById("bookingServiceName"));        // should exist
console.log(document.getElementById("bookingStylistName"));        // should exist
console.log(document.getElementById("bookingClientCount"));        // should exist
console.log(document.getElementById("bookingTimeEstimate"));       // should exist
console.log(document.getElementById("bookingError"));              // should exist
console.log(document.getElementById("confirmBookingBtn"));         // should exist
console.log(document.getElementById("closeBookingBtn"));           // should exist

// Verify desktop selectors still work:
console.log(document.getElementById("serviceName"));               // should exist
console.log(document.getElementById("stylistName"));               // should exist
console.log(document.getElementById("clientCount"));               // should exist
```
