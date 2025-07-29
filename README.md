# The Beauty of Math

A visual gallery showcasing mathematical illustrations from Wolfram MathWorld.

## Features

- Responsive masonry grid layout
- Dark/light theme support
- Lazy loading with virtualization for performance
- Automatic system theme detection
- SVG color inversion in dark mode

## Development

```bash
# Install dependencies
npm install

# Run development server (default - uses MathWorld URLs)
npm run dev

# Build for production
npm run build
```

## Different Versions

### Production Version (default - direct from MathWorld)

The default `index.html` loads images directly from mathworld.wolfram.com using URLs from `illustrations_crawler_state.json`. Note that this requires CORS to be enabled on the MathWorld servers or a proxy setup.

### Local Version (with local SVG files)

```bash
# Run local version
npm run dev:local
```

For local development with SVG files:
1. Place SVG files in `mathworld_svgs/` directory (not tracked in git)
2. Run `python3 generate_svg_list.py` to generate file list
3. Start development server with `npm run dev:local`

## Credits

All images from [Wolfram MathWorld](https://mathworld.wolfram.com), assembled by Eric W. Weisstein.
All rights belong to Wolfram Research, Inc.