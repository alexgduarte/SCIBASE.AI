const CUSTOMER_TYPES = {
  individual: "individual",
  lab: "lab",
  institution: "institution",
}

const BILLING_CYCLES = {
  monthly: "monthly",
  annual: "annual",
}

const PAYMENT_RAILS = {
  card: "card",
  paypal: "paypal",
  institutionalInvoice: "institutional-invoice",
}

const COMPUTE_TASK_TYPES = {
  inference: "inference",
  training: "training",
  reproducibilityCheck: "reproducibility-check",
  cloudDeployment: "cloud-deployment",
  quantumRun: "quantum-run",
}

function createRevenueState() {
  return {
    plans: {},
    customers: {},
    subscriptions: {},
    coupons: {},
    computeProducts: {},
    meters: {},
    topUps: {},
    invoices: {},
    licenseProducts: {},
    events: [],
    counters: {
      subscriptions: 1,
      trials: 1,
      invoices: 1,
      topUps: 1,
      events: 1,
    },
  }
}

function createPlan(state, input) {
  const id = requiredString(input.id, "id")
  const plan = {
    id,
    name: requiredString(input.name, "name"),
    customerType: requiredEnum(input.customerType, CUSTOMER_TYPES, "customerType"),
    billingCycles: {
      monthly: {
        cycle: BILLING_CYCLES.monthly,
        priceCents: requiredNumber(input.monthlyPriceCents, "monthlyPriceCents"),
      },
      annual: {
        cycle: BILLING_CYCLES.annual,
        priceCents: requiredNumber(input.annualPriceCents, "annualPriceCents"),
      },
    },
    includedComputeCredits: Number(input.includedComputeCredits || 0),
    seatLimit: input.seatLimit || null,
    volumeDiscounts: input.volumeDiscounts || [],
    features: input.features || [],
    createdAt: timestamp(),
  }
  state.plans[id] = plan
  appendEvent(state, "plan.created", id, { customerType: plan.customerType })
  return plan
}

function createCoupon(state, input) {
  const code = requiredString(input.code, "code")
  const coupon = {
    code,
    percentOff: requiredNumber(input.percentOff, "percentOff"),
    appliesTo: input.appliesTo || Object.values(CUSTOMER_TYPES),
    expiresAt: requiredString(input.expiresAt, "expiresAt"),
    createdAt: timestamp(),
  }
  state.coupons[code] = coupon
  appendEvent(state, "coupon.created", code, { percentOff: coupon.percentOff })
  return coupon
}

