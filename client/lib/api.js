const BASE_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Attach token if available
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 — clear auth and redirect
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Parse JSON (handle empty responses)
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (error.message === "Unauthorized") throw error;
    throw error;
  }
}

export const apiClient = {
  get: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: "GET" }),

  post: (endpoint, data, options = {}) =>
    request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: (endpoint, data, options = {}) =>
    request(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: "DELETE" }),
};
