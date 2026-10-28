# COD Management System

A web portal for delivery hubs to manage Cash on Delivery (COD) collections from riders. Record what each rider hands in, track pending dues, close the day with reconciliation, and export everything to Excel or PDF.

**Live demo:** https://cod-management-beta.vercel.app

## Features

- **Transactions:** record COD amounts per rider with a payment mode of Cash, Online, or Cash + Online (split), including who received the online payment.
- **Pending payments:** track partial payments and outstanding dues, with a full payment history and printable receipts.
- **Dashboard stats:** totals for COD collected, cash vs. online, per-receiver online totals, and pending amounts.
- **Daily closing:** reconcile each day and mark it as Balanced or Discrepancy, with notes.
- **Rider management:** add riders manually or import them from an Excel file.
- **Reports and backups:** export to Excel (`.xlsx`) and PDF; backup workbooks include Transactions, Pending Payments, Riders, Daily Closings, and Audit Logs sheets.
- **Access control:** login with Admin and Staff roles, plus user management for creating staff accounts.
- **Audit log:** every create, update, delete, closing, import, and payment action is recorded.
- **Store setup wizard:** configure your store name and online payment receivers on first run.

## Tech Stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Motion, Lucide icons |
| Backend | Express (Node.js) with Multer for uploads |
| Data and auth | Supabase (auth, storage, realtime) |
| Exports | ExcelJS, SheetJS (`xlsx`), jsPDF + jspdf-autotable |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- A Supabase project

### Installation

```bash
git clone https://github.com/Shashank-V21/COD-Management-.git
cd COD-Management-
npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in your own values:

```env
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"

VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

Never commit your service role key. Keep it server-side only, and enable Row Level Security on your Supabase tables.

### Run locally

```bash
npm run dev
```

The app runs at http://localhost:3000.

### Build and run for production

```bash
npm run build
npm start
```

### Type check

```bash
npm run lint
```

## Project Structure

```
├── server.ts              # Express server, API routes, Vite middleware
├── src/
│   ├── App.tsx            # Main app shell and views
│   ├── components/        # Transaction form/table, pending COD, reports, riders, modals, login
│   ├── context/           # Auth context (roles, sessions)
│   ├── lib/               # Supabase client, Excel parser, backup service, utils
│   ├── services/          # API client
│   └── types.ts           # Shared TypeScript types
├── excel_records/         # Local JSON data (riders, logs, closings)
├── public/                # Favicons and web manifest
└── vercel.json            # Vercel routing config
```

## Deployment

The app is deployed on Vercel. Set the environment variables above in your Vercel project settings before deploying.

## Contributing

Issues and pull requests are welcome.

## License

No license has been specified yet. Add a `LICENSE` file (for example MIT) to make the terms clear.
