declare global {
  interface Window {
    __FILE_SHARE_API_BASE_URL__?: string;
  }
}

const API_BASE_URL = (window.__FILE_SHARE_API_BASE_URL__ || "/api").replace(/\/+$/, "");

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type AuthCredentials = {
  email: string;
  password: string;
};

type SignupDetails = AuthCredentials & {
  name: string;
};

export type FileRecord = {
  id: string;
  original_name: string;
  mime_type?: string;
  size_bytes: number | string;
  share_token?: string;
  expires_at?: string;
  download_count?: number;
  createdAt?: string;
  updatedAt?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new ApiError(
      `Couldn't reach the API at ${API_BASE_URL}. Check the backend is running and BUN_PUBLIC_API_BASE_URL is configured correctly. A browser CORS policy can also block this request.`,
      0,
    );
  }

  const responseText = await response.text();
  let payload: unknown;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  const envelope = isRecord(payload) ? payload : undefined;
  const serverMessage =
    envelope && typeof envelope.message === "string"
      ? envelope.message
      : typeof payload === "string"
        ? payload
        : "";

  if (!response.ok) {
    throw new ApiError(
      serverMessage || `The API request failed (${response.status}).`,
      response.status,
    );
  }
  if (!envelope) {
    throw new ApiError("The API returned an unexpected response.", response.status);
  }
  return envelope as ApiEnvelope<T>;
}

export async function signUp(details: SignupDetails): Promise<void> {
  await request<never>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  });
}

export async function signIn(credentials: AuthCredentials): Promise<string> {
  const response = await request<string>("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (typeof response.data !== "string" || response.data.length === 0) {
    throw new ApiError("The sign-in response did not include a valid token.", 200);
  }
  return response.data;
}

export async function listFiles(token: string): Promise<FileRecord[]> {
  const response = await request<FileRecord[]>("/file/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!Array.isArray(response.data)) {
    throw new ApiError("The API response did not include a file list.", 200);
  }
  return response.data;
}

export async function uploadFile(
  token: string,
  file: File,
): Promise<FileRecord | undefined> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await request<FileRecord>("/file", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return response.data;
}

export async function deleteFile(token: string, id: string): Promise<void> {
  await request<never>(`/file/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getShareUrl(shareToken: string): string {
  const relativePath = `${API_BASE_URL}/file/share/${encodeURIComponent(shareToken)}`;
  return new URL(relativePath, window.location.origin).toString();
}
