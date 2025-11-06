# SimSpace

Room/simulator top‑down planner built with React + TypeScript + Vite. This README captures the full spec and decisions so the app can be recreated from scratch quickly.

## Core capabilities

- 2D top‑down SVG canvas with grid, pan, zoom, snap‑to‑grid
- Room definition (width, depth) with units (metric cm / imperial in)
- Doors on walls (north/south/east/west) with width and offset from corner; selectable and deletable
- Objects (simulators/furniture) you can add, drag, rotate, select, delete
- Two predefined simulator templates:
  - PRO AM: 80 cm × 190 cm
  - PRO: 100 cm × 240 cm
- Per‑simulator display rigs (top‑down visualization) with presets:
  - Single 49"
  - Triple 42" / Triple 45" curved / Triple 55" / Triple 65"
  - Triple rigs have adjustable side panel angle (45°–80°)
- Display placement rules (top‑down):
  - PRO AM: monitors sit on top of the simulator with ~20 cm of the simulator protruding forward
  - PRO: monitors sit on top with ~30 cm buffer
  - Others: offset in front using stand depth
- Displays adopt the simulator's color and outline (selected vs normal)
- Themeable UI with 3 presets: Soft, Vibrant, Pro
- Pastel swatch redesigned as Soft palette; swatches change with theme
- Import/Export project JSON; auto‑save to localStorage

## UX overview

Top bar
- Rotation slider for selected object (leftmost)
- If a simulator is selected: Displays dropdown and, for triple rigs, an Angle slider (45°–80°) and a numeric input for exact degrees
- Zoom slider
- Grid size slider (snap granularity)

Left sidebar
- Project: Units selector (cm/in), Theme selector (Soft/Vibrant/Pro), Grid size numeric
- Project Data: Import/Export
- Templates: Display setup selector (applies to new templates), buttons to add PRO AM and PRO
- Doors: add/list/delete
- Objects & Doors: list of items with Select/Delete

Canvas interactions
- Drag background to pan
- Wheel/slider to zoom; snap uses grid size
- Drag objects to reposition; double‑click to select
- Rotation uses object center as pivot

## Data model (TypeScript)

- ProjectState
  - units: 'metric' | 'imperial'
  - theme: 'soft' | 'vibrant' | 'pro'
  - room: { widthCm, depthCm }
  - simulator: { widthCm, depthCm } (base defaults; not editable in UI)
  - doors: Door[] where Door { id, wall, offsetCm, widthCm }
  - objects: PlacedObject[] where PlacedObject { id, name, widthCm, depthCm, xCm, yCm, rotationDeg, color, kind: 'simulator'|'furniture', monitor? }
  - canvas: { pxPerCm, panX, panY, snapCm }
  - selectedObjectId, selectedDoorId

- MonitorAttachment
  - layout: 'none' | 'single' | 'triple'
  - screenInches: 49 | 42 | 45 | 55 | 65 (as applicable)
  - panelWidthCm: total width (single: panel width; triple: span)
  - panelDepthCm: stand/rig depth (used to offset monitor in front when not on top)
  - gapCm?: gap between triple panels (per gap)
  - angleDeg?: 45–80 for triple rigs (side panel angle relative to center)

## Visual rules

- Grid background: off‑white (#FBFAF7) and themed grid line color
- Room: white fill, themed stroke
- Objects: rounded rectangles; when selected, stroke changes to theme‑selected
- Monitors: drawn as thin bars (~8 cm) in top‑down; triple side panels rotate inward around inner edges; monitor fill/stroke match the simulator
- PRO AM monitor placement: bar sits on top of simulator with ~20 cm of sim protruding forward
- PRO monitor placement: bar sits on top with ~30 cm buffer

## Theme system

- Soft (formerly “Pastel”): warm palette; grid #E6EFEA; canvas #FBFAF7
- Vibrant: higher contrast (blue/emerald accents)
- Pro: neutral/slate; clean, understated accents
- All styling uses CSS variables on body[data-theme] for: bg, panel, panel-2, border, text, muted, accent, accent-2, danger, grid, canvas-bg, room-fill, room-stroke, object-stroke, object-stroke-selected, door, door-selected, label-text
- Range sliders themed using accent-color and custom track/thumb styles

## File layout (key files)

- `index.html`: title, favicon, font, CSS
- `src/App.tsx`: app state, top bar controls, layout
- `src/components/RoomCanvas.tsx`: SVG rendering and interactions
- `src/components/Controls.tsx`: sidebar controls (project, templates, doors, lists)
- `src/types.ts`: domain types (ProjectState, PlacedObject, Door, MonitorAttachment)
- `src/utils/geometry.ts`: math helpers
- `src/utils/monitors.ts`: monitor presets and sizing
- `src/utils/persistence.ts`: localStorage load/save
- `src/styles.css`: theme tokens and UI styles

## Display presets (approximate)

- Single 49": width ~119 cm, depth ~30 cm
- Triple 42": panel ~93 cm, depth ~30 cm (span = 3×panel + 2×gap)
- Triple 45" curved: panel ~105 cm, depth ~32 cm
- Triple 55": panel ~121 cm, depth ~35 cm
- Triple 65": panel ~144 cm, depth ~40 cm
- Default gap ~2 cm; default angle 60°; adjustable 45°–80° in top bar

## Build & run

```bash
# install
npm install
# dev
npm run dev
# build
npm run build
# preview
npm run preview
```

Open http://localhost:5173

## Deploy / embed

- Deploy to Netlify/Vercel; set build `npm run build`, output `dist/`
- Embed into WordPress with an iframe to the deployed URL, e.g.:

```html
<iframe src="https://YOUR-APP-URL" style="width:100%;height:900px;border:0;border-radius:12px" loading="lazy"></iframe>
```

## Rebuild checklist (from scratch)

1) Create Vite React + TS app; add dependencies and tsconfig (jsx react-jsx)
2) Build `types.ts` with ProjectState, PlacedObject, Door, MonitorAttachment
3) Implement reducer in `App.tsx`; wire load/save to localStorage
4) Layout: top bar, left sidebar, main canvas
5) Canvas: grid (themed via CSS var), room rect, doors, objects, drag/rotate, pan/zoom
6) Monitor rendering: thin bars; triple with angle; color/outline match simulator; placement rules for PRO AM (20 cm) and PRO (30 cm)
7) Sidebar: Project (units, theme, grid numeric), Project Data (import/export), Templates with monitor preset select and PRO AM/PRO buttons, Doors panel, Objects list
8) Top bar: rotation slider; simulator monitors dropdown; triple angle slider + numeric input; zoom + grid sliders
9) Theme tokens in CSS; slider theming; swatch palettes per theme
10) Favicon/logo wiring

## Notes / limitations

- Units stored internally as centimeters; conversions occur at inputs
- No collision detection or wall thickness yet
- JSON import trusts structure; add validation if needed

## License

MIT


