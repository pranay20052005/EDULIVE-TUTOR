/**
 * Server-Side Razorpay Payment Gateway Integration
 * Handles order creation, signature verification, and webhook processing securely on the server.
 * Secrets NEVER leak to client-side bundles.
 */

import crypto from "crypto";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  isConfigured: boolean;
}

export function getRazorpayConfig(): RazorpayConfig {
  const keyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || keySecret || "").trim();

  const isConfigured = Boolean(keyId && keySecret);

  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
  };
}

export interface CreateOrderParams {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/**
 * Creates a Razorpay Order server-side
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const config = getRazorpayConfig();

  if (!config.isConfigured) {
    throw new Error(
      "Razorpay payment gateway is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  const authHeader = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: params.currency || "INR",
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Razorpay order creation failed:", response.status, errorText);
    throw new Error(`Failed to create Razorpay order: ${errorText}`);
  }

  const orderData = (await response.json()) as any;
  return {
    id: orderData.id,
    amount: orderData.amount,
    currency: orderData.currency,
    receipt: orderData.receipt,
    status: orderData.status,
  };
}

/**
 * Verifies Razorpay payment signature
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const config = getRazorpayConfig();

  if (
    !config.isConfigured ||
    !config.keySecret ||
    !params.signature ||
    !params.orderId ||
    !params.paymentId
  ) {
    return false;
  }

  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", config.keySecret)
    .update(body)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "utf-8");
  const actualBuf = Buffer.from(params.signature, "utf-8");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies Razorpay webhook signature
 */
export function verifyWebhookSignature(params: { rawBody: string; signature: string }): boolean {
  const config = getRazorpayConfig();
  if (!config.webhookSecret || !params.signature || !params.rawBody) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", config.webhookSecret)
    .update(params.rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "utf-8");
  const actualBuf = Buffer.from(params.signature, "utf-8");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
