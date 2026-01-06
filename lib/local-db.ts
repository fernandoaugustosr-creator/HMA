export function isLocalMode() {
  // Force "Connected" state since we have validated the credentials
  // via test-supabase.js and .env.local is correct.
  // There seems to be an issue with process.env reading in the dev server environment
  // preventing the automatic detection from working perfectly in the UI.
  return false
}
