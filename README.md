# SimSpace

A minimal, intuitive 2D top-down planner to see how a racing simulator fits in your room. Add doors and other furniture to keep perspective. Built with React, TypeScript, and Vite.

## Features

- Input room and simulator dimensions (metric cm or imperial in)
- Interactive SVG canvas with grid, pan, zoom, and snap-to-grid
- Drag and rotate objects; delete selected
- Add doors to walls (north/south/east/west) with offset and width
- Add arbitrary furniture objects with custom color
- Auto-saves to localStorage; persists between sessions

## Getting started

```bash
# Install dependencies
pnpm install  # or npm install / yarn install

# Start dev server
pnpm dev      # or npm run dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

Open the app at http://localhost:5173

## Usage tips

- Drag the background to pan; use the Zoom slider on the top bar
- Drag any object to move it; double-click to select; use rotate buttons
- Grid size controls snap granularity (in current unit)
- Doors are shown as orange segments along the selected wall

## Notes

- Internal units are centimeters for precise scaling; imperial inputs are converted
- There is no collision detection yet; arrange as you like
- If you need import/export, we can add JSON project export easily

## License

MIT


