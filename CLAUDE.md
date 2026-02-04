# JobTracker

A mobile-first web application for tracking permits, vehicles, bills, deposits, inspections, business licenses, and daily tasks.

**Live URL**: https://99redder.github.io/JobTracker/

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Hosting**: GitHub Pages
- **Theme**: Black and yellow color scheme

## Key Files

- `index.html` - Main HTML structure, Firebase SDK imports, tab navigation
- `app.js` - All application logic, Firebase integration, form handling
- `styles.css` - All styling, mobile-first responsive design
- `manifest.json` - PWA manifest
- `sw.js` - Service worker for offline support

## Firebase Collections

- `permits` - Permit records (county or city permits)
- `vehicles` - Vehicle fleet tracking
- `bills` - Bills and expenses
- `deposits` - Customer deposits
- `inspections` - Inspection records
- `licenses` - Business license tracking
- `activity` - Daily activity log
- `followups` - Flagged items for follow-up

## User Roles

- **Admin**: Full CRUD access, can dismiss follow-ups, sees Activity tab
- **Regular users**: Read-only access, can flag items for admin follow-up
- Admin UIDs are defined in `ADMIN_UIDS` array in app.js

## Tabs (8 total)

1. **Home** - Shows flagged follow-up items
2. **Permits** - County or city permits with photo upload
3. **Vehicles** - Fleet tracking with registration renewal alerts
4. **Bills** - Bills and expenses (Unpaid Bills, Paid Bills, Paid Expenses sections)
5. **Deposits** - Customer deposit tracking
6. **Inspections** - Inspection records
7. **Licenses** - Business license tracking with expiration alerts
8. **Activity** - Admin-only daily activity log

## Key Features

### Permits
- **Permit Type**: County Permit or City Permit (first dropdown)
- When City Permit selected: county dropdown disabled, city field required
- When County Permit selected: county required, city optional
- Grouped by county (for county permits) or city (for city permits)
- Photo upload via Firebase Storage
- Counties: Wicomico, Worcester, Somerset, Dorchester, Talbot, Caroline, Queen Anne's, Kent, Cecil, Harford, Sussex DE, Kent DE, New Castle DE, Accomack VA, Northampton VA

### Vehicles
- Registration dates use month picker (YYYY-MM format)
- Auto-flags vehicles with renewal within 30 days
- Sortable by renewal date or year

### Bills
- Entry type: Bill or Expense
- Three collapsible sections: Unpaid Bills, Paid Bills, Paid Expenses
- "Paid On" date field appears when status is Paid
- Check number field appears when payment method is Check
- Auto-cleanup: paid bills older than 1 year

### Activity
- Auto-cleanup: items older than 90 days
- Grouped by date (collapsible)

### Business Licenses
- Fields: Jurisdiction, License Number, Expiration Date
- Photo upload via Firebase Storage
- Auto-flags licenses expiring within 30 days

### Conditional Form Fields
- `showIf` - Show field only when condition met
- `disableIf` - Disable field when condition met
- `requiredIf` - Make field required when condition met

## Authentication

- Firebase Email/Password auth
- reCAPTCHA v2 (checkbox) on login and signup forms
- Site key defined in `RECAPTCHA_SITE_KEY` constant

## Security

- API key should be restricted in Google Cloud Console:
  - HTTP referrers: `99redder.github.io/*` and `localhost`
  - API restrictions: Identity Toolkit API, Firebase installations API, Token Service API

## Deployment

Push to `main` branch - GitHub Pages auto-deploys from there.

## Firebase Console

- Project ID: jobtracker-582b9
- Firestore rules and Storage rules must be configured in Firebase Console
- Storage rules needed for permit and license image uploads