function createCustomer(state, input) {
  const id = requiredString(input.id, "id")
  const customer = {
    id,
    type: requiredEnum(input.type, CUSTOMER_TYPES, "type"),
    name: requiredString(input.name, "name"),
    billingEmail: requiredString(input.billingEmail, "billingEmail"),
    seats: Number(input.seats || 1),
    consortiumId: input.consortiumId || null,
    paymentMethods: [],
    trials: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.customers[id] = customer
  appendEvent(state, "customer.created", id, { type: customer.type })
  return customer
}

function setPaymentMethod(state, customerId, input) {
  const customer = requireCustomer(state, customerId)
  const paymentMethod = {
    rail: requiredEnum(input.rail, PAYMENT_RAILS, "rail"),
    token: requiredString(input.token, "token"),
    createdAt: timestamp(),
  }
  customer.paymentMethods.push(paymentMethod)
  customer.updatedAt = timestamp()
  appendEvent(state, "payment_method.added", customerId, { rail: paymentMethod.rail })
  return paymentMethod
}

function grantTrial(state, input) {
  const customer = requireCustomer(state, input.customerId)
  requirePlan(state, input.planId)
  const startsAt = parseDate(input.startsAt, "startsAt")
  const endsAt = addDays(startsAt, requiredNumber(input.days, "days"))
  const trial = {
    id: `trial-${state.counters.trials++}`,
    customerId: customer.id,
    planId: input.planId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  }
  customer.trials.push(trial)
  customer.updatedAt = timestamp()
  appendEvent(state, "trial.granted", customer.id, { planId: trial.planId, endsAt: trial.endsAt })
  return trial
}

function createSubscription(state, input) {
  const customer = requireCustomer(state, input.customerId)
  const plan = requirePlan(state, input.planId)
  const billingCycle = requiredEnum(input.billingCycle, BILLING_CYCLES, "billingCycle")
  const basePrice = plan.billingCycles[billingCycle].priceCents
  const seatAdjustedPrice = applySeatQuantity(basePrice, customer.seats, plan)
  const coupon = input.couponCode ? requireCoupon(state, input.couponCode) : null
  const couponDiscountPercent = coupon && coupon.appliesTo.includes(customer.type) ? coupon.percentOff : 0
  const discountedPrice = Math.floor(seatAdjustedPrice * (1 - couponDiscountPercent / 100))
  const subscription = {
    id: `subscription-${state.counters.subscriptions++}`,
    customerId: customer.id,
    planId: plan.id,
    billingCycle,
    status: "active",
    startsAt: requiredString(input.startsAt, "startsAt"),
    priceCentsBeforeDiscount: basePrice,
    seatAdjustedPriceCents: seatAdjustedPrice,
    priceCentsAfterDiscount: discountedPrice,
    appliedDiscounts: {
      volumePercentOff: volumeDiscountPercent(customer.seats, plan),
      couponCode: coupon?.code || null,
      couponPercentOff: couponDiscountPercent,
    },
    includedComputeCredits: plan.includedComputeCredits,
    createdAt: timestamp(),
  }
  state.subscriptions[subscription.id] = subscription
  customer.activeSubscriptionId = subscription.id
  customer.updatedAt = timestamp()
  appendEvent(state, "subscription.created", customer.id, {
    subscriptionId: subscription.id,
    planId: plan.id,
    priceCentsAfterDiscount: discountedPrice,
  })
  return subscription
}

function createInstitutionalInvoice(state, input) {
  const customer = requireCustomer(state, input.customerId)
  const subscription = requireSubscription(state, input.subscriptionId)
  const invoice = {
    id: `invoice-${state.counters.invoices++}`,
    customerId: customer.id,
    subscriptionId: subscription.id,
    purchaseOrder: requiredString(input.purchaseOrder, "purchaseOrder"),
    amountDueCents: subscription.priceCentsAfterDiscount,
    dueAt: requiredString(input.dueAt, "dueAt"),
    paymentRail: PAYMENT_RAILS.institutionalInvoice,
    status: "open",
    createdAt: timestamp(),
  }
  state.invoices[invoice.id] = invoice
  appendEvent(state, "invoice.created", customer.id, {
    invoiceId: invoice.id,
    amountDueCents: invoice.amountDueCents,
  })
  return invoice
}

function createComputeProduct(state, input) {
  const id = requiredString(input.id, "id")
  const product = {
    id,
    taskType: requiredEnum(input.taskType, COMPUTE_TASK_TYPES, "taskType"),
    unit: requiredString(input.unit, "unit"),
    unitPriceCents: requiredNumber(input.unitPriceCents, "unitPriceCents"),
    quotaUnit: input.quotaUnit || "compute-credit",
    createdAt: timestamp(),
  }
  state.computeProducts[id] = product
  appendEvent(state, "compute_product.created", id, { taskType: product.taskType })
  return product
}

function createUsageMeter(state, input) {
  requireCustomer(state, input.customerId)
  requireComputeProduct(state, input.productId)
  const meter = {
    id: meterId(input.customerId, input.productId),
    customerId: input.customerId,
    productId: input.productId,
    quotaCredits: Number(input.quotaCredits || 0),
    topUpCredits: 0,
    usedCredits: 0,
    usage: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.meters[meter.id] = meter
  appendEvent(state, "usage_meter.created", input.customerId, {
    productId: input.productId,
    quotaCredits: meter.quotaCredits,
  })
  return meter
}

function recordComputeUsage(state, input) {
  const customer = requireCustomer(state, input.customerId)
  const product = requireComputeProduct(state, input.productId)
  const meter = requireMeter(state, customer.id, product.id)
  const quantity = requiredNumber(input.quantity, "quantity")
  const usage = {
    quantity,
    credits: quantity,
    unitPriceCents: product.unitPriceCents,
    amountCents: quantity * product.unitPriceCents,
    source: input.source || null,
    recordedAt: timestamp(),
  }
  meter.usedCredits += usage.credits
  meter.usage.push(usage)
  meter.updatedAt = timestamp()
  appendEvent(state, "usage.recorded", customer.id, {
    productId: product.id,
    quantity,
    source: usage.source,
  })
  return usage
}

function issueTopUp(state, input) {
  const customer = requireCustomer(state, input.customerId)
  const product = requireComputeProduct(state, input.productId)
  const meter = requireMeter(state, customer.id, product.id)
  const topUp = {
    id: `top-up-${state.counters.topUps++}`,
    customerId: customer.id,
    productId: product.id,
    credits: requiredNumber(input.credits, "credits"),
    priceCents: requiredNumber(input.priceCents, "priceCents"),
    issuedAt: timestamp(),
  }
  meter.topUpCredits += topUp.credits
  meter.updatedAt = timestamp()
  state.topUps[topUp.id] = topUp
  appendEvent(state, "top_up.issued", customer.id, {
    productId: product.id,
    credits: topUp.credits,
    priceCents: topUp.priceCents,
  })
  return topUp
}

function createLicenseProduct(state, input) {
  const id = requiredString(input.id, "id")
  const license = {
    id,
    name: requiredString(input.name, "name"),
    customerSegments: input.customerSegments || [],
    datasets: input.datasets || [],
    anonymization: requiredString(input.anonymization, "anonymization"),
    accessModes: input.accessModes || [],
    monthlyPriceCents: requiredNumber(input.monthlyPriceCents, "monthlyPriceCents"),
    privateContentIncluded: false,
    createdAt: timestamp(),
  }
  state.licenseProducts[id] = license
  appendEvent(state, "license_product.created", id, {
    datasets: license.datasets,
    accessModes: license.accessModes,
  })
  return license
}

function summarizeLicensedAnalytics(state, licenseId) {
  const license = requireLicenseProduct(state, licenseId)
  return {
    id: license.id,
    name: license.name,
    customerSegments: license.customerSegments,
    datasets: license.datasets,
    anonymization: license.anonymization,
    accessModes: license.accessModes,
    monthlyPriceCents: license.monthlyPriceCents,
    privateContentIncluded: license.privateContentIncluded,
  }
}

function summarizeBillingAccount(state, customerId) {
  const customer = requireCustomer(state, customerId)
  const activeSubscription = customer.activeSubscriptionId ? state.subscriptions[customer.activeSubscriptionId] : null
  const meters = Object.values(state.meters)
    .filter((meter) => meter.customerId === customerId)
    .reduce((result, meter) => {
      result[meter.productId] = {
        quotaCredits: meter.quotaCredits,
        topUpCredits: meter.topUpCredits,
        usedCredits: meter.usedCredits,
        availableCredits: meter.quotaCredits + meter.topUpCredits - meter.usedCredits,
        usageCount: meter.usage.length,
      }
      return result
    }, {})

  return {
    customer: {
      id: customer.id,
      type: customer.type,
      name: customer.name,
      seats: customer.seats,
      consortiumId: customer.consortiumId,
    },
    activeSubscription,
    paymentMethods: customer.paymentMethods,
    meters,
    invoices: Object.values(state.invoices).filter((invoice) => invoice.customerId === customerId),
    events: state.events.filter((event) => event.actorId === customerId),
  }
}

function applySeatQuantity(basePrice, seats, plan) {
  const discount = volumeDiscountPercent(seats, plan)
  return Math.floor(basePrice * (1 - discount / 100))
}

function volumeDiscountPercent(seats, plan) {
  return (plan.volumeDiscounts || [])
    .filter((discount) => seats >= discount.minSeats)
    .reduce((best, discount) => Math.max(best, discount.percentOff), 0)
}

function requireCustomer(state, customerId) {
  const customer = state.customers[customerId]
  if (!customer) {
    throw new Error(`Unknown customer: ${customerId}`)
  }
  return customer
}

function requirePlan(state, planId) {
  const plan = state.plans[planId]
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`)
  }
  return plan
}

function requireCoupon(state, couponCode) {
  const coupon = state.coupons[couponCode]
  if (!coupon) {
    throw new Error(`Unknown coupon: ${couponCode}`)
  }
  return coupon
}

function requireSubscription(state, subscriptionId) {
  const subscription = state.subscriptions[subscriptionId]
  if (!subscription) {
    throw new Error(`Unknown subscription: ${subscriptionId}`)
  }
  return subscription
}

function requireComputeProduct(state, productId) {
  const product = state.computeProducts[productId]
  if (!product) {
    throw new Error(`Unknown compute product: ${productId}`)
  }
  return product
}

function requireMeter(state, customerId, productId) {
  const meter = state.meters[meterId(customerId, productId)]
  if (!meter) {
    throw new Error(`Unknown usage meter for ${customerId}/${productId}`)
  }
  return meter
}

function requireLicenseProduct(state, licenseId) {
  const license = state.licenseProducts[licenseId]
  if (!license) {
    throw new Error(`Unknown license product: ${licenseId}`)
  }
  return license
}

function meterId(customerId, productId) {
  return `${customerId}:${productId}`
}

function appendEvent(state, action, actorId, details = {}) {
  const event = {
    id: `event-${state.counters.events++}`,
    action,
    actorId,
    details,
    createdAt: timestamp(),
  }
  state.events.push(event)
  return event
}

function requiredString(value, fieldName) {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

function requiredNumber(value, fieldName) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number`)
  }
  return value
}

function requiredEnum(value, allowed, fieldName) {
  const values = Object.values(allowed)
  if (!values.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${values.join(", ")}`)
  }
  return value
}

function parseDate(value, fieldName) {
  const parsed = new Date(requiredString(value, fieldName))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date`)
  }
  return parsed
}

function addDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function timestamp() {
  return new Date().toISOString()
}

module.exports = {
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
}
