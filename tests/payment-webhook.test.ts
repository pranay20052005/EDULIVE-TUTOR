/**
 * EduLive — Razorpay Webhook Security, HTTP Endpoint & Idempotency Test Suite
 * Imports and exercises the REAL production implementation from:
 *   - src/server.ts (HTTP Fetch Endpoint Handler)
 *   - src/lib/server/payment-functions.ts
 *   - src/lib/server/razorpay.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handleRazorpayWebhookInternal } from "../src/lib/server/payment-functions.ts";
import serverHandler from "../src/server.ts";

const MOCK_WEBHOOK_SECRET = "whsec_test_secret_123456789";

process.env.RAZORPAY_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET;

function generateWebhookSignature(body: string, secret: string = MOCK_WEBHOOK_SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("SUITE 6: Razorpay Webhook Processing, HTTP Endpoint & Security", () => {
  test("rejects webhook if signature is missing or empty", async () => {
    const mockSupabase = {} as any;
    await assert.rejects(async () => {
      await handleRazorpayWebhookInternal(mockSupabase, {
        rawBody: JSON.stringify({ event: "payment.captured" }),
        signature: "",
      });
    }, /Missing webhook raw body or signature/);
  });

  test("rejects webhook if signature is invalid or forged", async () => {
    const mockSupabase = {} as any;
    const body = JSON.stringify({ event: "payment.captured" });
    const forgedSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    await assert.rejects(async () => {
      await handleRazorpayWebhookInternal(mockSupabase, {
        rawBody: body,
        signature: forgedSignature,
      });
    }, /Invalid Razorpay webhook signature/);
  });

  test("rejects webhook if signed with wrong secret", async () => {
    const mockSupabase = {} as any;
    const body = JSON.stringify({ event: "payment.captured" });
    const wrongSecretSignature = generateWebhookSignature(body, "wrong_secret_99999");

    await assert.rejects(async () => {
      await handleRazorpayWebhookInternal(mockSupabase, {
        rawBody: body,
        signature: wrongSecretSignature,
      });
    }, /Invalid Razorpay webhook signature/);
  });

  test("rejects webhook with malformed JSON body", async () => {
    const mockSupabase = {} as any;
    const malformedBody = "NOT_A_VALID_JSON{{{";
    const signature = generateWebhookSignature(malformedBody);

    await assert.rejects(async () => {
      await handleRazorpayWebhookInternal(mockSupabase, {
        rawBody: malformedBody,
        signature,
      });
    }, /Malformed JSON/);
  });

  test("successfully processes valid payment.captured event and activates enrollment", async () => {
    const mockPayment = {
      id: "pay_db_123",
      student_id: "stu_123",
      subject_id: "sub_456",
      amount_inr: 118, // 100 base + 18 GST
      status: "pending",
      provider_order_id: "order_test_789",
    };

    const mockSubject = {
      id: "sub_456",
      name: "Mathematics 101",
      duration_months: 6,
      price_inr: 100,
    };

    const mockUpdates: any[] = [];
    const mockUpserts: any[] = [];
    const mockNotifications: any[] = [];

    const mockSupabase = {
      from: (table: string) => {
        if (table === "payments") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockPayment, error: null }),
              }),
            }),
            update: (data: any) => ({
              eq: () => ({
                eq: async () => {
                  mockUpdates.push(data);
                  return { error: null };
                },
              }),
            }),
          };
        }
        if (table === "subjects") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockSubject, error: null }),
              }),
            }),
          };
        }
        if (table === "enrollments") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            upsert: async (data: any) => {
              mockUpserts.push(data);
              return { error: null };
            },
          };
        }
        if (table === "students") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "stu_123", user_id: "usr_student_1" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "notifications") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: async (data: any) => {
              mockNotifications.push(data);
              return { error: null };
            },
          };
        }
        return {};
      },
    } as any;

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_999",
            order_id: "order_test_789",
            amount: 11800, // 118 INR in paise
            status: "captured",
          },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = generateWebhookSignature(rawBody);

    const result = await handleRazorpayWebhookInternal(mockSupabase, {
      rawBody,
      signature,
    });

    assert.equal(result.status, "success");
    assert.equal(result.paymentId, "pay_rzp_999");
    assert.equal(result.subjectId, "sub_456");
    assert.equal(mockUpdates.length, 1);
    assert.equal(mockUpdates[0].status, "paid");
    assert.equal(mockUpserts.length, 1);
    assert.equal(mockUpserts[0][0].status, "active");
    assert.equal(mockUpserts[0][0].payment_id, "pay_db_123");
    assert.equal(mockNotifications.length, 1);
  });

  test("enforces idempotency: does not double-process already paid payments", async () => {
    const mockAlreadyPaid = {
      id: "pay_db_123",
      student_id: "stu_123",
      subject_id: "sub_456",
      amount_inr: 118,
      status: "paid", // Already paid
      provider_order_id: "order_test_789",
    };

    const mockSubject = {
      id: "sub_456",
      name: "Mathematics 101",
      duration_months: 6,
      price_inr: 100,
    };

    const mockUpdates: any[] = [];

    const mockSupabase = {
      from: (table: string) => {
        if (table === "payments") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockAlreadyPaid, error: null }),
              }),
            }),
            update: (data: any) => {
              mockUpdates.push(data);
              return { eq: () => ({ eq: async () => ({ error: null }) }) };
            },
          };
        }
        if (table === "subjects") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockSubject, error: null }),
              }),
            }),
          };
        }
        if (table === "students") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "stu_123", user_id: "usr_student_1" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "enrollments") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: "enr_123", status: "active" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            upsert: async () => ({ error: null }),
          };
        }
        return {};
      },
    } as any;

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_999",
            order_id: "order_test_789",
            amount: 11800,
            status: "captured",
          },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = generateWebhookSignature(rawBody);

    const result = await handleRazorpayWebhookInternal(mockSupabase, {
      rawBody,
      signature,
    });

    assert.equal(result.status, "ignored");
    assert.equal(result.reason, "already_paid");
    assert.equal(mockUpdates.length, 0); // No mutation on replay
  });

  test("rejects payment if amount does not match expected order total", async () => {
    const mockPayment = {
      id: "pay_db_123",
      student_id: "stu_123",
      subject_id: "sub_456",
      amount_inr: 590, // Expected 500 base + 90 GST = 590 INR (59000 paise)
      status: "pending",
      provider_order_id: "order_tampered_amount",
    };

    const mockSubject = {
      id: "sub_456",
      name: "Chemistry 101",
      duration_months: 6,
      price_inr: 500,
    };

    const mockSupabase = {
      from: (table: string) => {
        if (table === "payments") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockPayment, error: null }),
              }),
            }),
          };
        }
        if (table === "subjects") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockSubject, error: null }),
              }),
            }),
          };
        }
        if (table === "students") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "stu_123", user_id: "usr_student_1" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as any;

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_999",
            order_id: "order_tampered_amount",
            amount: 100, // Tampered: 1 INR (100 paise) instead of 590 INR (59000 paise)
            status: "captured",
          },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = generateWebhookSignature(rawBody);

    await assert.rejects(async () => {
      await handleRazorpayWebhookInternal(mockSupabase, {
        rawBody,
        signature,
      });
    }, /Payment amount mismatch/);
  });

  // ===========================================================================
  // HTTP Fetch Endpoint Verification (src/server.ts)
  // ===========================================================================
  describe("HTTP Webhook Route: POST /api/webhooks/razorpay", () => {
    test("GET /api/webhooks/razorpay returns 200 OK health status", async () => {
      const request = new Request("http://localhost:3000/api/webhooks/razorpay", {
        method: "GET",
      });

      const response = await serverHandler.fetch(request, {}, {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/json");
      const body = await response.json();
      assert.equal(body.status, "active");
      assert.equal(body.endpoint, "/api/webhooks/razorpay");
    });

    test("POST /api/webhooks/razorpay rejects request with missing signature (400)", async () => {
      const request = new Request("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ event: "payment.captured" }),
      });

      const response = await serverHandler.fetch(request, {}, {});
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.match(body.error, /Missing x-razorpay-signature/i);
    });

    test("POST /api/webhooks/razorpay rejects request with invalid signature (400)", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const request = new Request("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature":
            "0000000000000000000000000000000000000000000000000000000000000000",
        },
        body: payload,
      });

      const response = await serverHandler.fetch(request, {}, {});
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.match(body.error, /Invalid Razorpay webhook signature/i);
    });

    test("PUT /api/webhooks/razorpay returns 405 Method Not Allowed", async () => {
      const request = new Request("http://localhost:3000/api/webhooks/razorpay", {
        method: "PUT",
      });

      const response = await serverHandler.fetch(request, {}, {});
      assert.equal(response.status, 405);
      const body = await response.json();
      assert.match(body.error, /Method not allowed/i);
    });
  });
});
