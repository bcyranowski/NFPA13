/* =========================================================================
   TOM-KA WYCENA — wspólne pomocniki (logo, escape, mailto)
   ========================================================================= */
(function () {
  "use strict";

  /* Logo zastępcze (symbol wentylatora + skrót). PODMIEŃ na dostarczony PNG:
     wystarczy podać <img src="assets/logo-tomka.png" ...> zamiast tego SVG,
     albo wskazać ścieżkę w funkcji logoImg().                                */
  function logoSVG(size) {
    size = size || 34;
    return '' +
      '<svg class="logo-mark" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" ' +
      'role="img" aria-label="Logo TOM-KA" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="32" cy="32" r="30" fill="#fff" stroke="#2452D0" stroke-width="3"/>' +
      '<g fill="#0C2E86">' +
      '<circle cx="32" cy="32" r="4.5"/>' +
      '<path d="M32 30c-1 -10 3 -17 9 -18 3 5 1 13 -6 17z"/>' +
      '<path d="M34 32c10 -1 17 3 18 9 -5 3 -13 1 -17 -6z"/>' +
      '<path d="M32 34c1 10 -3 17 -9 18 -3 -5 -1 -13 6 -17z"/>' +
      '<path d="M30 32c-10 1 -17 -3 -18 -9 5 -3 13 -1 17 6z"/>' +
      '</g></svg>';
  }

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function nowISO() { return new Date().toISOString(); }
  function dzisPL() {
    var d = new Date();
    return String(d.getDate()).padStart(2, "0") + "." +
           String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
  }
  function dataPL(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return String(d.getDate()).padStart(2, "0") + "." +
           String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
  }
  function dataZaDni(dni) {
    var d = new Date(); d.setDate(d.getDate() + (Number(dni) || 0));
    return dataPL(d.toISOString());
  }

  window.TOMKA = window.TOMKA || {};
  Object.assign(window.TOMKA, {
    logoSVG: logoSVG, esc: esc, nowISO: nowISO, dzisPL: dzisPL, dataPL: dataPL, dataZaDni: dataZaDni
  });
})();
