// frontend/lib/api.js

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch(path, opts = {}) {
  const url = `${API_URL}${path}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access")
      : null;

  const headers = {
    ...(opts.headers || {}),
    // Do not set Content-Type when sending FormData; browser will set the multipart boundary.
    ...(opts.isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const config = {
    method: opts.method || "GET",
    headers,
  };

  if (opts.body && opts.method !== "GET") {
    if (opts.isFormData) {
      config.body = opts.body; // assume FormData
    } else {
      config.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    }
  }

  const res = await fetch(url, config);

  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  // Normalize any returned image paths to full URLs so frontend can render them
  function normalizeImages(node) {
    if (!node) return node;
    if (Array.isArray(node)) {
      return node.map(normalizeImages);
    }
    if (typeof node === "object") {
      const out = {};
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (
          (key === "image" || key === "image_url" || key === "thumbnail") &&
          typeof val === "string" &&
          val.length > 0 &&
          !val.startsWith("http")
        ) {
          out[key] = `${API_URL}${val}`;
        } else {
          out[key] = normalizeImages(val);
        }
      }
      return out;
    }
    return node;
  }

  const normalized = normalizeImages(data);

  return {
    ok: res.ok,
    status: res.status,
    data: normalized,
  };
}
