/**
 * Template for js/credentials.js — copy this file, rename it, fill it in.
 *
 * The real file is git-ignored. Not because these values are secret —
 * they ship in the bundle and anyone can read them out of the running
 * app — but because keeping them out of the repository means a fork of
 * Mirra never quietly points at somebody else's Google project.
 *
 * What actually protects a project is the origin allow-list in Google
 * Cloud Console: a key restricted to your domain does nothing on
 * anybody else's.
 *
 * Where to find each value:
 *   CLIENT_ID  Clients → your web client
 *   API_KEY    Credentials → API keys, restricted by referrer
 *   APP_ID     the project NUMBER — the digits before the dash in
 *              CLIENT_ID, not the project ID with letters in it
 */
export const credentials = {
  CLIENT_ID: "PASTE_HERE.apps.googleusercontent.com",
  API_KEY:   "PASTE_HERE",
  APP_ID:    "PASTE_PROJECT_NUMBER",
};
