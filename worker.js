const ALLOWED_ORIGINS = new Set([
  "https://www.agrossdomesticproduct.com",
  "https://agrossdomesticproduct.com"
]);

const SHAPEWAYS_TOKEN_URL = "https://api.shapeways.com/oauth2/token";
const SHAPEWAYS_MODELS_URL = "https://api.shapeways.com/models/v1";
const SHAPEWAYS_MATERIALS_URL = "https://api.shapeways.com/materials/v1";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
  }

  return { "Vary": "Origin" };
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...getCorsHeaders(request)
    }
  });
}

function encodeBasicAuth(clientId, clientSecret) {
  return btoa(`${clientId}:${clientSecret}`);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function safeFileName(value) {
  const cleaned = String(value || "AGDP_piece")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return (cleaned || "AGDP_piece").toLowerCase().endsWith(".stl")
    ? cleaned
    : `${cleaned}.stl`;
}

function createUpstreamError(message, response, payload) {
  const error = new Error(message);
  error.status = response.status;
  error.details = payload;
  return error;
}

async function parseJsonResponse(response) {
  const rawText = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = rawText.slice(0, 1500);
  }

  return payload;
}

async function requestShapewaysToken(env) {
  if (!env.SHAPEWAYS_CLIENT_ID || !env.SHAPEWAYS_CLIENT_SECRET) {
    throw new Error("Missing Shapeways credentials");
  }

  const response = await fetch(SHAPEWAYS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encodeBasicAuth(
        env.SHAPEWAYS_CLIENT_ID,
        env.SHAPEWAYS_CLIENT_SECRET
      )}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    }).toString()
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createUpstreamError(
      "Shapeways authentication failed",
      response,
      payload
    );
  }

  if (!payload?.access_token) {
    throw new Error("Shapeways response did not contain an access token");
  }

  return payload;
}

async function shapewaysGet(url, accessToken) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createUpstreamError(
      "Shapeways request failed",
      response,
      payload
    );
  }

  return payload;
}

async function uploadModelToShapeways(file, metadata, env) {
  const token = await requestShapewaysToken(env);
  const fileBuffer = await file.arrayBuffer();

  if (!fileBuffer.byteLength) {
    const error = new Error("The STL file is empty");
    error.status = 400;
    throw error;
  }

  if (fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
    const error = new Error("The STL file exceeds the 25 MB upload limit");
    error.status = 413;
    throw error;
  }

  const fileName = safeFileName(metadata.fileName || file.name);
  const base64File = encodeURIComponent(arrayBufferToBase64(fileBuffer));

  const response = await fetch(SHAPEWAYS_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      fileName,
      file: base64File,
      uploadScale: 0.001,
      description: [
        "A GROSS DOMESTIC PRODUCT Atelier",
        metadata.type ? `Type: ${metadata.type}` : "",
        metadata.seed ? `Seed: ${metadata.seed}` : ""
      ].filter(Boolean).join(" · "),
      hasRightsToModel: 1,
      acceptTermsAndConditions: 1
    })
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw createUpstreamError(
      "Shapeways model upload failed",
      response,
      payload
    );
  }

  const modelId =
    payload?.modelId ??
    payload?.model?.modelId ??
    payload?.model?.id ??
    payload?.id ??
    null;

  if (!modelId) {
    const error = new Error("Shapeways did not return a modelId");
    error.status = 502;
    error.details = payload;
    throw error;
  }

  return {
    modelId,
    fileName,
    shapeways: payload
  };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function materialDisplayText(material) {
  return normalizeText([
    material?.title,
    material?.name,
    material?.materialName,
    material?.displayName,
    material?.finish,
    material?.finishName,
    material?.description
  ].filter(Boolean).join(" "));
}

function materialIdOf(material, fallbackKey) {
  return String(
    material?.materialId ??
    material?.id ??
    fallbackKey ??
    ""
  ).trim();
}

function materialsCollection(payload) {
  const source =
    payload?.Materials ??
    payload?.materials ??
    payload?.result?.Materials ??
    payload?.result?.materials ??
    {};

  if (Array.isArray(source)) {
    return source.map((material, index) => ({
      key: String(index),
      material
    }));
  }

  return Object.entries(source).map(([key, material]) => ({
    key,
    material
  }));
}

