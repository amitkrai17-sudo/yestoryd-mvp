/**
 * Razorpay Payment Client
 * Handles payment processing with 70/30 revenue split
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { calculateRevenueSplit, PACKAGES, type PackageType } from '../utils/revenue-split';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export interface CreateOrderParams {
  studentId: string;
  coachId: string;
  packageType: PackageType;
  source: string;
  assignedBy: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

export interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  packageDetails: {
    name: string;
    sessions: number;
    price: number;
  };
  split: {
    coachShare: number;
    platformShare: number;
  };
}

/**
 * Create a Razorpay order for coaching package
 */
export async function createOrder(params: CreateOrderParams): Promise<OrderResponse> {
  const packageDetails = PACKAGES[params.packageType];
  if (!packageDetails) {
    throw new Error(`Invalid package type: ${params.packageType}`);
  }

  const amount = packageDetails.price;
  const split = calculateRevenueSplit(amount, params.coachId);

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        studentId: params.studentId,
        coachId: params.coachId,
        packageType: params.packageType,
        source: params.source,
        assignedBy: params.assignedBy,
        coachShare: split.coachShare.toString(),
        yestorydShare: split.platformShare.toString(),
        parentName: params.parentName,
        parentEmail: params.parentEmail,
        parentPhone: params.parentPhone,
      },
    });

    return {
      orderId: order.id,
      amount: order.amount as number,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID!,
      packageDetails: {
        name: packageDetails.name,
        sessions: packageDetails.sessions,
        price: packageDetails.price,
      },
      split: {
        coachShare: split.coachShare,
        platformShare: split.platformShare,
      },
    };
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Fetch payment details
 */
export async function getPaymentDetails(paymentId: string) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
}

/**
 * Create payment link (alternative to checkout)
 */
export async function createPaymentLink(params: {
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  callbackUrl: string;
  notes: Record<string, string>;
}) {
  try {
    const link = await razorpay.paymentLink.create({
      amount: params.amount * 100,
      currency: 'INR',
      accept_partial: false,
      description: params.description,
      customer: {
        name: params.customerName,
        email: params.customerEmail,
        contact: params.customerPhone,
      },
      notify: {
        sms: true,
        email: true,
        whatsapp: true,
      },
      callback_url: params.callbackUrl,
      callback_method: 'get',
      notes: params.notes,
    });

    return link;
  } catch (error) {
    console.error('Error creating payment link:', error);
    throw error;
  }
}
