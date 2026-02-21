# Moodle HTML Fixtures

Place your Moodle course HTML files here for testing.

## How to use:

1. Navigate to a course page in your browser
2. Right-click → "View Page Source" or use DevTools
3. Copy the entire HTML and save as `course.html`
4. Run the tests: `npx vitest run src/main/moodle/browser.test.ts`

The tests will parse the HTML and show you what resources were extracted.
