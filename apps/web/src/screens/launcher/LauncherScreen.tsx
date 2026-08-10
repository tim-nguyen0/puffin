import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button, DroneIcon } from "../../components/button";
import { PuffinLogo } from "../../components/puffin-logo";
import { RecentFolders } from "../../components/recent-folders";
import { useAuthStore } from "../../lib/authStore";
import "./launcher.css";

const RECENT_FOLDERS = [
  { id: "rospackage-1", name: "rospackage-1" },
  { id: "rospackage-2", name: "rospackage-2" },
  { id: "rospackage-3", name: "rospackage-3" },
];

export function LauncherScreen() {
  const navigate = useNavigate();
  const { user, initialized, loading, error, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await login(email, password);
    } catch {
      return;
    }
    navigate("/dashboard");
  }

  return (
    <section className="launcher-screen" aria-label="Puffin login">
      <PuffinLogo />
      {/* the launch page is the login - wait for token restore so a saved
          session doesn't flash the form */}
      {initialized ? (
        <form className="launcher-login" onSubmit={handleSubmit}>
          <label className="launcher-field">
            Email
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="launcher-field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="launcher-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="new-simulation-button"
            endIcon={<DroneIcon />}
            disabled={loading}
          >
            {loading ? "Logging in…" : "Login"}
          </Button>
          <p className="launcher-signup">
            Need an account? <Link to="/signup">Sign up</Link>
          </p>
        </form>
      ) : null}
      <RecentFolders folders={RECENT_FOLDERS} />
    </section>
  );
}
