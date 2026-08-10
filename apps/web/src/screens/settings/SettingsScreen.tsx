import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/button";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/authStore";
import { type Units, useSettingsStore } from "../../lib/settingsStore";
import "./settings.css";

export function SettingsScreen() {
  const token = useAuthStore((state) => state.token);
  const { units, telemetryHistoryLimit, wsUrl, apiBaseUrl, loading, error: loadError, save } =
    useSettingsStore();
  const [draftUnits, setDraftUnits] = useState<Units>(units);
  const [draftLimit, setDraftLimit] = useState(String(telemetryHistoryLimit));
  const [draftWsUrl, setDraftWsUrl] = useState(wsUrl);
  const [draftApiBaseUrl, setDraftApiBaseUrl] = useState(apiBaseUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraftUnits(units);
    setDraftLimit(String(telemetryHistoryLimit));
    setDraftWsUrl(wsUrl);
    setDraftApiBaseUrl(apiBaseUrl);
  }, [units, telemetryHistoryLimit, wsUrl, apiBaseUrl]);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.GET("/health");
      if (error) throw new Error("Failed to reach API");
      return data;
    },
  });

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    const parsedLimit = Number(draftLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 10 || parsedLimit > 5000) {
      setError("Telemetry history length must be between 10 and 5000 samples.");
      setSaved(false);
      return;
    }
    if (!draftWsUrl.trim() || !draftApiBaseUrl.trim()) {
      setError("Connection URLs can't be empty.");
      setSaved(false);
      return;
    }
    // saving without a token used to fail silently
    if (!token) {
      setError("Your session expired — log in again to save settings.");
      setSaved(false);
      return;
    }

    setError(null);
    setSaved(false);
    try {
      const { terminalX, terminalY, terminalMinimized } = useSettingsStore.getState();
      await save(token, {
        units: draftUnits,
        telemetry_history_limit: parsedLimit,
        ws_url: draftWsUrl.trim(),
        api_base_url: draftApiBaseUrl.trim(),
        terminal_x: terminalX,
        terminal_y: terminalY,
        terminal_minimized: terminalMinimized,
      });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save settings");
    }
  }

  return (
    <div className="settings-screen">
      <h1>Settings</h1>

      {/* one form: the fields, their messages and the button that saves them.
          the read-only system card sits outside it */}
      <form className="settings-form" onSubmit={handleSave}>
        <section className="settings-section">
          <h2>Display</h2>
          <label className="settings-field">
            Units
            <select
              value={draftUnits}
              onChange={(event) => {
                setDraftUnits(event.target.value as Units);
                setSaved(false);
              }}
            >
              <option value="metric">Metric (m, m/s)</option>
              <option value="imperial">Imperial (ft, ft/s)</option>
            </select>
          </label>
          <label className="settings-field">
            Telemetry history length
            <input
              type="number"
              min={10}
              max={5000}
              aria-describedby="telemetry-limit-hint"
              value={draftLimit}
              onChange={(event) => {
                setDraftLimit(event.target.value);
                setSaved(false);
              }}
            />
            {/* the 10-5000 rule only showed up as an error after saving */}
            <small id="telemetry-limit-hint" className="settings-hint">
              10–5000 samples kept for the sparklines
            </small>
          </label>
        </section>

        <section className="settings-section">
          <h2>Connection</h2>
          <label className="settings-field">
            Telemetry WebSocket URL
            <input
              type="text"
              value={draftWsUrl}
              onChange={(event) => {
                setDraftWsUrl(event.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label className="settings-field">
            API base URL
            <input
              type="text"
              value={draftApiBaseUrl}
              onChange={(event) => {
                setDraftApiBaseUrl(event.target.value);
                setSaved(false);
              }}
            />
          </label>
        </section>

        {error || loadError ? <p className="settings-error" role="alert">{error ?? loadError}</p> : null}
        {saved ? <p className="settings-success" role="status">Saved.</p> : null}

        <Button type="submit" className="settings-save-button" disabled={loading}>
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </form>

      <section className="settings-section settings-system-section">
        <h2>System</h2>
        {health.isLoading ? <p>Checking API status...</p> : null}
        {health.isError ? <p className="settings-error">Could not reach the API.</p> : null}
        {health.data ? (
          <dl className="settings-system-info">
            <dt>Status</dt>
            <dd>{health.data.status}</dd>
            <dt>API version</dt>
            <dd>{health.data.version}</dd>
          </dl>
        ) : null}
      </section>
    </div>
  );
}
