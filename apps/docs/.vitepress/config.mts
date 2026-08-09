import { defineConfig } from "vitepress";

// the docs wear the console design: light page, dark console surfaces.
// appearance is pinned light because the design's dark is a surface
// treatment, not a theme.
export default defineConfig({
  title: "Puffin",
  description: "Browser control plane for a PX4 + Gazebo drone simulation",
  appearance: false,
  // the localhost urls in the guides are the product, not dead links
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Style", link: "/style" },
      { text: "Architecture", link: "/architecture" },
      { text: "GitHub", link: "https://github.com/tim-nguyen0/puffin" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Flying the demo", link: "/guide/flying" },
          { text: "Adding a ROS package", link: "/guide/packages" },
          { text: "QGroundControl", link: "/guide/qgc" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Visual style", link: "/style" },
          { text: "Architecture", link: "/architecture" },
        ],
      },
    ],
    footer: {
      message: "pixels over novnc · numbers over the telemetry websocket",
    },
  },
});
