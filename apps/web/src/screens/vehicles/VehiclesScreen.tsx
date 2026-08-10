import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppIcon } from "../../components/app-icon";
import { StatusTag } from "../../components/status-tag";
import { api } from "../../lib/api";
import { useTelemetryStore } from "../../lib/telemetryStore";
import {
  DEFAULT_SPAWNED_MODEL,
  fmuTopics,
  searchVehicles,
  statusFor,
  VEHICLES,
  type Vehicle,
  type VehicleStatus,
} from "./vehicleCatalog";
import "./vehicles.css";

const STATUS_LABELS: Record<VehicleStatus, string> = {
  spawned: "Spawned",
  available: "Available",
  "not-installed": "Not installed",
};

// map onto the app's three status tones: flying = running, ready = armed
const STATUS_TONES: Record<VehicleStatus, "running" | "armed" | "stopped"> = {
  spawned: "running",
  available: "armed",
  "not-installed": "stopped",
};

interface VehicleCardProps {
  isSelected: boolean;
  onSelect: () => void;
  status: VehicleStatus;
  vehicle: Vehicle;
}

function VehicleCard({ isSelected, onSelect, status, vehicle }: VehicleCardProps) {
  return (
    <li>
      <button
        type="button"
        className={`vehicle-card${isSelected ? " is-selected" : ""}`}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <div className="vehicle-card-top">
          <span className="vehicle-category">{vehicle.category}</span>
          <StatusTag status={STATUS_TONES[status]} label={STATUS_LABELS[status]} />
        </div>
        <div className={`vehicle-card-figure vehicle-figure-${status}`}>
          <AppIcon name="drone" />
        </div>
        <div className="vehicle-card-info">
          <strong>{vehicle.name}</strong>
          <div className="vehicle-card-meta">
            <span className="vehicle-model">PX4 · gz {vehicle.model}</span>
            <span className="vehicle-sensor-icons">
              <span className={vehicle.sensors.camera ? "" : "sensor-absent"} title="camera">
                <AppIcon name="camera" />
              </span>
              <span className={vehicle.sensors.lidar ? "" : "sensor-absent"} title="lidar">
                <AppIcon name="radar" />
              </span>
              <span className={vehicle.sensors.gps ? "" : "sensor-absent"} title="gps">
                <AppIcon name="map-pin" />
              </span>
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

interface VehicleInspectorProps {
  status: VehicleStatus;
  vehicle: Vehicle;
}

function VehicleInspector({ status, vehicle }: VehicleInspectorProps) {
  // live topics only answer for the vehicle px4 is attached to
  const graph = useQuery({
    queryKey: ["ros-graph"],
    queryFn: async () => (await api.GET("/ros/graph")).data,
    refetchInterval: 5000,
    enabled: status === "spawned",
  });

  const live = status === "spawned" ? fmuTopics(graph.data) : null;
  const published = live?.published.length ? live.published : vehicle.expectedTopics.filter((t) => t.startsWith("/fmu/out/"));
  const subscribed = live?.subscribed.length ? live.subscribed : vehicle.expectedTopics.filter((t) => t.startsWith("/fmu/in/"));
  const isLive = Boolean(live?.published.length || live?.subscribed.length);

  return (
    <aside className="vehicle-inspector" aria-label="Selected vehicle details">
      <div className={`vehicle-inspector-figure vehicle-figure-${status}`}>
        <AppIcon name="drone" />
      </div>
      <header className="vehicle-inspector-header">
        <h2>{vehicle.name}</h2>
        <p>
          {vehicle.airframe !== null
            ? `PX4 gz airframe · ${vehicle.model} (SYS_AUTOSTART ${vehicle.airframe})`
            : `not shipped in this px4 release · gz ${vehicle.model}`}
        </p>
      </header>

      <section className="vehicle-inspector-section">
        <h3>Specifications</h3>
        <dl className="vehicle-spec-list">
          {vehicle.specs.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="vehicle-inspector-section">
        <h3>
          ROS2 Topics
          <span className="vehicle-topics-source">
            {isLive ? "live from /ros/graph" : "expected once spawned"}
          </span>
        </h3>
        <ul className={`vehicle-topic-list${isLive ? "" : " is-expected"}`}>
          {published.map((topic) => (
            <li key={topic}>
              <span className="vehicle-topic-dir">out</span>
              {topic}
            </li>
          ))}
          {subscribed.map((topic) => (
            <li key={topic}>
              <span className="vehicle-topic-dir">in</span>
              {topic}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function VehiclesScreen() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(DEFAULT_SPAWNED_MODEL);
  const [announcement, setAnnouncement] = useState("");
  const queryClient = useQueryClient();
  const telemetryLive = useTelemetryStore(
    (state) => state.connected && state.latest !== null,
  );

  const simStatus = useQuery({
    queryKey: ["sim-status"],
    queryFn: async () => {
      const { data, error } = await api.GET("/sim/status");
      if (error) throw new Error("Failed to fetch sim status");
      return data;
    },
    refetchInterval: 3000,
  });
  // one vehicle flies at a time; the api names it, we only tag cards by it
  const spawnedModel = simStatus.data?.vehicle ?? DEFAULT_SPAWNED_MODEL;

  const visible = searchVehicles(VEHICLES, query);
  const selectedVehicle =
    visible.find((v) => v.model === selected) ?? visible[0] ?? null;
  const selectedStatus = selectedVehicle
    ? statusFor(selectedVehicle, telemetryLive, spawnedModel)
    : null;

  const replace = useMutation({
    mutationFn: async (model: string) => {
      const { data, error } = await api.POST("/sim/vehicle", { body: { model } });
      if (error || !data.ok) throw new Error(data?.detail ?? "Replace failed");
      return data;
    },
    onSuccess: (data) => {
      setAnnouncement(data.detail);
      void queryClient.invalidateQueries({ queryKey: ["sim-status"] });
    },
    onError: (err) =>
      setAnnouncement(err instanceof Error ? err.message : "Replace failed"),
  });

  // disabled always says why: the same button carries the refusal
  const replaceRefusal =
    selectedVehicle === null
      ? "select a vehicle to replace the flying one"
      : selectedStatus === "not-installed"
        ? `${selectedVehicle.model} is not baked into this px4 image`
        : selectedStatus === "spawned"
          ? `${selectedVehicle.model} is already the flying vehicle`
          : null;

  return (
    <section className="vehicles-screen">
      <div className="vehicles-layout">
        <section className="vehicles-main" aria-labelledby="vehicles-title">
          <header className="vehicles-header">
            <div>
              <h1 id="vehicles-title">Vehicle Library</h1>
              <p>airframes baked into the sim image · px4 is attached to {spawnedModel}</p>
            </div>
            <div className="vehicles-controls">
              <label className="vehicles-search">
                <AppIcon name="search" />
                <input
                  type="search"
                  placeholder="Search drone models..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="vehicles-replace"
                disabled={replaceRefusal !== null || replace.isPending}
                title={replaceRefusal ?? `swap ${spawnedModel} for ${selectedVehicle?.model}`}
                onClick={() => selectedVehicle && replace.mutate(selectedVehicle.model)}
              >
                {replace.isPending ? "Replacing…" : "Replace vehicle"}
              </button>
            </div>
          </header>

          <p className="vehicles-announcement" aria-live="polite">
            {replace.isPending
              ? `replacing ${spawnedModel} with ${selectedVehicle?.model}; px4 restarts`
              : announcement}
          </p>

          {visible.length === 0 ? (
            <p className="vehicles-empty">No models match “{query}”.</p>
          ) : null}
          <ul className="vehicles-grid">
            {visible.map((vehicle) => (
              <VehicleCard
                key={vehicle.model}
                vehicle={vehicle}
                status={statusFor(vehicle, telemetryLive, spawnedModel)}
                isSelected={vehicle.model === selectedVehicle?.model}
                onSelect={() => setSelected(vehicle.model)}
              />
            ))}
          </ul>
        </section>

        {selectedVehicle && selectedStatus ? (
          <VehicleInspector vehicle={selectedVehicle} status={selectedStatus} />
        ) : null}
      </div>
    </section>
  );
}
