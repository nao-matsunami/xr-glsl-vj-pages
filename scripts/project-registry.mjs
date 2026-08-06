export const projects = [
  { slug: "glsl", label: "GLSL VJ Site", path: "." },
  { slug: "canvas2d", label: "Canvas 2D VJ Site", path: "canvas-2d-vj-site" },
  { slug: "threejs", label: "Three.js VJ Site", path: "three-js-vj-site" },
  { slug: "svgcss", label: "SVG CSS VJ Site", path: "svg-css-vj-site" },
  { slug: "python", label: "Python VJ Site", path: "python-vj-site" },
  { slug: "p5js", label: "p5.js VJ Site", path: "p5-js-vj-site" },
  { slug: "webgpu", label: "WebGPU VJ Site", path: "webgpu-vj-site" },
  { slug: "hydra", label: "Hydra VJ Site", path: "hydra-vj-site" },
  { slug: "isf", label: "ISF VJ Site", path: "isf-vj-site" },
  { slug: "blender", label: "Blender VJ Site", path: "blender-vj-site" },
  { slug: "touchdesigner", label: "TouchDesigner VJ Site", path: "touchdesigner-vj-site" },
  { slug: "resolume-wire", label: "Resolume Wire VJ Site", path: "resolume-wire-vj-site" },
  { slug: "resolume-ffgl", label: "Resolume FFGL VJ Site", path: "resolume-ffgl-vj-site" },
  { slug: "godot", label: "Godot VJ Site", path: "godot-vj-site" },
  { slug: "unity", label: "Unity VJ Site", path: "unity-vj-site" },
  { slug: "cables", label: "cables.gl VJ Site", path: "cables-vj-site" },
  { slug: "max-jitter", label: "Max Jitter VJ Site", path: "max-jitter-vj-site" },
  { slug: "processing", label: "Processing VJ Site", path: "processing-vj-site" },
  { slug: "openframeworks", label: "openFrameworks VJ Site", path: "openframeworks-vj-site" },
];

export const groups = {
  core: ["glsl", "canvas2d", "threejs", "svgcss", "python", "p5js", "godot", "unity"],
  saleable: ["blender", "touchdesigner", "resolume-wire", "isf", "threejs", "webgpu"],
  all: projects.map((project) => project.slug),
};

export function selectProjects(value = "core") {
  const names = value.split(",").map((item) => item.trim()).filter(Boolean);
  const slugs = names.flatMap((name) => groups[name] || [name]);
  const selected = projects.filter((project) => slugs.includes(project.slug));
  const missing = slugs.filter((slug) => !projects.some((project) => project.slug === slug));
  if (missing.length) {
    throw new Error(`Unknown project slug: ${missing.join(", ")}`);
  }
  return selected;
}
