#!/usr/bin/env python3
import os
import json

# Get all SVG files from the mathworld_svgs directory
svg_dir = 'mathworld_svgs'
svg_files = []

if os.path.exists(svg_dir):
    for file in os.listdir(svg_dir):
        if file.endswith('.svg'):
            svg_files.append(file)
    
    # Sort files alphabetically
    svg_files.sort()
    
    # Write to JSON file
    with open('mathworld_svgs_list.json', 'w') as f:
        json.dump(svg_files, f, indent=2)
    
    print(f"Generated list with {len(svg_files)} SVG files")
else:
    print(f"Directory {svg_dir} not found!")