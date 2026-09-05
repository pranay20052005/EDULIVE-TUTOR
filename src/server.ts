import "./lib/error-capture.ts";

import { consumeLastCapturedError } from "./lib/error-capture.ts";
import { renderErrorPage } from "./lib/error-page.ts";
import { verifyWebhookSignature } from "./lib/server/razorpay.ts";
import {
  getServerSupabase,
  handleRazorpayWebhookInternal,
} from "./lib/server/payment-functions.ts";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Native HTTP handler for Razorpay Webhooks: POST /api/webhooks/razorpay
 * Receives the untouched raw request body for accurate HMAC SHA256 timing-safe verification.
 */
async function handleRazorpayWebhookHttpRequest(request: Request): Promise<Response> {
  if (request.method === "GET" || request.method === "HEAD") {
    return new Response(
      JSON.stringify({
        status: "active",
        endpoint: "/api/webhooks/razorpay",
        service: "EduLive Razorpay Webhook Gateway",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: {
        "content-type": "application/json",
        allow: "POST, GET, HEAD",
      },
    });
  }

  const signature = request.headers.get("x-razorpay-signature") || "";
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing x-razorpay-signature header." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Failed to read request body: ${err?.message || "Unknown error"}` }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  if (!rawBody || !rawBody.trim()) {
    return new Response(JSON.stringify({ error: "Empty webhook payload." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Fast cryptographic timing-safe signature verification before DB access
  const isValidSignature = verifyWebhookSignature({ rawBody, signature });
  if (!isValidSignature) {
    return new Response(JSON.stringify({ error: "Invalid Razorpay webhook signature." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const supabase = getServerSupabase();
    const result = await handleRazorpayWebhookInternal(supabase, {
      rawBody,
      signature,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (err: any) {
    const errorMessage = err?.message || "Webhook processing failed.";
    const isClientError = /invalid|missing|malformed|mismatch|not found|unauthorized/i.test(
      errorMessage,
    );
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: isClientError ? 400 : 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, "");
      if (pathname === "/api/webhooks/razorpay") {
        return await handleRazorpayWebhookHttpRequest(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
