# Issue #20 Requirements Map

This file maps the Revenue Infrastructure bounty requirements to concrete artifacts.

## 1. Tiered Subscription Billing

- `createPlan()` defines Individual Pro, Lab, and Institutional subscription plans.
- `createSubscription()` supports monthly and annual cycles.
- `createCoupon()` supports consortium pricing and coupons.
- `grantTrial()` supports free trials.
- `createInstitutionalInvoice()` supports institutional invoicing with purchase orders.
- `setPaymentMethod()` records card, PayPal, and institutional invoice payment rails.

## 2. AI Compute Billing

- `createComputeProduct()` defines billable compute products for inference, training, reproducibility checks, deployments, and quantum runs.
- `createUsageMeter()` creates transparent customer usage meters with quota credits.
- `recordComputeUsage()` records usage events and chargeable quantities.
- `issueTopUp()` supports a la carte compute-credit top-ups.
- `summarizeBillingAccount()` reports used and available credits.

## 3. Licensing APIs and Analytics

- `createLicenseProduct()` defines anonymized analytics products.
- `summarizeLicensedAnalytics()` exposes available datasets, segments, access modes, and anonymization policy.
- Tests assert that private content is excluded from licensed analytics products.

## Validation

Run from `revenue-infrastructure/`:

```bash
npm test
npm run demo
```
