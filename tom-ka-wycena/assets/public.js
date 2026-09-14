/* =========================================================================
   TOM-KA WYCENA — Tryb A (publiczny kalkulator, kreator krok po kroku)
   NIE pokazuje stawek jednostkowych — tylko widełki orientacyjne.
   ========================================================================= */
(function () {
  "use strict";
  var T = window.TOMKA;
  var cennik = T.getCennik();

  var TYPY = [
    { id: "wielorodzinny", nazwa: "Budynek wielorodzinny" },
    { id: "biurowy", nazwa: "Budynek biurowy" },
    { id: "handlowy", nazwa: "Obiekt handlowy" },
    { id: "przemyslowy", nazwa: "Przemysłowo-magazynowy" },
    { id: "uzytecznosci", nazwa: "Użyteczności publicznej" },
    { id: "inny", nazwa: "Inny" }
  ];

  var state = {
    krok: 0,
    typ: null,
    obiekt: { liczba_lokali: "", liczba_kondygnacji: "", liczba_klatek: "", powierzchnia_m2: "", miejscowosc: "", adres: "" },
    wybrane: [],                 // id usług
    szczegoly: {},               // id -> { ilosc, pola:{} }
    termin: "standard",
    weekend: false,
    wysokosc: false,
    strefa_id: "I",
    kontakt: { nazwa: "", email: "", telefon: "", uwagi: "", zgoda: false }
  };

  var LICZBA_KROKOW = 7;
  var TYTULY = [
    "Typ obiektu", "Podstawowe parametry", "Zakres prac",
    "Parametry szczegółowe", "Termin i dojazd", "Wynik", "Wyślij zapytanie"
  ];

  var elContent = document.getElementById("step-content");
  var elActions = document.getElementById("step-actions");
  document.getElementById("brand").innerHTML =
    T.logoSVG(34) + '<span><span class="brand-name">TOM-KA</span><br><span class="brand-sub">Instalacje sanitarne</span></span>';

  /* ---------- pomocnicze ---------- */
  function uslugiPriced() { return cennik.uslugi.filter(function (u) { return !u.indywidualna; }); }
  function usluga(id) { return T.getUsluga(cennik, id); }
  function wybranePriced() { return state.wybrane.filter(function (id) { var u = usluga(id); return u && !u.indywidualna; }); }
  function wybraneIndywidualne() { return state.wybrane.filter(function (id) { var u = usluga(id); return u && u.indywidualna; }); }

  function progress() {
    var pct = Math.round(((state.krok + 1) / LICZBA_KROKOW) * 100);
    document.getElementById("progress-bar").style.width = pct + "%";
    document.getElementById("progress-label").textContent = "Krok " + (state.krok + 1) + " z " + LICZBA_KROKOW + " · " + TYTULY[state.krok];
  }

  function checkIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12l6 6L20 6"/></svg>'; }

  /* ---------- renderowanie kroków ---------- */
  function render() {
    progress();
    switch (state.krok) {
      case 0: renderTyp(); break;
      case 1: renderParametry(); break;
      case 2: renderZakres(); break;
      case 3: renderSzczegoly(); break;
      case 4: renderTermin(); break;
      case 5: renderWynik(); break;
      case 6: renderFormularz(); break;
    }
    window.scrollTo(0, 0);
  }

  function renderTyp() {
    var html = '<h1>Jaki to obiekt?</h1><p class="muted">Wybierz typ nieruchomości, której dotyczy wycena.</p>';
    html += '<div class="choices mt">';
    TYPY.forEach(function (t) {
      var sel = state.typ === t.id ? " selected" : "";
      html += '<button type="button" class="choice radio' + sel + '" data-typ="' + t.id + '">' +
        '<span class="ck">' + checkIcon() + '</span><span><span class="ttl">' + T.esc(t.nazwa) + '</span></span></button>';
    });
    html += '</div>';
    elContent.innerHTML = html;
    elContent.querySelectorAll("[data-typ]").forEach(function (b) {
      b.addEventListener("click", function () { state.typ = b.getAttribute("data-typ"); render(); });
    });
    nav({ back: false, nextDisabled: !state.typ });
  }

  function renderParametry() {
    var o = state.obiekt;
    var html = '<h1>Podstawowe parametry</h1><p class="muted">Wypełnij, co pasuje do obiektu — pola nieobowiązkowe zostaw puste.</p>';
    html += '<div class="grid2 mt">';
    html += fieldNum("liczba_lokali", "Liczba lokali", o.liczba_lokali);
    html += fieldNum("liczba_kondygnacji", "Liczba kondygnacji", o.liczba_kondygnacji);
    html += fieldNum("liczba_klatek", "Liczba klatek / pionów", o.liczba_klatek);
    html += fieldNum("powierzchnia_m2", "Powierzchnia [m²]", o.powierzchnia_m2);
    html += '</div>';
    html += '<label class="field"><span class="lbl">Miejscowość</span>' +
      '<input type="text" id="f_miejscowosc" value="' + T.esc(o.miejscowosc) + '" placeholder="np. Środa Wielkopolska"></label>';
    html += '<label class="field"><span class="lbl">Adres <span class="hint">(nieobowiązkowo)</span></span>' +
      '<input type="text" id="f_adres" value="' + T.esc(o.adres) + '"></label>';
    elContent.innerHTML = html;

    bindNum("liczba_lokali"); bindNum("liczba_kondygnacji"); bindNum("liczba_klatek"); bindNum("powierzchnia_m2");
    document.getElementById("f_miejscowosc").addEventListener("input", function (e) { o.miejscowosc = e.target.value; });
    document.getElementById("f_adres").addEventListener("input", function (e) { o.adres = e.target.value; });
    nav({ back: true, nextDisabled: false });
  }

  function fieldNum(key, label, val) {
    return '<label class="field"><span class="lbl">' + label + '</span>' +
      '<input type="number" min="0" id="f_' + key + '" value="' + T.esc(val) + '" inputmode="numeric"></label>';
  }
  function bindNum(key) {
    var el = document.getElementById("f_" + key);
    el.addEventListener("input", function (e) { state.obiekt[key] = e.target.value; });
  }

  function renderZakres() {
    var html = '<h1>Zakres prac</h1><p class="muted">Zaznacz usługi, które Cię interesują. Możesz wybrać kilka.</p>';
    cennik.kategorie.forEach(function (kat) {
      var uslugiKat = cennik.uslugi.filter(function (u) { return u.kategoria === kat.id; });
      if (!uslugiKat.length) return;
      html += '<h3 class="mt" style="font-size:15px">' + T.esc(kat.nazwa) + '</h3>';
      html += '<div class="choices">';
      uslugiKat.forEach(function (u) {
        var sel = state.wybrane.indexOf(u.id) >= 0 ? " selected" : "";
        var meta = [];
        if (u.czestotliwosc && u.czestotliwosc !== "—") meta.push(u.czestotliwosc);
        if (u.podstawa) meta.push(u.podstawa);
        if (u.indywidualna) meta.push("wycena indywidualna");
        html += '<button type="button" class="choice' + sel + '" data-usluga="' + u.id + '">' +
          '<span class="ck">' + checkIcon() + '</span>' +
          '<span><span class="ttl">' + T.esc(u.nazwa) + '</span>' +
          '<span class="desc">' + T.esc(u.opis_krotki) + '</span>' +
          (meta.length ? '<span class="meta">' + T.esc(meta.join(" · ")) + '</span>' : '') +
          '</span></button>';
      });
      html += '</div>';
    });
    elContent.innerHTML = html;
    elContent.querySelectorAll("[data-usluga]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-usluga");
        var i = state.wybrane.indexOf(id);
        if (i >= 0) { state.wybrane.splice(i, 1); delete state.szczegoly[id]; }
        else { state.wybrane.push(id); ensureSzczegoly(id); }
        b.classList.toggle("selected");
        setNextDisabled(state.wybrane.length === 0);
      });
    });
    nav({ back: true, nextDisabled: state.wybrane.length === 0 });
  }

  function ensureSzczegoly(id) {
    if (state.szczegoly[id]) return;
    var u = usluga(id);
    var domyslnaIlosc = "";
    if (u.ilosc) {
      domyslnaIlosc = u.ilosc.domyslnie != null ? u.ilosc.domyslnie : 1;
      if (u.ilosc.prefill && state.obiekt[u.ilosc.prefill]) domyslnaIlosc = state.obiekt[u.ilosc.prefill];
    }
    state.szczegoly[id] = { ilosc: domyslnaIlosc, pola: {} };
  }

  function renderSzczegoly() {
    // odśwież ilości z prefill (użytkownik mógł zmienić parametry bazowe)
    state.wybrane.forEach(ensureSzczegoly);
    var priced = wybranePriced();
    var indiv = wybraneIndywidualne();

    var html = '<h1>Parametry szczegółowe</h1>';
    if (!priced.length && !indiv.length) {
      html += '<p class="muted">Brak wybranych usług.</p>';
      elContent.innerHTML = html;
      nav({ back: true, nextDisabled: true });
      return;
    }
    html += '<p class="muted">Podaj ilości, żebyśmy mogli oszacować cenę.</p>';

    priced.forEach(function (id) {
      var u = usluga(id), s = state.szczegoly[id];
      html += '<div class="card mt" style="box-shadow:none">';
      html += '<div style="font-weight:700">' + T.esc(u.nazwa) + '</div>';
      if (u.ilosc) {
        html += '<label class="field"><span class="lbl">' + T.esc(u.ilosc.etykieta) + '</span>' +
          '<input type="number" min="0" data-il="' + id + '" value="' + T.esc(s.ilosc) + '" inputmode="numeric"></label>';
      }
      (u.pola_dodatkowe || []).forEach(function (p) { html += poleDodatkowe(id, p, s.pola[p.id]); });
      html += '</div>';
    });

    if (indiv.length) {
      html += '<div class="alert alert-info mt">Wybrane pozycje (';
      html += indiv.map(function (id) { return T.esc(usluga(id).nazwa); }).join(", ");
      html += ') wyceniamy indywidualnie po oględzinach — poprosimy o kilka szczegółów w formularzu.';
      indiv.forEach(function (id) {
        var u = usluga(id), s = state.szczegoly[id];
        (u.pola_dodatkowe || []).forEach(function (p) { html += poleDodatkowe(id, p, s.pola[p.id]); });
      });
      html += '</div>';
    }
    elContent.innerHTML = html;

    elContent.querySelectorAll("[data-il]").forEach(function (el) {
      el.addEventListener("input", function (e) { state.szczegoly[el.getAttribute("data-il")].ilosc = e.target.value; });
    });
    elContent.querySelectorAll("[data-pole]").forEach(function (el) {
      el.addEventListener("input", function () {
        var id = el.getAttribute("data-usluga-id"), pid = el.getAttribute("data-pole");
        state.szczegoly[id].pola[pid] = el.value;
      });
    });
    nav({ back: true, nextDisabled: false });
  }

  function poleDodatkowe(uslugaId, p, val) {
    val = val == null ? "" : val;
    var common = 'data-usluga-id="' + uslugaId + '" data-pole="' + p.id + '"';
    var input;
    if (p.typ === "select") {
      input = '<select ' + common + '><option value="">— wybierz —</option>' +
        p.opcje.map(function (o) { return '<option' + (o === val ? " selected" : "") + '>' + T.esc(o) + '</option>'; }).join("") +
        '</select>';
    } else if (p.typ === "textarea") {
      input = '<textarea ' + common + '>' + T.esc(val) + '</textarea>';
    } else {
      input = '<input type="' + (p.typ === "number" ? "number" : "text") + '" ' + common + ' value="' + T.esc(val) + '">';
    }
    return '<label class="field"><span class="lbl">' + T.esc(p.etykieta) + '</span>' + input + '</label>';
  }

  function renderTermin() {
    var html = '<h1>Termin i dojazd</h1>';
    html += '<h3 class="mt" style="font-size:15px">Termin realizacji</h3>';
    html += '<div class="choices">';
    [{ id: "standard", nazwa: "Standardowy", desc: "Realizacja w zwykłym trybie." },
     { id: "ekspres", nazwa: "Pilny (ekspres)", desc: "Szybsza realizacja — z dopłatą." }].forEach(function (t) {
      var sel = state.termin === t.id ? " selected" : "";
      html += '<button type="button" class="choice radio' + sel + '" data-termin="' + t.id + '">' +
        '<span class="ck">' + checkIcon() + '</span><span><span class="ttl">' + t.nazwa + '</span><span class="desc">' + t.desc + '</span></span></button>';
    });
    html += '</div>';

    html += '<h3 class="mt" style="font-size:15px">Dodatkowe warunki</h3><div class="row-inline">';
    html += '<button type="button" class="pill-toggle' + (state.weekend ? " on" : "") + '" id="tg_weekend">Realizacja w weekend / poza godzinami</button>';
    html += '<button type="button" class="pill-toggle' + (state.wysokosc ? " on" : "") + '" id="tg_wysokosc">Praca na wysokości / na dachu</button>';
    html += '</div>';

    html += '<h3 class="mt" style="font-size:15px">Strefa dojazdu</h3>';
    html += '<p class="small muted">Liczona od bazy w Żerkowie / Środzie Wielkopolskiej.</p>';
    html += '<div class="choices">';
    cennik.strefy_dojazdu.forEach(function (s) {
      var sel = state.strefa_id === s.id ? " selected" : "";
      html += '<button type="button" class="choice radio' + sel + '" data-strefa="' + s.id + '">' +
        '<span class="ck">' + checkIcon() + '</span><span><span class="ttl">' + T.esc(s.nazwa) + '</span></span></button>';
    });
    html += '</div>';
    elContent.innerHTML = html;

    elContent.querySelectorAll("[data-termin]").forEach(function (b) {
      b.addEventListener("click", function () { state.termin = b.getAttribute("data-termin"); render(); });
    });
    elContent.querySelectorAll("[data-strefa]").forEach(function (b) {
      b.addEventListener("click", function () { state.strefa_id = b.getAttribute("data-strefa"); render(); });
    });
    document.getElementById("tg_weekend").addEventListener("click", function () { state.weekend = !state.weekend; render(); });
    document.getElementById("tg_wysokosc").addEventListener("click", function () { state.wysokosc = !state.wysokosc; render(); });
    nav({ back: true, nextDisabled: false });
  }

  /* ---------- obliczenie wyceny (na podstawie stanu) ---------- */
  function zbudujPozycje() {
    return wybranePriced().map(function (id) {
      var u = usluga(id), s = state.szczegoly[id];
      return {
        usluga_id: id, nazwa: u.nazwa, jednostka: u.jednostka,
        ilosc: s && s.ilosc !== "" ? Number(s.ilosc) : (u.ilosc ? (u.ilosc.domyslnie || 1) : 1),
        stawka_jednostkowa: u.stawka_domyslna, minimum_pozycji: u.minimum_pozycji,
        przyklad: !!u.przyklad
      };
    });
  }

  function policz() {
    var pozycje = zbudujPozycje();
    var rabat = T.rabatPakietowyProcent(new Set(wybranePriced()), cennik); // auto rabat pakietowy
    var mod = { ekspres: state.termin === "ekspres", weekend: state.weekend, wysokosc: state.wysokosc, strefa_id: state.strefa_id };
    var wynik = T.obliczWycene(pozycje, mod, rabat, cennik);
    wynik.rabat_pakietowy = rabat;
    return wynik;
  }

  function renderWynik() {
    var priced = wybranePriced();
    var indiv = wybraneIndywidualne();
    var html = '<h1>Twoja orientacyjna wycena</h1>';

    // brak stawek (wszystko = 0) => komunikat do uzupełnienia
    var wynik = priced.length ? policz() : null;
    var brakStawek = wynik && wynik.netto === 0 && priced.some(function (id) {
      var u = usluga(id); return (!u.stawka_domyslna && !u.minimum_pozycji);
    });

    if (!priced.length && indiv.length) {
      html += '<div class="alert alert-info">Wybrane usługi wyceniamy indywidualnie po oględzinach obiektu. Zostaw kontakt — przygotujemy wiążącą ofertę.</div>';
    } else if (brakStawek) {
      html += '<div class="alert alert-warn"><strong>Stawka do uzupełnienia.</strong> Dla wybranych usług nie ustalono jeszcze cennika, dlatego nie pokazujemy kwoty. Zostaw kontakt — wyślemy indywidualną wycenę.</div>';
    } else if (wynik) {
      var w = T.widelki(wynik.netto, cennik.meta.widelki_procent);
      html += '<div class="result-price">ok. ' + T.fmtPLN(w.dol) + ' – ' + T.fmtPLN(w.gora) + '</div>';
      html += '<p class="result-note">netto · wartość orientacyjna</p>';
      if (wynik.rabat_pakietowy > 0) {
        html += '<p class="center small" style="color:var(--ok)">Uwzględniono rabat pakietowy ' + T.fmtProc(wynik.rabat_pakietowy) + ' (≥ 3 usługi).</p>';
      }
      if (T.czyPrzykladowe(cennik)) {
        html += '<div class="alert alert-warn"><strong>Uwaga:</strong> w kalkulatorze ustawiono stawki przykładowe (do podmiany przez TOM-KA). Ostateczna cena po potwierdzeniu.</div>';
      }
    }

    // Co zawiera wycena
    html += '<div class="card mt" style="box-shadow:none"><strong>Co zawiera ta wycena</strong><ul class="mt" style="margin:8px 0 0;padding-left:18px">';
    state.wybrane.forEach(function (id) {
      var u = usluga(id);
      html += '<li>' + T.esc(u.nazwa) + (u.podstawa ? ' <span class="muted small">(' + T.esc(u.podstawa) + ')</span>' : '') + '</li>';
    });
    html += '</ul>';
    html += '<p class="small muted mt">Realizację potwierdzamy protokołem; przekazujemy dokumentację i zalecenia.</p></div>';

    // Obowiązkowy disclaimer
    html += '<div class="alert alert-info mt"><em>Wycena orientacyjna, nie stanowi oferty w rozumieniu Kodeksu cywilnego. ' +
      'Ostateczna cena po potwierdzeniu zakresu i oględzinach obiektu.</em></div>';

    elContent.innerHTML = html;
    nav({ back: true, nextLabel: "Wyślij zapytanie i otrzymaj wiążącą ofertę →", nextDisabled: false });
  }

  function renderFormularz() {
    var k = state.kontakt;
    var polityka = cennik.meta.polityka_prywatnosci_url || "#";
    var html = '<h1>Wyślij zapytanie</h1><p class="muted">Odezwiemy się z wiążącą ofertą. Bez zakładania konta.</p>';
    html += '<label class="field"><span class="lbl">Imię i nazwisko / firma *</span><input type="text" id="k_nazwa" value="' + T.esc(k.nazwa) + '"></label>';
    html += '<div class="grid2">';
    html += '<label class="field"><span class="lbl">E-mail *</span><input type="email" id="k_email" value="' + T.esc(k.email) + '"></label>';
    html += '<label class="field"><span class="lbl">Telefon</span><input type="tel" id="k_tel" value="' + T.esc(k.telefon) + '"></label>';
    html += '</div>';
    html += '<label class="field"><span class="lbl">Uwagi</span><textarea id="k_uwagi">' + T.esc(k.uwagi) + '</textarea></label>';
    html += '<label class="field row-inline" style="align-items:flex-start;gap:8px;cursor:pointer">' +
      '<input type="checkbox" id="k_zgoda" ' + (k.zgoda ? "checked" : "") + ' style="width:auto;margin-top:3px">' +
      '<span class="small">Wyrażam zgodę na przetwarzanie moich danych osobowych w celu przygotowania i przedstawienia oferty. ' +
      'Zapoznałem/am się z <a href="' + T.esc(polityka) + '" target="_blank" rel="noopener">polityką prywatności</a>. *</span></label>';
    html += '<div id="form-msg"></div>';
    elContent.innerHTML = html;

    document.getElementById("k_nazwa").addEventListener("input", function (e) { k.nazwa = e.target.value; });
    document.getElementById("k_email").addEventListener("input", function (e) { k.email = e.target.value; });
    document.getElementById("k_tel").addEventListener("input", function (e) { k.telefon = e.target.value; });
    document.getElementById("k_uwagi").addEventListener("input", function (e) { k.uwagi = e.target.value; });
    document.getElementById("k_zgoda").addEventListener("change", function (e) { k.zgoda = e.target.checked; });

    nav({ back: true, nextLabel: "Wyślij zapytanie", nextIsSubmit: true, nextDisabled: false });
  }

  /* ---------- wysyłka zapytania ---------- */
  function wyslij() {
    var k = state.kontakt, msg = document.getElementById("form-msg");
    if (!k.nazwa || !k.email) { msg.innerHTML = '<div class="alert alert-warn">Podaj imię/firmę oraz e-mail.</div>'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k.email)) { msg.innerHTML = '<div class="alert alert-warn">Podaj poprawny adres e-mail.</div>'; return; }
    if (!k.zgoda) { msg.innerHTML = '<div class="alert alert-warn">Wymagana jest zgoda na przetwarzanie danych (RODO).</div>'; return; }

    var tekst = zbudujTrescZapytania();
    var endpoint = cennik.meta.formspree_endpoint;
    if (endpoint) {
      fetch(endpoint, {
        method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ nazwa: k.nazwa, email: k.email, telefon: k.telefon, uwagi: k.uwagi, tresc: tekst })
      }).then(function (r) {
        if (r.ok) sukces(); else fallbackMailto(tekst);
      }).catch(function () { fallbackMailto(tekst); });
    } else {
      fallbackMailto(tekst);
    }
  }

  function fallbackMailto(tekst) {
    var adres = cennik.meta.email_firmowy || "";
    var temat = "Zapytanie o wycenę — " + (state.kontakt.nazwa || "obiekt");
    window.location.href = "mailto:" + encodeURIComponent(adres) +
      "?subject=" + encodeURIComponent(temat) + "&body=" + encodeURIComponent(tekst);
    sukces();
  }

  function sukces() {
    progress();
    elContent.innerHTML = '<div class="center"><h1>Dziękujemy!</h1>' +
      '<p class="muted">Twoje zapytanie zostało przygotowane do wysłania. Jeśli nie otworzył się program pocztowy, ' +
      'napisz do nas na <a href="mailto:' + T.esc(cennik.meta.email_firmowy) + '">' + T.esc(cennik.meta.email_firmowy) + '</a> ' +
      'lub zadzwoń: <strong>' + T.esc(cennik.firma.telefon) + '</strong>.</p>' +
      '<p class="mt"><a class="btn btn-ghost" href="index.html">Nowa wycena</a></p></div>';
    elActions.innerHTML = "";
  }

  function zbudujTrescZapytania() {
    var L = [];
    L.push("ZAPYTANIE O WYCENĘ — kalkulator TOM-KA");
    L.push("Data: " + T.dzisPL());
    L.push("");
    L.push("== KONTAKT ==");
    L.push("Imię/firma: " + state.kontakt.nazwa);
    L.push("E-mail: " + state.kontakt.email);
    L.push("Telefon: " + (state.kontakt.telefon || "—"));
    if (state.kontakt.uwagi) L.push("Uwagi: " + state.kontakt.uwagi);
    L.push("");
    L.push("== OBIEKT ==");
    L.push("Typ: " + typNazwa(state.typ));
    var o = state.obiekt;
    if (o.miejscowosc) L.push("Miejscowość: " + o.miejscowosc);
    if (o.adres) L.push("Adres: " + o.adres);
    if (o.liczba_lokali) L.push("Liczba lokali: " + o.liczba_lokali);
    if (o.liczba_kondygnacji) L.push("Liczba kondygnacji: " + o.liczba_kondygnacji);
    if (o.liczba_klatek) L.push("Liczba klatek/pionów: " + o.liczba_klatek);
    if (o.powierzchnia_m2) L.push("Powierzchnia [m²]: " + o.powierzchnia_m2);
    L.push("");
    L.push("== ZAKRES PRAC ==");
    state.wybrane.forEach(function (id) {
      var u = usluga(id), s = state.szczegoly[id] || { pola: {} };
      var linia = "- " + u.nazwa;
      if (u.ilosc && s.ilosc !== "") linia += " (" + s.ilosc + " " + u.jednostka + ")";
      if (u.indywidualna) linia += " [wycena indywidualna]";
      L.push(linia);
      Object.keys(s.pola || {}).forEach(function (pid) {
        if (s.pola[pid]) { var pd = (u.pola_dodatkowe || []).filter(function (p) { return p.id === pid; })[0]; L.push("    · " + (pd ? pd.etykieta : pid) + ": " + s.pola[pid]); }
      });
    });
    L.push("");
    L.push("== WARUNKI ==");
    L.push("Termin: " + (state.termin === "ekspres" ? "pilny (ekspres)" : "standardowy"));
    if (state.weekend) L.push("Weekend / poza godzinami: tak");
    if (state.wysokosc) L.push("Praca na wysokości: tak");
    var strefa = cennik.strefy_dojazdu.filter(function (s) { return s.id === state.strefa_id; })[0];
    L.push("Strefa dojazdu: " + (strefa ? strefa.nazwa : state.strefa_id));
    L.push("");
    var priced = wybranePriced();
    if (priced.length) {
      var wynik = policz();
      var w = T.widelki(wynik.netto, cennik.meta.widelki_procent);
      L.push("== ORIENTACYJNA WYCENA (widełki, netto) ==");
      L.push("ok. " + T.fmtPLN(w.dol) + " – " + T.fmtPLN(w.gora));
      if (T.czyPrzykladowe(cennik)) L.push("(uwaga: kalkulator używa stawek przykładowych — do potwierdzenia)");
    }
    L.push("");
    L.push("Wycena orientacyjna, nie stanowi oferty w rozumieniu Kodeksu cywilnego.");
    return L.join("\n");
  }

  function typNazwa(id) { var t = TYPY.filter(function (x) { return x.id === id; })[0]; return t ? t.nazwa : (id || "—"); }

  /* ---------- nawigacja ---------- */
  function nav(opts) {
    opts = opts || {};
    var html = "";
    if (opts.back) html += '<button type="button" class="btn btn-ghost" id="btn-back">← Wstecz</button>';
    html += '<span class="spacer"></span>';
    var label = opts.nextLabel || "Dalej →";
    html += '<button type="button" class="btn btn-primary" id="btn-next"' + (opts.nextDisabled ? " disabled" : "") + '>' + label + '</button>';
    elActions.innerHTML = html;
    var back = document.getElementById("btn-back");
    if (back) back.addEventListener("click", wstecz);
    document.getElementById("btn-next").addEventListener("click", function () {
      if (opts.nextIsSubmit) wyslij(); else dalej();
    });
  }
  function setNextDisabled(v) { var b = document.getElementById("btn-next"); if (b) b.disabled = v; }

  function dalej() {
    // pomiń krok szczegółów, jeśli żadna usługa nie ma pól/ilości do podania
    if (state.krok === 2) {
      var potrzebneSzczegoly = state.wybrane.some(function (id) {
        var u = usluga(id); return (u.ilosc) || (u.pola_dodatkowe && u.pola_dodatkowe.length);
      });
      if (!potrzebneSzczegoly) { state.krok = 4; render(); return; }
    }
    if (state.krok < LICZBA_KROKOW - 1) { state.krok++; render(); }
  }
  function wstecz() {
    if (state.krok === 4) {
      var potrzebneSzczegoly = state.wybrane.some(function (id) {
        var u = usluga(id); return (u.ilosc) || (u.pola_dodatkowe && u.pola_dodatkowe.length);
      });
      if (!potrzebneSzczegoly) { state.krok = 2; render(); return; }
    }
    if (state.krok > 0) { state.krok--; render(); }
  }

  render();
})();
