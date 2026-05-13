const assert = require("assert")

const {
  BILLING_CYCLES,
  COMPUTE_TASK_TYPES,
  CUSTOMER_TYPES,
  PAYMENT_RAILS,
  createComputeProduct,
  createCoupon,
  createCustomer,
  createInstitutionalInvoice,
  createLicenseProduct,
  createPlan,
  createRevenueState,
  createSubscription,
  createUsageMeter,
  grantTrial,
  issueTopUp,
  recordComputeUsage,
  setPaymentMethod,
  summarizeBillingAccount,
  summarizeLicensedAnalytics,
} = require("../src/revenueInfrastructure")

const state = createRevenueState()

const individualPlan = createPlan(state, {
  id: "individual-pro",
  name: "Individual Pro",
  customerType: CUSTOMER_TYPES.individual,
  monthlyPriceCents: 1900,
  annualPriceCents: 19000,
  includedComputeCredits: 500,
  features: ["private projects", "extra assistant tokens", "project analytics"],
})

const labPlan = createPlan(state, {
  id: "lab",
  name: "Lab",
  customerType: CUSTOMER_TYPES.lab,
  monthlyPriceCents: 9900,
  annualPriceCents: 99000,
  includedComputeCredits: 5000,
  seatLimit: 15,
  volumeDiscounts: [{ minSeats: 10, percentOff: 15 }],
  features: ["shared workspaces", "group permissions", "priority support"],
})

const institutionPlan = createPlan(state, {
  id: "institutional",
  name: "Institutional",
  customerType: CUSTOMER_TYPES.institution,
  monthlyPriceCents: 120000,
  annualPriceCents: 1200000,
  includedComputeCredits: 100000,
  features: ["admin dashboards", "custom integrations", "SLA"],
})

assert.strictEqual(individualPlan.billingCycles.monthly.priceCents, 1900)
assert.strictEqual(labPlan.volumeDiscounts[0].percentOff, 15)
assert.strictEqual(institutionPlan.features.includes("SLA"), true)

const coupon = createCoupon(state, {
  code: "CONSORTIUM25",
  percentOff: 25,
  appliesTo: [CUSTOMER_TYPES.lab, CUSTOMER_TYPES.institution],
  expiresAt: "2026-12-31T00:00:00.000Z",
})

const lab = createCustomer(state, {
  id: "oxford-lab",
  type: CUSTOMER_TYPES.lab,
  name: "Oxford Neuroscience Lab",
  billingEmail: "billing@ox.ac.uk",
  seats: 12,
  consortiumId: "uk-research-consortium",
})

setPaymentMethod(state, lab.id, {
  rail: PAYMENT_RAILS.institutionalInvoice,
  token: "invoice-account-oxford",
})

const trial = grantTrial(state, {
  customerId: lab.id,
  planId: labPlan.id,
  days: 30,
  startsAt: "2026-05-13T00:00:00.000Z",
})

assert.strictEqual(trial.endsAt, "2026-06-12T00:00:00.000Z")

const subscription = createSubscription(state, {
  customerId: lab.id,
  planId: labPlan.id,
  billingCycle: BILLING_CYCLES.annual,
  couponCode: coupon.code,
  startsAt: "2026-06-12T00:00:00.000Z",
})

assert.strictEqual(subscription.priceCentsBeforeDiscount, 99000)
assert.strictEqual(subscription.priceCentsAfterDiscount, 63112)
assert.strictEqual(subscription.includedComputeCredits, 5000)

const invoice = createInstitutionalInvoice(state, {
  customerId: lab.id,
  subscriptionId: subscription.id,
  purchaseOrder: "PO-123",
  dueAt: "2026-07-12T00:00:00.000Z",
})

assert.strictEqual(invoice.paymentRail, PAYMENT_RAILS.institutionalInvoice)

const computeProduct = createComputeProduct(state, {
  id: "assistant-inference",
  taskType: COMPUTE_TASK_TYPES.inference,
  unit: "token",
  unitPriceCents: 2,
  quotaUnit: "compute-credit",
})

createUsageMeter(state, {
  customerId: lab.id,
  productId: computeProduct.id,
  quotaCredits: subscription.includedComputeCredits,
})

recordComputeUsage(state, {
  customerId: lab.id,
  productId: computeProduct.id,
  quantity: 1200,
  source: "peer-review-summarization",
})

const topUp = issueTopUp(state, {
  customerId: lab.id,
  productId: computeProduct.id,
  credits: 2500,
  priceCents: 4000,
})

assert.strictEqual(topUp.credits, 2500)

recordComputeUsage(state, {
  customerId: lab.id,
  productId: computeProduct.id,
  quantity: 2500,
  source: "reproducibility-checks",
})

const license = createLicenseProduct(state, {
  id: "research-trends-api",
  name: "Research Trends API",
  customerSegments: ["government", "academic-consortium", "market-intelligence"],
  datasets: ["citation networks", "dataset reuse patterns", "reproducibility scores"],
  anonymization: "private content excluded; project metadata aggregated",
  accessModes: ["dashboard", "api", "white-label"],
  monthlyPriceCents: 250000,
})

const analyticsSummary = summarizeLicensedAnalytics(state, license.id)
assert.deepStrictEqual(analyticsSummary.datasets, [
  "citation networks",
  "dataset reuse patterns",
  "reproducibility scores",
])
assert.strictEqual(analyticsSummary.privateContentIncluded, false)

const account = summarizeBillingAccount(state, lab.id)

assert.strictEqual(account.customer.name, "Oxford Neuroscience Lab")
assert.strictEqual(account.activeSubscription.planId, "lab")
assert.strictEqual(account.meters["assistant-inference"].usedCredits, 3700)
assert.strictEqual(account.meters["assistant-inference"].availableCredits, 3800)
assert.strictEqual(account.paymentMethods[0].rail, PAYMENT_RAILS.institutionalInvoice)
assert.ok(account.events.some((event) => event.action === "usage.recorded"))
assert.ok(account.events.some((event) => event.action === "top_up.issued"))

console.log("revenue infrastructure tests passed")
