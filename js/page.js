import { ThemeManager } from "./ui/ThemeManager.js";

/**
 * Bootstrap for the standalone pages.
 *
 * They need nothing but the theme switch, and they reuse the app's
 * ThemeManager so the choice made here is the choice the app opens
 * with — one key in storage, one behaviour.
 */
new ThemeManager().init();
