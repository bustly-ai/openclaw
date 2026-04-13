#!/usr/bin/env node

import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import process from "node:process";
import { WebSocket } from "ws";

const PROTOCOL_VERSION = 3;
const REQUESTED_ROLE = "operator";
const REQUESTED_SCOPES = ["operator.read", "operator.write", "operator.admin"];

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function deriveDeviceIdFromPublicKeyRaw(rawPublicKey) {
  return createHash("sha256").update(rawPublicKey).digest("hex");
}

function buildDeviceAuthPayload({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce }) {
  return [
    "v2",
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(","),
    String(signedAtMs),
    token ?? "",
    nonce,
  ].join("|");
}

function createEphemeralDevice() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  // Ed25519 SPKI = 12-byte prefix + 32-byte raw key.
  const rawPublicKey = publicKeyDer.subarray(12);
  return {
    deviceId: deriveDeviceIdFromPublicKeyRaw(rawPublicKey),
    publicKeyRawBase64Url: toBase64Url(rawPublicKey),
    signPayload(payload) {
      const signature = sign(null, Buffer.from(payload, "utf8"), privateKey);
      return toBase64Url(signature);
    },
  };
}

function parseArgs(argv) {
  const args = {
    url: "",
    token: "",
    method: "",
    params: "{}",
    timeoutMs: "10000",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for ${key}`);
    }
    if (key === "--url") args.url = value;
    else if (key === "--token") args.token = value;
    else if (key === "--method") args.method = value;
    else if (key === "--params") args.params = value;
    else if (key === "--timeout-ms") args.timeoutMs = value;
    else throw new Error(`unknown arg: ${key}`);
    i += 1;
  }
  if (!args.url || !args.token || !args.method) {
    throw new Error("usage: raw-gateway-call.mjs --url <ws://...> --token <token> --method <rpc> [--params '{}'] [--timeout-ms 10000]");
  }
  return {
    ...args,
    timeoutMs: Number.parseInt(args.timeoutMs, 10),
  };
}

function safeParseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function callRawGateway({ url, token, method, params, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { maxPayload: 25 * 1024 * 1024 });
    const device = createEphemeralDevice();
    const connectReqId = randomUUID();
    const rpcReqId = randomUUID();
    let done = false;
    let connected = false;

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error(`timeout waiting for gateway response (${timeoutMs}ms)`));
    }, Math.max(1000, timeoutMs));

    ws.on("open", () => {
      // Wait for connect.challenge event from server.
    });

    ws.on("message", (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      const frame = safeParseJson(text, null);
      if (!frame || typeof frame !== "object") {
        return;
      }

      if (frame.type === "event" && frame.event === "connect.challenge") {
        const nonce = frame?.payload?.nonce;
        if (typeof nonce !== "string" || nonce.trim().length === 0) {
          finish(reject, new Error("gateway connect.challenge missing nonce"));
          return;
        }
        const clientId = "cli";
        const clientMode = "cli";
        const signedAtMs = Date.now();
        const payload = buildDeviceAuthPayload({
          deviceId: device.deviceId,
          clientId,
          clientMode,
          role: REQUESTED_ROLE,
          scopes: REQUESTED_SCOPES,
          signedAtMs,
          token,
          nonce,
        });
        const connectFrame = {
          type: "req",
          id: connectReqId,
          method: "connect",
          params: {
            minProtocol: PROTOCOL_VERSION,
            maxProtocol: PROTOCOL_VERSION,
            client: {
              id: clientId,
              version: "cloud-smoke",
              platform: process.platform,
              mode: clientMode,
            },
            role: REQUESTED_ROLE,
            scopes: REQUESTED_SCOPES,
            device: {
              id: device.deviceId,
              publicKey: device.publicKeyRawBase64Url,
              signature: device.signPayload(payload),
              signedAt: signedAtMs,
              nonce,
            },
            caps: [],
            auth: { token },
          },
        };
        ws.send(JSON.stringify(connectFrame));
        return;
      }

      if (frame.type !== "res" || typeof frame.id !== "string") {
        return;
      }

      if (frame.id === connectReqId) {
        if (!frame.ok) {
          const message = frame?.error?.message ?? "gateway connect failed";
          finish(reject, new Error(message));
          return;
        }
        connected = true;
        const rpcFrame = {
          type: "req",
          id: rpcReqId,
          method,
          params,
        };
        ws.send(JSON.stringify(rpcFrame));
        return;
      }

      if (frame.id === rpcReqId) {
        if (!frame.ok) {
          const message = frame?.error?.message ?? "gateway rpc failed";
          const code = frame?.error?.code ? ` (${frame.error.code})` : "";
          finish(reject, new Error(`${message}${code}`));
          return;
        }
        finish(resolve, frame.payload ?? {});
      }
    });

    ws.on("error", (err) => {
      finish(reject, err instanceof Error ? err : new Error(String(err)));
    });

    ws.on("close", (code, reason) => {
      if (done) {
        return;
      }
      const reasonText = typeof reason === "string" ? reason : reason?.toString("utf8") ?? "";
      if (!connected) {
        finish(reject, new Error(`gateway closed before connect: code=${code} reason=${reasonText}`));
      } else {
        finish(reject, new Error(`gateway closed unexpectedly: code=${code} reason=${reasonText}`));
      }
    });
  });
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const payload = safeParseJson(args.params, {});
    const result = await callRawGateway({
      url: args.url,
      token: args.token,
      method: args.method,
      params: payload,
      timeoutMs: Number.isFinite(args.timeoutMs) ? args.timeoutMs : 10_000,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

void main();
