# JSON Compare Tool

A browser-based tool for comparing and formatting JSON data. This tool allows you to:

- Format and compare two JSON objects side by side
- Highlight differences between the objects
- Sort JSON keys alphabetically
- View only the differences between documents
- Choose from different JSON templates

## Features

- Real-time JSON comparison
- Local storage to save your recent work
- Format malformed JSON
- Sort keys alphabetically
- Show only differences mode
- Synchronized scrolling

CSV support
- Drag and drop CSV files directly onto the left or right editor pane.
- Dropped CSV files are automatically converted to JSON (array of objects) using a built-in converter and formatted for comparison.
- You can compare CSV vs CSV, CSV vs JSON, or JSON vs JSON. If conversion fails, the tool shows an error and leaves the original content untouched.

Notes about conversion
- The converter attempts to auto-detect separator (comma, tab, or semicolon) and handles quoted fields and escaped quotes.
- By default it will coerce numeric and boolean-looking values to proper JSON types when converting.

## Usage

Visit the [JSON Compare Tool](https://dipenparmar12.github.io/json_compair/) to use the online version.

Or clone this repository and open `index.html` in your browser to run it locally.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
