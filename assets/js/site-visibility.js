// site-visibility.js
// Maintenance mode and per-page access restrictions are permanently disabled.
// All pages are public and fully interactive for authenticated users.
(function(){
  'use strict';

  // Global flags kept for backwards compatibility.
  window.MAINTENANCE_MODE = false;
  window.SITE_VISIBILITY_DISABLED = true;
  window.ACCESS_RESTRICTIONS_ENABLED = false;

  const MAINTENANCE_MODE = false;
  const ACCESS_RESTRICTIONS_ENABLED = false;

  function removeMaintenanceOverlay() {
    const el = document.getElementById('siteMaintenanceOverlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // Remove any overlay left behind by a previous session/cached script.
  removeMaintenanceOverlay();

  console.log('[site-visibility] maintenance mode disabled - all pages open');

  // Expose a no-op in case legacy code calls it.
  window.showMaintenanceOverlay = function(){ /* disabled by design */ };

  if (!ACCESS_RESTRICTIONS_ENABLED && MAINTENANCE_MODE === false) {
    document.addEventListener('DOMContentLoaded', removeMaintenanceOverlay);
    window.addEventListener('load', removeMaintenanceOverlay);
  }
})();