function findPolishedSilverMaterial(materialsPayload) {
  const candidates = materialsCollection(materialsPayload)
    .map(({ key, material }) => ({
      id: materialIdOf(material, key),
      title:
        material?.title ??
        material?.name ??
        material?.materialName ??
        material?.displayName ??
        "Polished Silver",
      text: materialDisplayText(material),
      raw: material
    }))
    .filter(candidate => candidate.id);

  const excluded = [
    "fine detail",
    "fine detail polished",
    "antique",
    "satin",
    "sandblasted",
    "vermeil",
    "natural"
  ];

  const exact = candidates.find(candidate =>
    candidate.text.includes("silver") &&
    candidate.text.includes("polished") &&
    !excluded.some(term => candidate.text.includes(term))
  );

  if (exact) return exact;

  const fallback = candidates.find(candidate =>
    candidate.text.includes("silver") &&
    !excluded.some(term => candidate.text.includes(term))
  );

  return fallback || null;
}

function modelMaterialsCollection(modelPayload) {
  const source =
    modelPayload?.materials ??
    modelPayload?.Materials ??
    modelPayload?.model?.materials ??
    modelPayload?.model?.Materials ??
    {};

  if (Array.isArray(source)) {
    return source.map((material, index) => ({
      key: String(index),
      material
    }));
  }

  return Object.entries(source).map(([key, material]) => ({
    key,
    material
  }));
}

function findModelMaterial(modelPayload, materialId) {
  const target = String(materialId);

  for (const { key, material } of modelMaterialsCollection(modelPayload)) {
    const currentId = materialIdOf(material, key);
    if (currentId === target) return material;
  }

  return null;
}

function numericPrice(material) {
  const values = [
    material?.price,
    material?.basePrice,
    material?.totalPrice,
    material?.cost
  ];

  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);

    // A production quote of zero or less is never a valid sellable price.
    if (Number.isFinite(number) && number > 0) return number;
  }

  return null;
}

function quoteCurrency(modelPayload, material) {
  return (
    material?.currency ??
    modelPayload?.currency ??
    modelPayload?.priceCurrency ??
    "USD"
  );
}

