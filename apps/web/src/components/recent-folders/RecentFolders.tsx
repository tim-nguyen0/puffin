import "./recent-folders.css";
import { FolderIcon } from "./FolderIcon";

export type RecentFolder = {
  id: string;
  name: string;
};

export type RecentFoldersProps = {
  className?: string;
  folders: readonly RecentFolder[];
  onFolderSelect?: (folder: RecentFolder) => void;
  title?: string;
};

export function RecentFolders({
  className,
  folders,
  onFolderSelect,
  title = "Recents",
}: RecentFoldersProps) {
  const classes = ["recent-folders", className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-label={title}>
      <h2 className="recent-folders-title">{title}</h2>
      <ul className="recent-folders-list">
        {folders.map((folder) => (
          <li key={folder.id} className="recent-folders-item">
            <button
              className="recent-folder-button"
              type="button"
              onClick={onFolderSelect ? () => onFolderSelect(folder) : undefined}
              disabled={!onFolderSelect}
              title={onFolderSelect ? undefined : "Not available yet"}
            >
              <span className="recent-folder-name">{folder.name}</span>
              <span className="recent-folder-icon" aria-hidden="true">
                <FolderIcon />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
