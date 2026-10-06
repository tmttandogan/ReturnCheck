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

Flags reflect supplied records. Customer return frequency is context only. Duplicate flags can be supplied explicitly; overlapping requests are also detected from matching order and product records. Serial checks are meaningful for products with tracked serial numbers.

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

## Prepared review workflow (v2)

1. Import records: checks run automatically against saved requests.
2. Open a prepared case: ReturnCheck recommends an action, writes a review note, and drafts a customer reply.
3. Confirm the recommendation in one click, or adjust the decision and note.
4. Confirm all clean open cases in the current filtered view together; the server rechecks eligibility and skips changed or flagged cases.
5. Resolve exceptions using **Update evidence and rerun checks**. Enter expected and returned serials, confirm warehouse receipt, and record an existing refund. Evidence edits reopen the review.
6. Copy the prepared customer reply or export a complete JSON case with records, checks, decisions, and history.

Optional CSV columns: `expected_serial`, `returned_serial`, `refund_issued`. The original eleven-column CSV format still works. If both serial numbers are provided, the app compares them; a partially supplied pair needs verification. Without serial values, the existing item-verification status is used.

Overlapping requests are detected by matching order ID and product name within the same sample/real dataset. Different products on one order are kept separate. Multiple legitimate units of the same product may trigger a review; the app does not infer quantities or prove fraud. Sample cases do not trigger overlap flags on real records.

No customer message or refund payment is sent. The app automates record checks, case preparation, notes, and review recording. It does not replace a carrier, warehouse, payment, or Shopify integration. Bulk confirmation is explicit and saves review readiness only.

## Validation

TypeScript checking and production build. Rule and CSV checks cover mismatches, duplicates, warehouse receipt, clean cases, quoted fields, malformed values, negative amounts, and duplicate IDs. API checks cover import, persistence, validation, and concurrent-review conflicts.


## Warehouse workflow (v3)

The sidebar now includes **Warehouse station** and **Order records**.

1. Import return requests using the return CSV template.
2. Import original orders using the separate order CSV template. Matching uses order ID and product name, normalized for case and outer whitespace. Supply one consolidated USD payment record per order/product. Different units of an identical product require separate inspection if identity is ambiguous.
3. In Warehouse station, scan or type the return ID and press Enter.
4. Scan or type the returned item serial and press Enter. This explicitly confirms physical warehouse receipt, compares the serial, checks available payment records and overlapping requests, saves the prepared decision and review note, and appends history in one operation.
5. Continue with the next item, or open the complete case for an exception.

Scanner support uses keyboard input; configure the scanner with an Enter suffix. The label must encode the imported return ID. No camera decoding is included. For non-serialized products, use the case evidence editor.

For a demonstration, load sample records, find **RT-1045**, and scan **DEMO-1045** as the serial. These records are fictional. Loading sample records refreshes sample order facts and reopens matching sample reviews.

Order CSV columns: `order_id,product,paid_amount,refunded_amount,expected_serial,tracking_number,source`. The first five columns are required; expected_serial may be blank. Original file bytes are not retained. Structured order facts are saved in D1. Importing matching order facts refreshes them and reopens the affected return reviews with a history event and new revision, so stale scans and confirmations cannot overwrite updated source records.

Payment records must be supplied before a return can be marked ready for refund. The requested amount is compared with paid amount minus prior refunded amount. This is an evidence check, not a payment ledger or proof of eligibility under every retailer policy.

The original serial from saved order records takes precedence over manually edited expected serials. Correct original item or payment facts by refreshing Order records. Review history and sample/real separation are preserved.

**Available:** order and return CSV ingestion, automatic matching, keyboard scanner workflow, receipt recording, prepared reviews, payment-amount checks.
**Not connected:** live Amazon/eBay/Alibaba/store synchronization, live tracking verification, actual refunds, and customer-message delivery. Those require merchant access and platform-specific integrations. No universal marketplace connector is claimed.
