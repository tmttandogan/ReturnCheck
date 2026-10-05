# ReturnCheck

A working return-evidence review MVP for online retailers. It flags missing warehouse receipt, recorded serial-number mismatches, duplicate refund requests, and incomplete serial verification. Reviewers save a decision, note, and timestamped history.

## Try the live app

1. Open the live ReturnCheck link while signed into the ChatGPT account that owns the app.
2. Click **Load sample returns**. All six records are fictional.
3. Review **RT-1042**: its return serial number does not match the original item.
4. Choose **Inspect item**, add a note, and click **Save review decision**.
5. Refresh the page and open the record again: the decision and history persist.
6. Review **RT-1043** for missing warehouse receipt and **RT-1045** for a clean case.
7. Click **Import CSV** to import your own records.

## CSV import

Download the filled template from the app. Import up to 500 records in a file under 1 MB.

Required columns:

`return_id,order_id,customer,product,amount,shipment,warehouse_received,serial_match,duplicate_refund,prior_orders,prior_returns`

- `return_id`: unique identifier. Existing IDs are skipped rather than overwriting reviews. Use new IDs when testing imports after loading the demo.
- `amount`: nonnegative USD amount, without currency symbols.
- `shipment`: `Not shipped`, `In transit`, or `Delivered`.
- `warehouse_received`, `duplicate_refund`: `true` or `false`.
- `serial_match`: `Match`, `Mismatch`, or `Unknown`.
- `prior_orders`, `prior_returns`: nonnegative whole numbers; prior returns cannot exceed prior orders.

Flags reflect supplied records. Customer return frequency is context only. Duplicate requests must be marked explicitly in the source data; the app does not infer them from identity or order ID. Serial checks are meaningful for products with tracked serial numbers.

## What this MVP does and does not do

- Working: CSV parsing and validation, review queue, search, open/reviewed filters, evidence explanations, persistent decisions, notes, review history, conflict protection.
- Does not process money, deny returns, verify carrier data, connect to Shopify, identify fraud through machine learning, or inspect product photos.
- No fraud-accuracy or savings claim is made. Flags are prompts for human review, not proof of fraud.
- Hosted access is owner-private through Sites. This version has one review workspace; it is not a multi-merchant SaaS app.
- CSV files are parsed in the browser. Structured case data is sent to the server and saved in D1; original file bytes are not stored.

## Put the source on GitHub without using Terminal

1. Download and unzip `ReturnCheck-source.zip`.
2. On GitHub, click the **+** in the top right, then **New repository**.
3. Name it `returncheck`, select **Private**, check **Add a README file**, and create it.
4. In the new repository, select **Add file → Upload files**.
5. Drag the files and folders inside the unzipped project into the upload area. For folders beginning with a dot, use Cmd+Shift+. in Finder to show them.
6. Commit the uploaded files. Upload in smaller batches if GitHub's web upload reaches its file-count limit.

GitHub stores source code. A repository alone does not host this server-backed app. The live version is already hosted on Sites.

## Local development (for later)

Requires Node 22.13 or newer and pnpm. From the project directory:

```bash
pnpm install
pnpm build
pnpm exec wrangler d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file drizzle/0000_strange_kate_bishop.sql
pnpm dev
```

Apply the initial migration once per fresh local database. Use the URL printed by the development server. Cloudflare Workers and D1 are required for standalone hosting; an ordinary static GitHub Pages deployment cannot run the database API.

## Main code

- `app/page.tsx`: queue, CSV import, review details and decisions.
- `lib/returns.ts`: validation, rules, sample records, CSV handling.
- `app/api/returns/route.ts`: saved cases and review API.
- `db/schema.ts`, `drizzle/`: persistent database schema and migration.
- `app/globals.css`: responsive visual design.

## Validation

TypeScript checking and production build. Rule and CSV checks cover mismatches, duplicates, warehouse receipt, clean cases, quoted fields, malformed values, negative amounts, and duplicate IDs. API checks cover import, persistence, validation, and concurrent-review conflicts.
