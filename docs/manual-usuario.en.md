# User Manual — SGP

Hair Salon Management System user guide for customers, employees and administrators. Screenshots in `docs/img/` (see also `docs/mockups.md`).

## 1. Sign in

1. Open `http://localhost:8080`.
2. On **Iniciar sesión / Sign in**, enter email and password. The system detects the role and redirects automatically.
3. Use the **EN/ES** button in the top bar to switch language; the preference is saved per user.

![Sign in](img/login.png)

### 1.1 Create an account (customers only)

1. On the login screen, click **Regístrate / Sign up**.
2. Fill in first name, last name, Colombian phone (`+57` plus 10 digits), email and password.
3. A 6-digit OTP code is emailed; the account becomes active after verification.

![Sign up](img/registro.png)

### 1.2 Verify your account

1. Open **/verificar** (registration redirects there automatically).
2. Enter the 6-digit code. The screen shows a countdown: **you have 5 minutes to verify**.
3. If the registration expires, the account is deleted and the email becomes available: use "Register again".
4. If the code did not arrive, use **Resend code** (max 3 times every 15 minutes); resending restarts the registration window.
5. Unverified accounts cannot log in (403 "Cuenta no verificada").

![Verification](img/verificar.png)

## 2. Customer

### 2.1 Book an appointment

1. **Step 1 — Venue:** search by name/city and choose on the list or the map.
2. **Step 2 — Stylist:** available stylists for that venue in the next 6 days are listed.
3. **Step 3 — Calendar:** pick day and time. Colors: green available, red busy, grey past, blue unavailable, amber less than 60 minutes ahead.
4. **Step 4 — Confirm:** a floating window shows service, **estimated duration (start → end time)**, people (1–5) and total.
5. **Step 5 — Payment and QR:** the entry QR code is generated with a **Download QR** button. Cash is recorded on arrival; "Online payment" keeps the amount at 0.

If the slot is taken while you decide, you get an error and the calendar refreshes to pick another time. Limit: 5 active bookings.

![Booking step 1](img/cliente-reservar-paso1.png)

![Calendar](img/cliente-calendario.png)

![Confirm booking](img/cliente-modal-paso4.png)

### 2.2 My bookings (kanban)

**Home** shows columns by state: Pending, Confirmed, In progress, Completed and Cancelled. Selecting a booking shows details, the **venue map**, the QR and its download. You can **cancel** pending or confirmed bookings.

![Customer kanban](img/cliente-kanban.png)

### 2.3 My profile

Edit first name, last name, phone, email and password.

![Profile](img/cliente-perfil.png)

## 3. Employee

### 3.1 Today's appointments

Timeline colored by state with quick actions:
- `[Validar QR]`: opens the modal to paste the token or use the camera.
- `[Registrar cobro]`: token-based payment; choose "Online payment ($0)" or "Cash at venue".

The side panel shows today's venue map and the day summary.

![Employee appointments](img/empleado-citas.png)

### 3.2 Validate check-in and payment

1. Click **Validar QR** and paste the token, or enable the camera and point at the QR.
2. Choose method and amount (0 for online payment) and confirm.
3. The system validates state and the ±120 minute window; on success it shows "Check-in y cobro registrados". A second attempt warns "La reserva ya fue cobrada".

### 3.3 My availability

Weekly planner: pick the venue per day (only one per day) and mark working blocks. "My Assigned Services" lists enabled services with their durations.

When changing the venue of a day with future bookings, a confirmation is shown: that day's bookings at the previous venue are cancelled with the reason **"El empleado cambió de sede"** and the customer is notified.

![Availability](img/empleado-disponibilidad.png)

## 4. Administrator

### 4.1 Dashboard

- **KPIs:** daily revenue, daily bookings, average occupancy rate and recurring customers.
- **Timeline:** all appointments of the day, filterable by date and venue, with a Validate button per booking.
- **Management:** 9 floating-window shortcuts: Validate QR, Payment, Employees, Services, Venues, Schedules, Reports, Customer moderation and Logs.

![Admin dashboard](img/admin-dashboard.png)

### 4.2 Schedule planner

1. Open **Horarios** ("Planner per employee" tab).
2. The matrix shows employees (rows) × MON–SUN (columns) with venue and shift per day, plus real appointments.
3. Click a cell to edit: venue of the day, start/end time or rest day.
4. Changing the venue of a day with future bookings triggers a warning; on save they are cancelled with the reason and a toast shows the count.
5. Use search, venue filter, "Only with schedule" and week navigation (Today/←/→). Clicking a pending appointment opens the validation modal.

![Planner](img/admin-planificador.png)

![Cell editor](img/admin-planificador-editor.png)

The **Venue shifts** tab edits opening hours per date.

![Shifts](img/admin-jornada.png)

### 4.3 Employees, services and venues

- **Employees:** create/edit with assigned venues, per-venue/day schedules, services and durations; delete only when no payments are associated.
- **Services:** CRUD plus per-employee durations.
- **Venues:** CRUD with address and coordinates (feed the maps).

![Employees](img/admin-empleados.png)

### 4.4 Reports, customers and logs

- **Reports:** daily sales with breakdown, occupancy percentage per venue and recurring customers.
- **Customer moderation:** block with a reason, unblock and delete (only with 3+ no-shows).
- **Logs:** `logs.txt` (activity) and `errores.txt` (failures) with search, date, severity and `.txt` export.

![Reports](img/admin-reportes.png)

![Logs](img/admin-logs.png)

## 5. Mobile and English

The UI is responsive (hamburger menu, scrollable tables, horizontally scrollable planner). The EN/ES button translates the whole interface.

![Mobile](img/cliente-kanban-movil.png)

![English](img/cliente-kanban-en.png)

## 6. FAQ

| Question | Answer |
|----------|--------|
| Why can't I book less than 60 minutes ahead? | It is the minimum lead time to prepare the service. |
| What happens if the stylist changes venue? | Future bookings of that day at the previous venue are cancelled; you will see them in your kanban with the reason. |
| How do I pay online? | Choose the method when booking; check-in is validated with amount 0 and the payment is recorded as `online`. |
| I did not receive the code | Use "Resend code" (max 3 every 15 min) or check spam. |
| Why did my registration disappear? | Unverified registrations are deleted after 5 minutes; the email becomes available to register again. |
| Can I have many bookings? | Up to 5 active bookings per customer. |
