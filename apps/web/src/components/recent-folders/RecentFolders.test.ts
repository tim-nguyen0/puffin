import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecentFolders } from "./RecentFolders";

const folders = [
  { id: "1", name: "rospackage-1" },
  { id: "2", name: "rospackage-2" },
  { id: "3", name: "rospackage-3" },
];

describe("RecentFolders", () => {
  it("renders each provided folder as a selectable button", () => {
    const markup = renderToStaticMarkup(
      createElement(RecentFolders, { folders, onFolderSelect: () => undefined }),
    );

    expect(markup).toContain('aria-label="Recents"');
    expect(markup).toContain("rospackage-1");
    expect(markup).toContain("rospackage-2");
    expect(markup).toContain("rospackage-3");
    expect((markup.match(/<button/g) ?? []).length).toBe(folders.length);
    expect(markup).not.toContain("disabled");
  });

  it("disables the buttons when no select handler is wired", () => {
    const markup = renderToStaticMarkup(createElement(RecentFolders, { folders }));

    expect((markup.match(/disabled/g) ?? []).length).toBe(folders.length);
    expect(markup).toContain("Not available yet");
  });

  it("uses a supplied title", () => {
    const markup = renderToStaticMarkup(
      createElement(RecentFolders, { folders: [], title: "Recent workspaces" }),
    );

    expect(markup).toContain("Recent workspaces");
  });
});
