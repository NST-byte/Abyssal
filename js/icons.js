/* Selbst gezeichnete SVG-Icons (keine externen Assets) */
(function (AB) {
  'use strict';
  const P = {
    lumen: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".75"><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2M5.3 5.3l2.2 2.2M16.5 16.5l2.2 2.2M5.3 18.7l2.2-2.2M16.5 7.5l2.2-2.2"/></g>',
    mangan: '<path d="M12 3.2l7.4 4.3v9L12 20.8l-7.4-4.3v-9z" fill="currentColor" opacity=".9"/><path d="M12 3.2v8.6l7.4 4.3M12 11.8l-7.4 4.3" stroke="#0b1622" stroke-width="1.2" fill="none" opacity=".55"/>',
    data: '<circle cx="12" cy="17" r="2" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8.3 13.4a5.2 5.2 0 0 1 7.4 0"/><path d="M5.4 10.5a9.3 9.3 0 0 1 13.2 0" opacity=".75"/><path d="M2.6 7.6a13.3 13.3 0 0 1 18.8 0" opacity=".5"/></g>',
    perlen: '<circle cx="12" cy="12" r="7.5" fill="currentColor"/><circle cx="9.3" cy="9.2" r="2.4" fill="#fff" opacity=".7"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" stroke-opacity=".35"/>',
    plankton: '<g fill="currentColor"><circle cx="7" cy="8" r="2.2"/><circle cx="15.5" cy="6.5" r="1.6"/><circle cx="12" cy="13" r="2.6"/><circle cx="6.5" cy="16.5" r="1.4"/><circle cx="17.5" cy="15" r="2"/><circle cx="11" cy="19.5" r="1.1"/></g>',
    algae: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 21c-2-4 2-6 0-10s1-6 1-8"/><path d="M12.5 21c-2-4 2-7 0-11s1.5-5 1.5-7"/><path d="M18 21c-1.6-3 1.8-5 0-8s.8-4 .8-5"/></g>',
    jelly: '<path d="M4.5 11a7.5 7.5 0 0 1 15 0c0 1-1 1.4-2 1.4H6.5c-1 0-2-.4-2-1.4z" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".8"><path d="M7.5 13c-.6 3 1 4.5 0 8"/><path d="M11 13c.6 3-1 4.5 0 8"/><path d="M14 13c-.6 3 1 4.5 0 8"/><path d="M17 13c.5 2.5-.8 3.8 0 6"/></g>',
    angler: '<path d="M3 13.5c2.5-4.5 8-6 12.5-4 2 .9 3.3 2.3 4.5 4-1.2 1.7-2.5 3.1-4.5 4-4.5 2-10-.5-12.5-4z" fill="currentColor"/><path d="M9 9.3C8 5.5 11 3 14.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="15.5" cy="3.8" r="1.9" fill="#fff8c6"/><circle cx="16.2" cy="12.6" r="1.1" fill="#0b1622"/><path d="M20 13.5l2-3v6z" fill="currentColor"/>',
    vent: '<path d="M8 21l1.5-9h5L16 21z" fill="currentColor"/><path d="M9 12c-1-3 2-3.5 1-6.5M12 12c1-3-1.6-4 0-7.5M15 12c1-2.6-1.4-3.3-.2-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    coral: '<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8M12 13l-4-4V5M12 13l4-3V5.5M8 9L5 7.5M16 10l3-1.5M12 17l-3.5-2.5M12 16l3-2"/></g><g fill="currentColor"><circle cx="8" cy="4.5" r="1.4"/><circle cx="16" cy="5" r="1.4"/><circle cx="4.6" cy="7.2" r="1.1"/><circle cx="19.4" cy="8.2" r="1.1"/></g>',
    leviathan: '<path d="M2 13c3-5 9-6.5 14-4.5 2.5 1 4 2.6 5.5 4.5-2 .2-3.6 1.2-5 2.5-4 3.2-10 2.8-14.5-2.5z" fill="currentColor"/><path d="M16 15.5l4 4.5M15 16l1 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17.3" cy="11.6" r="1" fill="#0b1622"/><g stroke="currentColor" fill="none" opacity=".55" stroke-width="1.2"><path d="M5 7.5c2-1.6 4-2 6-2"/><path d="M3.5 5c3-2 6-2.6 9-2.4"/></g>',
    heart: '<path d="M12 20.5S3.5 15 3.5 9.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 8.5 1.8C20.5 15 12 20.5 12 20.5z" fill="currentColor"/><path d="M7 11.5h2.6l1.4-2.5 2 5 1.4-2.5H17" fill="none" stroke="#0b1622" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>',
    drone: '<rect x="7" y="9" width="10" height="6" rx="3" fill="currentColor"/><path d="M4 8h5M15 8h5M6.5 8v1.5M17.5 8v1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9.5 15l-1.5 4M14.5 15l1.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="1.3" fill="#0b1622"/>',
    drill: '<rect x="8" y="2.5" width="8" height="6" rx="1.5" fill="currentColor"/><path d="M9 8.5h6l-3 13z" fill="currentColor" opacity=".85"/><path d="M9.6 11.5h4.8M10.3 14.5h3.4M11 17.5h2" stroke="#0b1622" stroke-width="1.2" opacity=".6"/>',
    sonar: '<path d="M12 10v11M8.5 21h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="2.6" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".7"><path d="M7.5 4.5a6 6 0 0 0 0 7M16.5 4.5a6 6 0 0 1 0 7"/><path d="M4.7 2.5a9.5 9.5 0 0 0 0 11M19.3 2.5a9.5 9.5 0 0 1 0 11" opacity=".6"/></g>',
    gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 4.6l1.6 1.2-1.8 3.2-1.9-.7a7.6 7.6 0 0 1-1.6.9l-.3 2H12.4l-.3-2a7.6 7.6 0 0 1-1.6-.9l-1.9.7-1.8-3.2 1.6-1.2a7 7 0 0 1 0-1.8L6.8 9.9l1.8-3.2 1.9.7c.5-.4 1-.7 1.6-.9l.3-2h3.6l.3 2c.6.2 1.1.5 1.6.9l1.9-.7 1.8 3.2-1.6 1.2a7 7 0 0 1 0 1.8z" fill="currentColor" transform="translate(-2.4 -.2)"/>',
    save: '<path d="M5 3.5h11l3.5 3.5v13.5H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="8" y="3.5" width="7" height="5" fill="currentColor" opacity=".7"/><rect x="8" y="13" width="8" height="5.5" rx="1" fill="currentColor"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="10" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/>',
    bolt: '<path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z" fill="currentColor"/>',
    compass: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/>',
    crystal: '<path d="M12 2.5l5 6-5 13-5-13z" fill="currentColor"/><path d="M7 8.5h10M12 2.5v19" stroke="#0b1622" stroke-width="1" opacity=".4"/>',
    skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.5V19h9v-3c1.7-1.1 3-2.9 3-5.5A7.5 7.5 0 0 0 12 3z" fill="currentColor"/><circle cx="9" cy="11" r="1.8" fill="#0b1622"/><circle cx="15" cy="11" r="1.8" fill="#0b1622"/><path d="M10 19v2M12 19v2M14 19v2" stroke="currentColor" stroke-width="1.4"/>',
    flask: '<path d="M9.5 3h5M10.5 3v6L5 19.5A1.4 1.4 0 0 0 6.2 21.5h11.6a1.4 1.4 0 0 0 1.2-2L13.5 9V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.5 15.5h9l2 4.2H5.6z" fill="currentColor"/>',
    wave: '<path d="M2 9c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 3.5-2 5-1M2 15c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 3.5-2 5-1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    book: '<path d="M4 4.5h6.5A2.5 2.5 0 0 1 13 7v13.5a2 2 0 0 0-2-2H4zM20 4.5h-4.5A2.5 2.5 0 0 0 13 7v13.5a2 2 0 0 1 2-2h5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    down: '<path d="M12 3v15M6 12.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    shield: '<path d="M12 2.8l7.5 3v6c0 4.6-3.2 8-7.5 9.4C7.7 19.8 4.5 16.4 4.5 11.8v-6z" fill="currentColor"/><path d="M8.5 12l2.4 2.4 4.6-4.8" fill="none" stroke="#0b1622" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor"/>',
  };

  AB.icon = function (name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || P.lumen) + '</svg>';
  };
  AB.ICON_PATHS = P;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
