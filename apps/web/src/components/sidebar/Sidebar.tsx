import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { AppIcon } from "../app-icon";
import circleX from "./assets/circle-x.svg";
import cpu from "./assets/cpu.svg";
import gitBranch from "./assets/git-branch.svg";
import packageIcon from "./assets/package.svg";
import puffinLogo from "./assets/puffin-logo.png";
import ros2Services from "./assets/ros2-services.svg";
import settings from "./assets/settings.svg";
import "./sidebar.css";

type NavItem = {
  label: string;
  icon: string | ReactNode;
  path: string | null;
};

// Items without a route exist in the design but are out of scope this week;
// they render disabled until their screens ship.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: circleX, path: "/dashboard" },
  { label: "Simulation", icon: cpu, path: "/simulation" },
  { label: "Vehicles", icon: <AppIcon name="vehicle" />, path: null },
  { label: "World Editor", icon: <AppIcon name="globe" />, path: null },
  { label: "Sensors", icon: <AppIcon name="sensors" />, path: null },
  { label: "Mission Planner", icon: <AppIcon name="map-pin" />, path: null },
  { label: "ROS2 Services", icon: ros2Services, path: "/ros-services" },
  { label: "ROS2 Graph", icon: gitBranch, path: "/ros-graph" },
  { label: "Settings", icon: settings, path: null },
];

export function Sidebar() {
  const renderIcon = (icon: NavItem["icon"]) =>
    typeof icon === "string" ? (
      <img src={icon} alt="" className="nav-item-icon" />
    ) : (
      <span className="nav-item-icon">{icon}</span>
    );

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link to="/" className="sidebar-brand">
          <img src={puffinLogo} alt="" className="sidebar-brand-logo" />
          <span className="sidebar-brand-name">Puffin</span>
        </Link>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) =>
            item.path ? (
              <NavLink key={item.label} to={item.path} className="nav-item">
                {renderIcon(item.icon)}
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.label}
                className="nav-item nav-item-disabled"
                aria-disabled="true"
                title="Not available yet"
              >
                {renderIcon(item.icon)}
                {item.label}
              </span>
            ),
          )}
        </nav>
      </div>
      <div className="sidebar-workspace">
        <img src={packageIcon} alt="" className="sidebar-workspace-icon" />
        <span className="sidebar-workspace-name">rospackage-4</span>
      </div>
    </aside>
  );
}