async function getPolishedSilverQuote(modelId, env) {
  const token = await requestShapewaysToken(env);

  const [materialsPayload, modelPayload] = await Promise.all([
    shapewaysGet(SHAPEWAYS_MATERIALS_URL, token.access_token),
    shapewaysGet(
      `https://api.shapeways.com/models/${encodeURIComponent(modelId)}/v1`,
      token.access_token
    )
  ]);

  const polishedSilver = findPolishedSilverMaterial(materialsPayload);

  if (!polishedSilver) {
    return {
      status: "material_not_found",
      modelId: String(modelId),
      material: {
        requested: "Polished Silver"
      }
    };
  }

  const modelMaterial = findModelMaterial(modelPayload, polishedSilver.id);

  if (!modelMaterial) {
    return {
      status: "processing",
      modelId: String(modelId),
      material: {
        id: polishedSilver.id,
        title: polishedSilver.title
      }
    };
  }

  const price = numericPrice(modelMaterial);
  const isActive = String(modelMaterial?.isActive ?? "1") !== "0";
  const printable =
    modelMaterial?.isPrintable ??
    modelMaterial?.printable ??
    modelMaterial?.isActive ??
    null;

  if (!isActive) {
    return {
      status: "unavailable",
      modelId: String(modelId),
      material: {
        id: polishedSilver.id,
        title: polishedSilver.title
      },
      printable
    };
  }

  if (price === null) {
    return {
      status: "processing",
      modelId: String(modelId),
      material: {
        id: polishedSilver.id,
        title: polishedSilver.title
      },
      printable
    };
  }

  const multiplier = Number(env.AGDP_PRICE_MULTIPLIER || "2.27");

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("Invalid AGDP_PRICE_MULTIPLIER configuration");
  }

  const salePrice = Number((price * multiplier).toFixed(2));

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return {
      status: "processing",
      material: {
        title: "Polished Silver"
      }
    };
  }

  return {
    status: "ready",
    material: {
      title: "Polished Silver"
    },
    price: salePrice,
    currency: quoteCurrency(modelPayload, modelMaterial)
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");

      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, {
          status: 403,
          headers: getCorsHeaders(request)
        });
      }

      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          service: "agdp-shapeways-api",
          version: "0.5.0",
          timestamp: new Date().toISOString()
        },
        200,
        request
      );
    }

    if (request.method === "GET" && url.pathname === "/auth-test") {
      try {
        const token = await requestShapewaysToken(env);

        return jsonResponse(
          {
            ok: true,
            service: "agdp-production",
            authenticated: true,
            tokenType: token.token_type || "bearer",
            expiresIn: token.expires_in || null
          },
          200,
          request
        );
      } catch (error) {
        console.error("Shapeways authentication error", {
          message: error.message,
          status: error.status || 500,
          details: error.details || null
        });

        return jsonResponse(
          {
            ok: false,
            service: "agdp-production",
            authenticated: false,
            error: {
              code: "SHAPEWAYS_AUTH_FAILED",
              message: error.message,
              upstreamStatus: error.status || null
            }
          },
          error.status === 401 ? 502 : 500,
          request
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/upload") {
      try {
        const contentType = request.headers.get("Content-Type") || "";

        if (!contentType.includes("multipart/form-data")) {
          return jsonResponse(
            {
              ok: false,
              error: {
                code: "UNSUPPORTED_MEDIA_TYPE",
                message: "Expected multipart/form-data"
              }
            },
            415,
            request
          );
        }

        const form = await request.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
          return jsonResponse(
            {
              ok: false,
              error: {
                code: "MISSING_FILE",
                message: "The multipart field 'file' is required"
              }
            },
            400,
            request
          );
        }

        const result = await uploadModelToShapeways(
          file,
          {
            fileName: form.get("fileName"),
            type: form.get("type"),
            seed: form.get("seed")
          },
          env
        );

        return jsonResponse(
          {
            ok: true,
            service: "agdp-production",
            uploaded: true,
            modelId: result.modelId,
            fileName: result.fileName
          },
          201,
          request
        );
      } catch (error) {
        console.error("Shapeways upload error", {
          message: error.message,
          status: error.status || 500,
          details: error.details || null
        });

        return jsonResponse(
          {
            ok: false,
            service: "agdp-production",
            uploaded: false,
            error: {
              code: "SHAPEWAYS_UPLOAD_FAILED",
              message: error.message,
              upstreamStatus: error.status || null,
              details: error.details || null
            }
          },
          error.status && error.status < 500 ? error.status : 502,
          request
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/quote") {
      try {
        const contentType = request.headers.get("Content-Type") || "";

        if (!contentType.includes("application/json")) {
          return jsonResponse(
            {
              ok: false,
              error: {
                code: "UNSUPPORTED_MEDIA_TYPE",
                message: "Expected application/json"
              }
            },
            415,
            request
          );
        }

        const body = await request.json();
        const modelId = String(body?.modelId || "").trim();

        if (!modelId) {
          return jsonResponse(
            {
              ok: false,
              error: {
                code: "MISSING_MODEL_ID",
                message: "modelId is required"
              }
            },
            400,
            request
          );
        }

        const quote = await getPolishedSilverQuote(modelId, env);

        return jsonResponse(
          {
            ok: true,
            service: "agdp-production",
            quote
          },
          200,
          request
        );
      } catch (error) {
        console.error("Shapeways quote error", {
          message: error.message,
          status: error.status || 500,
          details: error.details || null
        });

        return jsonResponse(
          {
            ok: false,
            service: "agdp-production",
            error: {
              code: "SHAPEWAYS_QUOTE_FAILED",
              message: error.message,
              upstreamStatus: error.status || null,
              details: error.details || null
            }
          },
          error.status && error.status < 500 ? error.status : 502,
          request
        );
      }
    }

    return jsonResponse(
      {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found"
        }
      },
      404,
      request
    );
  }
};
