# Code Sections to Update in client-calendar.js

## Quick Reference: Line Numbers & Functions

### 1. loadCatalogs() - Lines ~1096-1180
**Old IDs Used:**
- `mobileStylistName` (line ~1125)
- `mobileServiceName` (line ~1162)

**Code Pattern:**
```javascript
// Mobile stylist select population
const mobileStylistSelect = byId("mobileStylistName");
if (mobileStylistSelect) { ... }

// Mobile service select population
const mobileServiceSelect = byId("mobileServiceName");
if (mobileServiceSelect && serviceSelect) {
  mobileServiceSelect.innerHTML = serviceSelect.innerHTML;
  mobileServiceSelect.value = serviceSelect.value || "";
}
```

**Update To:**
Replace all `mobile*` IDs with `booking*` equivalents

---

### 2. computeMobileEstimate() - Lines ~1188-1225
**Old IDs Used:**
- `mobileServiceName` (line ~1189)
- `mobileClientCount` (line ~1190)
- `mobileTimeEstimate` (line ~1201)
- `mobileBookingError` (line ~1211)
- `mobileConfirmReserveBtn` (line ~1214)

**Code Pattern:**
```javascript
function computeMobileEstimate() {
  const serviceName = (byId("mobileServiceName") || byId("serviceName")).value || "";
  const clientCount = Number((byId("mobileClientCount") || byId("clientCount")).value || 1);
  // ... calculation ...
  const estimateEl = byId("mobileTimeEstimate");
  if (estimateEl) {
    estimateEl.textContent = "Inicio: " + startText + "  Fin estimada: " + endText;
  }
  // ... error handling ...
  const errorEl = byId("mobileBookingError");
  const confirmBtn = byId("mobileConfirmReserveBtn");
}
```

---

### 3. openMobileBookingModal() - Lines ~1229-1260
**Old IDs Used:**
- `mobileBookingModal` (line ~1229)
- `mobileSelectedSlotText` (line ~1233)
- `mobileServiceName` (line ~1239-1242)
- `mobileStylistName` (line ~1244-1246)
- `mobileClientCount` (line ~1248-1250)

**Code Pattern:**
```javascript
function openMobileBookingModal() {
  const modal = byId("mobileBookingModal");
  const selectedText = byId("mobileSelectedSlotText");
  // ... sync logic ...
  const mobileService = byId("mobileServiceName");
  const mobileStylist = byId("mobileStylistName");
  const mobileClientCount = byId("mobileClientCount");
  modal.classList.remove("hidden");
  computeMobileEstimate();
}
```

---

### 4. closeMobileBookingModal() - Lines ~1262-1268
**Old IDs Used:**
- `mobileBookingModal` (line ~1264)

**Code Pattern:**
```javascript
function closeMobileBookingModal() {
  const modal = byId("mobileBookingModal");
  if (!modal) {
    return;
  }
  modal.classList.add("hidden");
}
```

---

### 5. registerMobileControls() IIFE - Lines ~1870-1965
**Largest section - multiple old IDs used:**

#### a) mobileServiceName change event (lines ~1872-1880)
```javascript
const mobileService = byId("mobileServiceName");
if (mobileService) {
  mobileService.addEventListener("change", function () {
    const mainService = byId("serviceName");
    if (mainService) {
      mainService.value = mobileService.value;
    }
    computeMobileEstimate();
  });
}
```

#### b) mobileStylistName change event (lines ~1882-1895)
```javascript
const mobileStylist = byId("mobileStylistName");
if (mobileStylist) {
  mobileStylist.addEventListener("change", function () {
    const mainStylist = byId("stylistName");
    if (mainStylist) {
      mainStylist.value = mobileStylist.value;
      state.selectedStylist = mainStylist.value || ANY_STYLIST_VALUE;
    }
    computeMobileEstimate();
  });
}
```

#### c) mobileClientCount input event (lines ~1897-1916)
```javascript
const mobileClientCount = byId("mobileClientCount");
if (mobileClientCount) {
  mobileClientCount.addEventListener("input", function () {
    const val = Number(mobileClientCount.value || 1);
    if (!Number.isInteger(val) || val < 1) {
      mobileClientCount.value = "1";
    } else if (val > 5) {
      mobileClientCount.value = "5";
    }
    const mainClient = byId("clientCount");
    if (mainClient) {
      mainClient.value = mobileClientCount.value;
    }
    computeMobileEstimate();
  });
}
```

