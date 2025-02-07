
import axios from "axios";

let googleAuthToken = null;
let tokenExpiration = null;

const apiClient = axios.create({
  baseURL: "https://api.app.ontoworks.org",
});

const retryRequest = async (fn, retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Retry attempt ${i + 1} failed: ${error.message}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

const refreshAuthToken = async () => {
  const loginData = {
    username: process.env.VAIRALITY_USERNAME,
    password: process.env.VAIRALITY_PASSWORD,
  };

  const requestFn = async () => {
    const response = await axios.post("https://api.app.ontoworks.org/account/login", loginData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    googleAuthToken = response.data.token;
    tokenExpiration = new Date(response.data.expiration);
    return googleAuthToken;
  };

  try {
    return await retryRequest(requestFn);
  } catch (error) {
    console.error("Error refreshing auth token:", error.message);
    throw error;
  }
};

export const getAuthToken = async () => {
  if (!googleAuthToken || new Date() >= tokenExpiration) {
    await refreshAuthToken();
  }
  return googleAuthToken;
};

export const setupInterceptors = async () => {
  apiClient.interceptors.request.use(
    async (config) => {
      const token = await getAuthToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response && error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          await refreshAuthToken();
          originalRequest.headers.Authorization = `Bearer ${googleAuthToken}`;
          return apiClient(originalRequest);
        } catch (err) {
          console.error("Token refresh failed:", err.message);
          throw err;
        }
      }
      return Promise.reject(error);
    }
  );
};

export { apiClient };