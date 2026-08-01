import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../../components/button";
import { useAuthStore } from "../../lib/authStore";
import "./auth.css";

export function LoginScreen() {
  const { user, loading, error, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await login(email, password);
    } catch {
      return;
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Log in to Puffin</h1>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <Button type="submit" disabled={loading}>{loading ? "Logging in..." : "Log in"}</Button>
        <p>Need an account? <Link to="/signup">Sign up</Link></p>
      </form>
    </main>
  );
}
