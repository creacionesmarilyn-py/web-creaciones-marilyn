# AI Coding Agent Instructions for `web_mluque`

Welcome to the `web_mluque` project! This document provides essential guidance for AI coding agents to be productive in this codebase. Follow these instructions to understand the project's structure, conventions, and workflows.

## Project Overview

This project appears to be a simple web application with the following key components:

- **Frontend**:
  - `index.html`: The main HTML file serving as the entry point.
  - `style.css`: Contains the styles for the web application.
- **Backend/Logic**:
  - `app.js`: Likely contains the JavaScript logic for the application.
- **Data**:
  - `database.json`: Stores data in JSON format, possibly used as a mock database.

### Architecture
The project is structured as a static web application. The `app.js` file likely handles dynamic behavior, while `database.json` serves as a lightweight data source. The `index.html` file ties everything together, and `style.css` defines the visual presentation.

## Developer Workflows

### Running the Application
Since this is a static web project, you can use a simple HTTP server to serve the files. For example:

```bash
npx http-server .
```

Alternatively, open `index.html` directly in a browser.

### Debugging
- Use browser developer tools to debug JavaScript and inspect the DOM.
- Modify `database.json` to test different data scenarios.

## Project-Specific Conventions

- **Data Handling**:
  - The `database.json` file is the primary data source. Ensure any changes to its structure are reflected in `app.js`.
- **Styling**:
  - Follow the existing CSS conventions in `style.css` to maintain consistency.
- **JavaScript**:
  - Keep functions modular and avoid polluting the global namespace.

## Key Files

- `index.html`: Entry point for the application.
- `style.css`: Defines the application's styles.
- `app.js`: Contains the JavaScript logic.
- `database.json`: Mock database for storing data.

## Examples

### Adding a New Feature
1. Update `database.json` with any required data.
2. Modify `app.js` to implement the feature logic.
3. Update `index.html` to include any new elements.
4. Style the new elements in `style.css`.

### Debugging a Bug
1. Check the browser console for JavaScript errors.
2. Inspect the DOM to ensure elements are rendered correctly.
3. Verify the structure of `database.json` matches the expected format.

## Notes for AI Agents
- Always validate changes to `database.json` to ensure proper JSON formatting.
- When modifying `style.css`, ensure styles do not conflict with existing rules.
- Test changes locally by serving the application and verifying functionality in the browser.

---

Feel free to update this document as the project evolves!