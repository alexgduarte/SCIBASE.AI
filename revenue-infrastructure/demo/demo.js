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

createPlan(state, {
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

createCoupon(state, {
  code: "CONSORTIUM25",
  percentOff: 25,
  appliesTo: [CUSTOMER_TYPES.lab, CUSTOMER_TYPES.institution],
  expiresAt: "2026-12-31T00:00:00.000Z",
})

const customer = createCustomer(state, {
  id: "oxford-lab",
  type: CUSTOMER_TYPES.lab,
  name: "Oxford Neuroscience Lab",
  billingEmail: "billing@ox.ac.uk",
  seats: 12,
  consortiumId: "uk-research-consortium",
})

setPaymentMethod(state, customer.id, {
  rail: PAYMENT_RAILS.institutionalInvoice,
  token: "invoice-account-oxford",
})

grantTrial(state, {
  customerId: customer.id,
  planId: "lab",
  days: 30,
  startsAt: "2026-05-13T00:00:00.000Z",
})

const subscription = createSubscription(state, {
  customerId: customer.id,
  planId: "lab",
  billingCycle: BILLING_CYCLES.annual,
  couponCode: "CONSORTIUM25",
  startsAt: "2026-06-12T00:00:00.000Z",
})

createInstitutionalInvoice(state, {
  customerId: customer.id,
  subscriptionId: subscription.id,
  purchaseOrder: "PO-123",
  dueAt: "2026-07-12T00:00:00.000Z",
})

const computeProduct = createComputeProduct(state, {
  id: "assistant-inference",
  taskType: COMPUTE_TASK_TYPES.inference,
  unit: "token",
  unitPriceCents: 2,
  quotaUnit: "compute-credit",
})

createUsageMeter(state, {
  customerId: customer.id,
  productId: computeProduct.id,
  quotaCredits: subscription.includedComputeCredits,
})

recordComputeUsage(state, {
  customerId: customer.id,
  productId: computeProduct.id,
  quantity: 1200,
  source: "peer-review-summarization",
})

issueTopUp(state, {
  customerId: customer.id,
  productId: computeProduct.id,
  credits: 2500,
  priceCents: 4000,
})

recordComputeUsage(state, {
  customerId: customer.id,
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

console.log(JSON.stringify({
  account: summarizeBillingAccount(state, customer.id),
  licensedAnalytics: summarizeLicensedAnalytics(state, license.id),
}, null, 2))
