import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/button";
import { api } from "../../lib/api";
import { useSettingsStore } from "../../lib/settingsStore";
import "./settings.css";

export function SettingsScreen() {
  const { units, telemetryHistoryLimit, wsUrl, apiBaseUrl, setUnits, setTelemetryHistoryLimit, setWsUrl, setApiBaseUrl } =
    useSettingsStore();

  const [draftLimit, setDraftLimit] = useState(String(telemetryHistoryLimit));
  const [draftWsUrl, setDraftWsUrl] = useState(wsUrl);
  const [draftApiBaseUrl, setDraftApiBaseUrl] = useState(apiBaseUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.GET("/health");
      if (error) throw new Error("Failed to reach API");
      return data;
    },
  });

  function handleSave() {
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
    setError(null);
    setTelemetryHistoryLimit(parsedLimit);
    setWsUrl(draftWsUrl.trim());
    setApiBaseUrl(draftApiBaseUrl.trim());
    setSaved(true);
  }

  return (
    <div className="settings-screen">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Display</h2>
        <label className="settings-field">
          Units
          <select value={units} onChange={(e) => setUnits(e.target.value as "metric" | "imperial")}>
            <option value="metric">Metric (m/s)</option>
            <option value="imperial">Imperial (ft/s)</option>
          </select>
        </label>
        <label className="settings-field">
          Telemetry history length
          <input
            type="number"
            value={draftLimit}
            onChange={(e) => {
              setDraftLimit(e.target.value);
              setSaved(false);
            }}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Connection</h2>
        <label className="settings-field">
          Telemetry WebSocket URL
          <input
            type="text"
            value={draftWsUrl}
            onChange={(e) => {
              setDraftWsUrl(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="settings-field">
          API base URL
          <input
            type="text"
            value={draftApiBaseUrl}
            onChange={(e) => {
              setDraftApiBaseUrl(e.target.value);
              setSaved(false);
            }}
          />
        </label>
      </section>

      {error ? (
        <p className="settings-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p className="settings-success">Saved.</p> : null}

      <Button className="settings-save-button" onClick={handleSave}>Save changes</Button>

      <section className="settings-section settings-system-section">
        <h2>System</h2>
        {health.isLoading ? <p>Checking API status…</p> : null}
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