#### d) closeMobileBookingBtn click event (lines ~1918-1923)
```javascript
const closeMobileBtn = byId("closeMobileBookingBtn");
if (closeMobileBtn) {
  closeMobileBtn.addEventListener("click", function () {
    closeMobileBookingModal();
  });
}
```

#### e) mobileConfirmReserveBtn click event (lines ~1925-1955)
```javascript
const mobileConfirmBtn = byId("mobileConfirmReserveBtn");
if (mobileConfirmBtn) {
  mobileConfirmBtn.addEventListener("click", function () {
    const mainService = byId("serviceName");
    const mainStylist = byId("stylistName");
    const mainClient = byId("clientCount");

    const mobileService = byId("mobileServiceName");
    const mobileStylist = byId("mobileStylistName");
    const mobileClientCount = byId("mobileClientCount");

    if (mobileService && mainService) {
      mainService.value = mobileService.value;
    }
    if (mobileStylist && mainStylist) {
      mainStylist.value = mobileStylist.value;
      state.selectedStylist = mainStylist.value || ANY_STYLIST_VALUE;
    }
    if (mobileClientCount && mainClient) {
      mainClient.value = mobileClientCount.value;
    }

    createReservation()
      .then(function () {
        closeMobileBookingModal();
      })
      .catch(function (error) {
        setFeedback(error.message, "warn");
      });
  });
}
```

---

### 6. Calendar Slot Selection Handler - Lines ~1741-1770
**No Changes Needed** - but this is where modal gets opened:

```javascript
byId("calendarBody").addEventListener("click", function (event) {
  // ... slot selection logic ...
  if (isClientContext) {
    openMobileBookingModal();  // <-- Calls modal open function
  }
});
```

---

## ID Replacement Reference Sheet

### Find & Replace Commands (regex):

```
Find: byId\("mobile([A-Z][a-zA-Z]*)\)
Replace: byId("booking$1")

Find: "mobile([A-Z][a-zA-Z]*)"
Replace: "booking$1"

EXCEPTIONS (keep as-is):
- "mobileStylistName" → "bookingStylistName"
- "mobileServiceName" → "bookingServiceName"
- "mobileClientCount" → "bookingClientCount"
- "mobileSelectedSlotText" → Consider merging or keep as reference
- "mobileTimeEstimate" → "bookingTimeEstimate"
- "mobileBookingError" → "bookingError"
- "mobileConfirmReserveBtn" → "confirmBookingBtn"
- "closeMobileBookingBtn" → "closeBookingBtn"
- "mobileBookingModal" → "bookingModal"
```

---

## Element ID Mapping Table (Copy-Paste Ready)

```
OLD ID                          NEW ID                    Location(s)
============================    =======================   ======================
mobileBookingModal              bookingModal              openMobileBookingModal, closeMobileBookingModal
mobileServiceName               bookingServiceName        loadCatalogs, computeMobileEstimate, registerMobileControls, openMobileBookingModal
mobileStylistName               bookingStylistName        loadCatalogs, computeMobileEstimate, registerMobileControls, openMobileBookingModal
mobileClientCount               bookingClientCount        computeMobileEstimate, registerMobileControls, openMobileBookingModal
mobileSelectedSlotText          (Keep or merge)           openMobileBookingModal
mobileTimeEstimate              bookingTimeEstimate       computeMobileEstimate
mobileBookingError              bookingError              computeMobileEstimate
mobileConfirmReserveBtn         confirmBookingBtn         computeMobileEstimate, registerMobileControls
closeMobileBookingBtn           closeBookingBtn           registerMobileControls
```

---

## Testing Checklist After Updates

- [ ] **Slot Selection**: Click available slot → modal opens with correct date/time
- [ ] **Form Sync**: Desktop selectors sync to modal on open
- [ ] **Service Change in Modal**: Change service → time estimate updates
- [ ] **Stylist Change in Modal**: Change stylist → estimate updates, mainStylist syncs
- [ ] **Client Count in Modal**: Change count → estimate updates, confirms 1-5 range
- [ ] **Error Display**: Select service/count that exceeds schedule → error shows, button disables
- [ ] **Confirmation**: Click confirm → values sync back to desktop, reservation created, modal closes
- [ ] **Close Button**: Click close button → modal closes without creating reservation
- [ ] **Desktop Selector Changes**: Change desktop service/stylist → modal reflects changes (if open)
- [ ] **Token Logic**: Logged out → confirm button disabled; Logged in → confirm button enabled
