import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpFromLine,
  Check,
  Clock3,
  Copy,
  File as FileIcon,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  HardDrive,
  LogOut,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  deleteFile,
  getShareUrl,
  listFiles,
  signIn,
  signUp,
  uploadFile,
  type FileRecord,
} from "@/lib/api";
import "./index.css";

const SESSION_DURATION_MS = 60 * 60 * 1000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type SessionState = {
  token: string | null;
  expired: boolean;
};

function readSession(): SessionState {
  const token = window.localStorage.getItem("file-share-token");
  const expiresAt = Number(window.localStorage.getItem("file-share-token-expires"));

  if (!token) return { token: null, expired: false };
  if (!expiresAt || expiresAt <= Date.now()) {
    window.localStorage.removeItem("file-share-token");
    window.localStorage.removeItem("file-share-token-expires");
    return { token: null, expired: true };
  }
  return { token, expired: false };
}

function formatBytes(bytes: number | string): string {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "Size unavailable";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function fileIcon(mimeType?: string) {
  if (mimeType?.startsWith("image/")) return <FileImage aria-hidden="true" />;
  if (mimeType?.startsWith("video/")) return <FileVideo aria-hidden="true" />;
  if (mimeType?.startsWith("text/") || mimeType?.includes("pdf")) {
    return <FileText aria-hidden="true" />;
  }
  return <FileIcon aria-hidden="true" />;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function App() {
  const [initialSession] = useState(readSession);
  const [session, setSession] = useState<SessionState>(initialSession);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [notice, setNotice] = useState(
    initialSession.expired ? "Your session expired. Please sign in again." : "",
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filesBusy, setFilesBusy] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const signOut = (message = "") => {
    window.localStorage.removeItem("file-share-token");
    window.localStorage.removeItem("file-share-token-expires");
    setSession({ token: null, expired: false });
    setFiles([]);
    setNotice(message);
    setAuthError("");
    setActionError("");
  };

  useEffect(() => {
    if (!session.token) {
      setFiles([]);
      setFilesBusy(false);
      return;
    }

    let active = true;
    setFilesBusy(true);
    setFilesError("");
    listFiles(session.token)
      .then((records) => {
        if (active) setFiles(records);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          signOut("Your session is no longer valid. Please sign in again.");
          return;
        }
        setFilesError(messageFor(error));
      })
      .finally(() => {
        if (active) setFilesBusy(false);
      });

    return () => {
      active = false;
    };
  }, [session.token]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setNotice("");
    setAuthBusy(true);
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      if (authMode === "signup") {
        await signUp({ name, email, password });
        setAuthMode("signin");
        setNotice("Your account is ready. Sign in to continue.");
      } else {
        const token = await signIn({ email, password });
        const expiresAt = Date.now() + SESSION_DURATION_MS;
        window.localStorage.setItem("file-share-token", token);
        window.localStorage.setItem("file-share-token-expires", String(expiresAt));
        setSession({ token, expired: false });
      }
    } catch (error) {
      setAuthError(messageFor(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpload = async (selectedFile?: File) => {
    if (!selectedFile || !session.token) return;
    setActionError("");
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setActionError("Files must be 10 MB or smaller.");
      return;
    }

    setUploadBusy(true);
    try {
      const uploadedFile = await uploadFile(session.token, selectedFile);
      try {
        setFiles(await listFiles(session.token));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          signOut("Your session is no longer valid. Please sign in again.");
          return;
        }
        if (uploadedFile) {
          setFiles((current) =>
            current.some((file) => file.id === uploadedFile.id)
              ? current
              : [uploadedFile, ...current],
          );
        }
        setActionError(`File uploaded, but the file list couldn't be refreshed: ${messageFor(error)}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        signOut("Your session is no longer valid. Please sign in again.");
      } else {
        setActionError(messageFor(error));
      }
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDelete = async (file: FileRecord) => {
    if (!session.token || !window.confirm(`Delete "${file.original_name}"? This can't be undone.`)) {
      return;
    }
    setActionError("");
    try {
      await deleteFile(session.token, file.id);
      setFiles((current) => current.filter((entry) => entry.id !== file.id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        signOut("Your session is no longer valid. Please sign in again.");
      } else {
        setActionError(messageFor(error));
      }
    }
  };

  const copyShareLink = async (file: FileRecord) => {
    if (!file.share_token) {
      setActionError("This file does not have a share link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(getShareUrl(file.share_token));
      setCopiedFileId(file.id);
      window.setTimeout(() => setCopiedFileId(null), 1800);
    } catch {
      setActionError("Couldn't copy the link. Check your browser's clipboard permissions.");
    }
  };

  const changeAuthMode = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthError("");
    setNotice("");
  };

  if (!session.token) {
    return (
      <main className="auth-page">
        <header className="site-header auth-header">
          <a className="brand" href="/" aria-label="Keepsake home">
            <span className="brand-mark"><FolderOpen aria-hidden="true" /></span>
            <span>Keepsake</span>
          </a>
          <span className="header-caption">Simple, secure file sharing</span>
        </header>

        <section className="auth-layout">
          <div className="auth-intro">
            <div className="eyebrow"><ShieldCheck aria-hidden="true" /> YOUR FILES, YOUR WAY</div>
            <h1>A little more space for the things that matter.</h1>
            <p>Keep your files together and share them when you’re ready. Private, straightforward, and right where you need it.</p>
            <div className="auth-benefits">
              <span><Check aria-hidden="true" /> Quick and easy uploads</span>
              <span><Check aria-hidden="true" /> Share links that expire in 24 hours</span>
              <span><Check aria-hidden="true" /> Your files in one tidy place</span>
            </div>
            <div className="intro-decoration" aria-hidden="true">
              <div className="decoration-card decoration-card-back"><FileText /></div>
              <div className="decoration-card decoration-card-front"><FileImage /><span>Ready when you are</span></div>
            </div>
          </div>

          <Card className="auth-card">
            <div className="auth-card-heading">
              <div className="eyebrow">WELCOME {authMode === "signin" ? "BACK" : "ABOARD"}</div>
              <h2>{authMode === "signin" ? "Sign in to Keepsake" : "Create your account"}</h2>
              <p>{authMode === "signin" ? "Pick up right where you left off." : "Your personal file space is just a moment away."}</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Account options">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "signin"}
                className={authMode === "signin" ? "auth-tab active" : "auth-tab"}
                onClick={() => changeAuthMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "signup"}
                className={authMode === "signup" ? "auth-tab active" : "auth-tab"}
                onClick={() => changeAuthMode("signup")}
              >
                Create account
              </button>
            </div>

            {notice && <div className="message message-success" role="status">{notice}</div>}
            {authError && <div className="message message-error" role="alert">{authError}</div>}

            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === "signup" && (
                <div className="form-field">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" autoComplete="name" placeholder="How should we address you?" required />
                </div>
              )}
              <div className="form-field">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </div>
              <div className="form-field">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button className="auth-submit" type="submit" disabled={authBusy}>
                {authBusy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}
                {!authBusy && <ArrowUpFromLine aria-hidden="true" />}
              </Button>
            </form>

            <p className="auth-footnote"><ShieldCheck aria-hidden="true" /> Your files are only accessible with your account.</p>
          </Card>
        </section>
        <footer className="site-footer">Made for keeping the important things close.</footer>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="site-header dashboard-header">
        <a className="brand" href="/" aria-label="Keepsake home">
          <span className="brand-mark"><FolderOpen aria-hidden="true" /></span>
          <span>Keepsake</span>
        </a>
        <div className="account-actions">
          <span className="secure-label"><ShieldCheck aria-hidden="true" /> Private space</span>
          <Button variant="outline" size="sm" onClick={() => signOut()}><LogOut aria-hidden="true" /> Sign out</Button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow">YOUR SPACE</div>
            <h1>Good to have you here.</h1>
            <p>Your files, ready whenever you need them.</p>
          </div>
          <div className="storage-note"><Clock3 aria-hidden="true" /><span>Shared links expire after 24 hours</span></div>
        </div>

        <Card className="upload-card">
          <CardContent className="upload-card-content">
            <div className="upload-icon"><UploadCloud aria-hidden="true" /></div>
            <div className="upload-copy">
              <h2>Bring something along</h2>
              <p>Choose a file up to 10 MB. It will be available for 24 hours.</p>
            </div>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              aria-label="Choose a file to upload"
              onChange={(event) => void handleUpload(event.currentTarget.files?.[0])}
              disabled={uploadBusy}
            />
            <Button className="upload-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy}>
              <UploadCloud aria-hidden="true" /> {uploadBusy ? "Uploading…" : "Choose file"}
            </Button>
          </CardContent>
        </Card>

        {actionError && <div className="message message-error action-message" role="alert">{actionError}</div>}
        {filesError && (
          <div className="message message-error action-message" role="alert">
            <span>{filesError}</span>
            <Button variant="outline" size="sm" onClick={() => {
              if (!session.token) return;
              setFilesBusy(true);
              setFilesError("");
              listFiles(session.token)
                .then(setFiles)
                .catch((error: unknown) => {
                  if (error instanceof ApiError && error.status === 401) {
                    signOut("Your session is no longer valid. Please sign in again.");
                  } else {
                    setFilesError(messageFor(error));
                  }
                })
                .finally(() => setFilesBusy(false));
            }}>Try again</Button>
          </div>
        )}

        <div className="files-heading">
          <div>
            <h2>Your files</h2>
            {!filesBusy && !filesError && <span className="file-count">{files.length} {files.length === 1 ? "file" : "files"}</span>}
          </div>
          <span className="file-limit"><HardDrive aria-hidden="true" /> 10 MB max per file</span>
        </div>

        {filesBusy ? (
          <div className="files-state" role="status"><span className="loading-spinner" /> Loading your files…</div>
        ) : filesError ? null : files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen aria-hidden="true" /></div>
            <h3>A fresh start</h3>
            <p>Your file list is empty for now. Upload a file and it’ll show up here.</p>
          </div>
        ) : (
          <div className="file-list">
            {files.map((file) => (
              <Card className="file-card" key={file.id}>
                <CardContent className="file-card-content">
                  <div className="file-type-icon">{fileIcon(file.mime_type)}</div>
                  <div className="file-details">
                    <h3 title={file.original_name}>{file.original_name}</h3>
                    <div className="file-metadata">
                      <span>{formatBytes(file.size_bytes)}</span>
                      <span className="metadata-dot" aria-hidden="true">·</span>
                      <span>Added {formatDate(file.createdAt)}</span>
                      <span className="metadata-dot" aria-hidden="true">·</span>
                      <span>{file.download_count ?? 0} downloads</span>
                    </div>
                    <div className="file-expiry"><Clock3 aria-hidden="true" /> Expires {formatDate(file.expires_at)}</div>
                  </div>
                  <div className="file-actions">
                    {file.share_token ? (
                      <Button variant="outline" size="sm" onClick={() => void copyShareLink(file)} aria-label={`Copy share link for ${file.original_name}`}>
                        {copiedFileId === file.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copiedFileId === file.id ? "Copied" : "Copy link"}
                      </Button>
                    ) : (
                      <span className="no-share-link">No share link</span>
                    )}
                    <Button variant="ghost" size="icon" className="delete-button" onClick={() => void handleDelete(file)} aria-label={`Delete ${file.original_name}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      <footer className="site-footer">Your share links are temporary. Keep the files that matter close.</footer>
    </main>
  );
}

export default App;
