import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Package pricing
export const PACKAGES = {
  'coaching-6': {
    name: '3-Month Coaching Program',
    sessions: 6,
    parentCheckins: 3,
    price: 5999,
    description: '6 coaching sessions + 3 parent check-ins + FREE access to all services',
  },
  'coaching-trial': {
    name: 'Trial Session',
    sessions: 1,
    parentCheckins: 0,
    price: 999,
    description: '1 trial coaching session',
  },
} as const;

export type PackageType = keyof typeof PACKAGES;

// Revenue split calculation (50-50)
export function calculateRevenueSplit(amount: number, coachId: string) {
  // Rucha gets 100% as she's the founder
  if (coachId === 'rucha' || !coachId) {
    return {
      coachShare: amount,
      platformShare: 0,
      coachPercentage: 100,
      platformPercentage: 0,
    };
  }

  // All other coaches: 50-50 split
  const coachShare = Math.round(amount * 0.5 * 100) / 100;
  const platformShare = amount - coachShare;

  return {
    coachShare,
    platformShare,
    coachPercentage: 50,
    platformPercentage: 50,
  };
}

// Create Razorpay order
export async function createOrder(params: {
  childId: string;
  childName: string;
  coachId: string;
  packageType: PackageType;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  source: string;
}) {
  const pkg = PACKAGES[params.packageType];
  if (!pkg) {
    throw new Error('Invalid package type');
  }

  const split = calculateRevenueSplit(pkg.price, params.coachId);

  const order = await razorpay.orders.create({
    amount: pkg.price * 100,
    currency: 'INR',
    receipt: `yestoryd_${Date.now()}`,
    notes: {
      childId: params.childId,
      childName: params.childName,
      coachId: params.coachId,
      packageType: params.packageType,
      source: params.source,
      parentName: params.parentName,
      parentEmail: params.parentEmail,
      parentPhone: params.parentPhone,
      coachShare: split.coachShare.toString(),
      platformShare: split.platformShare.toString(),
    },
  });

  return {
    orderId: order.id,
    amount: pkg.price,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID!,
    packageDetails: pkg,
    split,
  };
}

// Verify payment signature
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

// Verify webhook signature
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

export default razorpay;
