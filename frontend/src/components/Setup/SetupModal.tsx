import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";

interface SetupModalProps {
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "checking" | "install" | "installing" | "login" | "polling" | "api-key" | "ready";
type SetupStatus = {
  cli_installed: boolean;
  cli_path: string;
  logged_in: boolean;
  email: string;
  has_api_key: boolean;
  ready: boolean;
  platform: string;
  wsl_installed: boolean;
  wsl_distro: string;
};

export function SetupModal({ onComplete, onCancel }: SetupModalProps) {
  const [step, setStep] = useState<Step>("checking");
  const [error, setError] = useState("");
  const [userCode, setUserCode] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkStatus = async () => {
    try {
      const nextStatus = await api.setupStatus();
      setStatus(nextStatus);
      if (nextStatus.ready) {
        setStep("ready");
        setTimeout(onComplete, 500);
      } else if (!nextStatus.cli_installed) {
        setStep("install");
      } else {
        setStep("login");
      }
    } catch {
      setStep("install");
    }
  };

  const handleInstall = async () => {
    setStep("installing");
    setError("");
    try {
      await api.installAgent();
      setStep("login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Install failed");
      setStep("install");
    }
  };

  const handleLogin = async () => {
    setError("");
    try {
      const resp = await api.deviceCode();
      setUserCode(resp.user_code);
      setVerificationUrl(resp.verification_url);

      // Open browser
      const url = resp.verification_url + (resp.user_code ? `?code=${resp.user_code}` : "");
      window.open(url, "_blank");

      setStep("polling");

      // Poll for token
      const interval = (resp.interval || 5) * 1000;
      pollRef.current = setInterval(async () => {
        try {
          const poll = await api.devicePoll(resp.device_code);
          if (poll.access_token) {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("ready");
            setTimeout(onComplete, 800);
          }
        } catch {
          // Keep polling — "authorization_pending" is expected
        }
      }, interval);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start login");
      setStep("login");
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }
    setError("");
    try {
      await api.saveKey(apiKey.trim());
      setStep("ready");
      setTimeout(onComplete, 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    }
  };

  return (
    <div className="setup-overlay" onClick={onCancel}>
      <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="setup-header">
          <div className="setup-logo">
            <span className="setup-icon">&#9673;</span>
            <span>Kyma Agent</span>
          </div>
          <button className="close-btn" onClick={onCancel}>&times;</button>
        </div>

        {step === "checking" && (
          <div className="setup-body">
            <p className="setup-status">Checking setup...</p>
          </div>
        )}

        {step === "install" && (
          <div className="setup-body">
            <p className="setup-title">Install Kyma Agent CLI</p>
            <p className="setup-desc">
              Kyma Agent CLI is required to run AI agents in your terminal.
            </p>
            {status?.platform === "windows" && (
              <p className="setup-hint">
                Windows support is available. For the best <code>kyma-ter</code> shell experience, use WSL2
                {status.wsl_installed ? ` (${status.wsl_distro || "default distro"} detected)` : " (not detected yet)"}.
              </p>
            )}
            {error && <p className="setup-error">{error}</p>}
            <button className="setup-btn primary" onClick={handleInstall}>
              Install Kyma Agent
            </button>
            <p className="setup-hint">
              Or install manually:{" "}
              <code
                className="setup-copyable"
                onClick={() => {
                  navigator.clipboard.writeText("npm i -g @kyma-api/agent");
                  const el = document.querySelector(".setup-copyable") as HTMLElement;
                  if (el) {
                    el.dataset.copied = "true";
                    setTimeout(() => { el.dataset.copied = ""; }, 1500);
                  }
                }}
                title="Click to copy"
              >
                npm i -g @kyma-api/agent
              </code>
            </p>
          </div>
        )}

        {step === "installing" && (
          <div className="setup-body">
            <p className="setup-status">Installing Kyma Agent CLI...</p>
            <p className="setup-desc">This may take a moment.</p>
          </div>
        )}

        {step === "login" && (
          <div className="setup-body">
            <p className="setup-title">Sign in to Kyma</p>
            <p className="setup-desc">
              One account, many AI models. Sign in or create an account to get started.
            </p>
            {status?.platform === "windows" && (
              <p className="setup-hint">
                <code>kyma</code> runs natively on Windows. <code>kyma-ter</code> shell panes prefer WSL2 when available.
              </p>
            )}
            {error && <p className="setup-error">{error}</p>}
            <button className="setup-btn primary" onClick={handleLogin}>
              Sign in with Kyma
            </button>
            <p className="setup-hint">
              New to Kyma?{" "}
              <a href="https://kymaapi.com" target="_blank" rel="noreferrer">
                Sign up at kymaapi.com
              </a>{" "}
              — same button works for both.
            </p>

            <div className="setup-divider">
              <button
                className="setup-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "Hide" : "Advanced"}: paste API key
              </button>
            </div>

            {showAdvanced && (
              <div className="setup-advanced">
                <input
                  className="setup-input"
                  type="password"
                  placeholder="kyma_xxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                />
                <button className="setup-btn" onClick={handleSaveKey}>
                  Save Key
                </button>
              </div>
            )}
          </div>
        )}

        {step === "polling" && (
          <div className="setup-body">
            <p className="setup-title">Complete sign-in in your browser</p>
            <p className="setup-desc">
              A browser window has opened. Complete the sign-in there.
            </p>
            {userCode && (
              <div className="setup-code">
                <p className="setup-code-label">Your code:</p>
                <p className="setup-code-value">{userCode}</p>
              </div>
            )}
            <p className="setup-status">Waiting for confirmation...</p>
            {verificationUrl && (
              <p className="setup-hint">
                Didn't open?{" "}
                <a
                  href={`${verificationUrl}?code=${userCode}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Click here to sign in
                </a>
              </p>
            )}
          </div>
        )}

        {step === "ready" && (
          <div className="setup-body">
            <p className="setup-check">You're all set! Starting Kyma Agent...</p>
          </div>
        )}
      </div>
    </div>
  );
}
