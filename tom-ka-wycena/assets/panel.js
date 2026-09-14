/* =========================================================================
   TOM-KA WYCENA — Tryb B (panel wewnętrzny)
   Lista wycen · edytor · generator oferty PDF · edycja cennika.
   Dane trzymane w localStorage (MVP, jedno urządzenie).
   ========================================================================= */
(function () {
  "use strict";
  var T = window.TOMKA;

  /* ------------------------------------------------------------------ *
   *  KONFIGURACJA DOSTĘPU (prosty PIN po stronie klienta)
   *  UWAGA: to NIE jest realne zabezpieczenie — chroni jedynie przed
   *  przypadkowym wejściem. Zmień PIN poniżej. Do prawdziwej ochrony
   *  potrzebny byłby backend (poza zakresem MVP).
   * ------------------------------------------------------------------ */
  var PIN = "tomka";            // <-- ZMIEŃ NA WŁASNY
  var SS_AUTH = "tomka_panel_auth";
  var LS_WYCENY = "tomka_wyceny";

  var cennik = T.getCennik();
  var app = document.getElementById("panel-app");
  var overlay = document.getElementById("oferta-overlay");
  document.getElementById("brand").innerHTML =
    T.logoSVG(34) + '<span><span class="brand-name">TOM-KA</span><br><span class="brand-sub">Panel wycen</span></span>';

  var stanEdycji = null;   // aktualnie edytowana wycena
  var widok = "lista";

  /* ---------------- storage ---------------- */
  function wczytajWyceny() {
    try { var r = localStorage.getItem(LS_WYCENY); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  }
  function zapiszWyceny(arr) {
    try { localStorage.setItem(LS_WYCENY, JSON.stringify(arr)); return true; }
    catch (e) { alert("Nie udało się zapisać (pamięć przeglądarki niedostępna)."); return false; }
  }
  function nastepnyNumer() {
    var rok = new Date().getFullYear();
    var wyceny = wczytajWyceny();
    var n = wyceny.filter(function (w) { return (w.numer || "").indexOf("/" + rok + "/") >= 0; }).length + 1;
    return "OF/" + rok + "/" + String(n).padStart(3, "0");
  }
  function uid() { return "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------------- logowanie ---------------- */
  function zalogowany() { try { return sessionStorage.getItem(SS_AUTH) === "1"; } catch (e) { return false; } }
  function renderLogin() {
    document.getElementById("logout").style.display = "none";
    app.innerHTML =
      '<div class="card wrap-narrow" style="max-width:420px;margin:40px auto">' +
      '<h1>Panel wewnętrzny</h1><p class="muted">Podaj PIN, aby uzyskać dostęp.</p>' +
      '<label class="field"><span class="lbl">PIN</span><input type="password" id="pin" autofocus></label>' +
      '<div id="pin-msg"></div>' +
      '<div class="actions"><button class="btn btn-primary" id="pin-ok">Wejdź</button></div>' +
      '<p class="small muted mt">Uwaga: to prosty dostęp po stronie przeglądarki, nie pełne logowanie.</p></div>';
    function submit() {
      if (document.getElementById("pin").value === PIN) {
        try { sessionStorage.setItem(SS_AUTH, "1"); } catch (e) {}
        renderApp();
      } else {
        document.getElementById("pin-msg").innerHTML = '<div class="alert alert-warn">Nieprawidłowy PIN.</div>';
      }
    }
    document.getElementById("pin-ok").addEventListener("click", submit);
    document.getElementById("pin").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function renderApp() {
    document.getElementById("logout").style.display = "";
    if (widok === "lista") renderLista();
    else if (widok === "edytor") renderEdytor();
    else if (widok === "cennik") renderCennik();
  }

  document.getElementById("logout").addEventListener("click", function (e) {
    e.preventDefault();
    try { sessionStorage.removeItem(SS_AUTH); } catch (err) {}
    renderLogin();
  });

  function tabs(aktywny) {
    return '<div class="tabs no-print">' +
      '<button class="tab' + (aktywny === "lista" ? " active" : "") + '" data-tab="lista">Lista wycen</button>' +
      '<button class="tab' + (aktywny === "edytor" ? " active" : "") + '" data-tab="edytor">' + (stanEdycji ? "Edytor" : "Nowa wycena") + '</button>' +
      '<button class="tab' + (aktywny === "cennik" ? " active" : "") + '" data-tab="cennik">Ustawienia / cennik</button>' +
      '</div>';
  }
  function bindTabs() {
    app.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-tab");
        if (t === "edytor" && !stanEdycji) nowaWycena();
        widok = t; renderApp();
      });
    });
  }

  /* ============================= LISTA ============================= */
  function renderLista() {
    var wyceny = wczytajWyceny().sort(function (a, b) { return (b.data_utworzenia || "").localeCompare(a.data_utworzenia || ""); });
    var html = tabs("lista");
    html += '<div class="card">';
    html += '<div class="row-inline mb"><h1 style="margin:0;flex:1">Wyceny</h1>' +
      '<button class="btn btn-primary btn-sm" id="btn-nowa">+ Nowa wycena</button></div>';
    html += '<div class="grid2 mb">' +
      '<input type="text" id="szukaj" placeholder="Szukaj: klient, obiekt, numer…">' +
      '<select id="filtr-status"><option value="">Wszystkie statusy</option>' +
      '<option value="szkic">Szkic</option><option value="wyslana">Wysłana</option>' +
      '<option value="zaakceptowana">Zaakceptowana</option><option value="odrzucona">Odrzucona</option></select></div>';

    if (!wyceny.length) {
      html += '<p class="muted">Brak zapisanych wycen. Kliknij „Nowa wycena”, aby zacząć.</p>';
    } else {
      html += '<div class="table-scroll"><table class="tbl" id="tbl-wyceny"><thead><tr>' +
        '<th>Nr</th><th>Klient</th><th>Obiekt</th><th class="num">Netto</th><th>Data</th><th>Status</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
    }
    html += '</div>';
    app.innerHTML = html;
    bindTabs();
    document.getElementById("btn-nowa").addEventListener("click", function () { nowaWycena(); widok = "edytor"; renderApp(); });

    if (wyceny.length) {
      var szukaj = document.getElementById("szukaj"), filtr = document.getElementById("filtr-status");
      function odswiez() { rysujWiersze(wyceny, szukaj.value.toLowerCase(), filtr.value); }
      szukaj.addEventListener("input", odswiez); filtr.addEventListener("change", odswiez);
      odswiez();
    }
  }

  function rysujWiersze(wyceny, q, status) {
    var tbody = document.querySelector("#tbl-wyceny tbody");
    var filtrowane = wyceny.filter(function (w) {
      if (status && w.status !== status) return false;
      if (!q) return true;
      var hay = [(w.numer || ""), (w.klient && w.klient.nazwa) || "", (w.obiekt && w.obiekt.nazwa) || "", (w.obiekt && w.obiekt.miejscowosc) || ""].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    tbody.innerHTML = filtrowane.map(function (w) {
      var netto = przeliczWycene(w).netto;
      return '<tr>' +
        '<td>' + T.esc(w.numer || "—") + '</td>' +
        '<td>' + T.esc((w.klient && w.klient.nazwa) || "—") + '</td>' +
        '<td>' + T.esc((w.obiekt && w.obiekt.nazwa) || (w.obiekt && w.obiekt.miejscowosc) || "—") + '</td>' +
        '<td class="num">' + T.fmtPLN(netto) + '</td>' +
        '<td>' + T.dataPL(w.data_utworzenia) + '</td>' +
        '<td><span class="status ' + (w.status || "szkic") + '">' + statusLabel(w.status) + '</span></td>' +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + w.id + '">Edytuj</button> ' +
          '<button class="btn btn-ghost btn-sm" data-dup="' + w.id + '">Duplikuj</button> ' +
          '<button class="btn btn-danger btn-sm" data-del="' + w.id + '">Usuń</button>' +
        '</td></tr>';
    }).join("") || '<tr><td colspan="7" class="muted">Brak wyników.</td></tr>';

    tbody.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { edytuj(b.getAttribute("data-edit")); }); });
    tbody.querySelectorAll("[data-dup]").forEach(function (b) { b.addEventListener("click", function () { duplikuj(b.getAttribute("data-dup")); }); });
    tbody.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { usun(b.getAttribute("data-del")); }); });
  }

  function statusLabel(s) {
    return { szkic: "Szkic", wyslana: "Wysłana", zaakceptowana: "Zaakceptowana", odrzucona: "Odrzucona" }[s || "szkic"];
  }

  function edytuj(id) {
    var w = wczytajWyceny().filter(function (x) { return x.id === id; })[0];
    if (!w) return;
    stanEdycji = JSON.parse(JSON.stringify(w));
    widok = "edytor"; renderApp();
  }
  function duplikuj(id) {
    var w = wczytajWyceny().filter(function (x) { return x.id === id; })[0];
    if (!w) return;
    var kopia = JSON.parse(JSON.stringify(w));
    kopia.id = uid(); kopia.numer = nastepnyNumer(); kopia.data_utworzenia = T.nowISO(); kopia.status = "szkic";
    stanEdycji = kopia; widok = "edytor"; renderApp();
  }
  function usun(id) {
    if (!confirm("Usunąć tę wycenę? Operacji nie można cofnąć.")) return;
    zapiszWyceny(wczytajWyceny().filter(function (x) { return x.id !== id; }));
    renderLista();
  }

  /* ============================= EDYTOR ============================= */
  function nowaWycena() {
    stanEdycji = {
      id: uid(), numer: nastepnyNumer(), data_utworzenia: T.nowISO(), status: "szkic",
      klient: { nazwa: "", osoba_kontaktowa: "", email: "", telefon: "", nip: "" },
      obiekt: { nazwa: "", adres: "", miejscowosc: "", typ: "", liczba_lokali: "", liczba_kondygnacji: "", liczba_klatek: "", powierzchnia_m2: "", rok_budowy: "" },
      pozycje: [],
      modyfikatory: { ekspres: false, weekend: false, wysokosc: false, strefa_id: "I" },
      rabat: { typ: "brak", procent: 0 },
      uwagi: "", waznosc_oferty_dni: cennik.meta.waznosc_oferty_dni || 30, termin_realizacji: ""
    };
  }

  function przeliczWycene(w) {
    var rabatProc = obliczRabat(w);
    return T.obliczWycene(w.pozycje, w.modyfikatory, rabatProc, cennik);
  }
  function obliczRabat(w) {
    var r = w.rabat || {};
    if (r.typ === "reczny") return Number(r.procent) || 0;
    if (r.typ === "abonament") return cennik.modyfikatory.abonament.procent || 0;
    if (r.typ === "pakiet") {
      var kat = new Set(w.pozycje.map(function (p) { return p.usluga_id; }));
      return T.rabatPakietowyProcent(kat, cennik);
    }
    return 0;
  }

  function renderEdytor() {
    var w = stanEdycji;
    var html = tabs("edytor");
    html += '<div class="editor-grid">';

    /* --- lewa kolumna --- */
    html += '<div>';

    // Dane klienta / obiektu
    html += '<div class="card"><h2 style="margin-top:0;font-size:16px">Klient i obiekt</h2>';
    html += '<div class="row-inline mb small muted">Nr oferty: <strong>' + T.esc(w.numer) + '</strong> · ' +
      'Status: <select id="e_status" style="width:auto;display:inline-block;padding:4px 8px">' +
      ["szkic", "wyslana", "zaakceptowana", "odrzucona"].map(function (s) {
        return '<option value="' + s + '"' + (w.status === s ? " selected" : "") + '>' + statusLabel(s) + '</option>';
      }).join("") + '</select></div>';
    html += '<div class="grid2">';
    html += inp("k_nazwa", "Nazwa klienta / firma", w.klient.nazwa);
    html += inp("k_osoba", "Osoba kontaktowa", w.klient.osoba_kontaktowa);
    html += inp("k_email", "E-mail", w.klient.email, "email");
    html += inp("k_tel", "Telefon", w.klient.telefon, "tel");
    html += inp("k_nip", "NIP", w.klient.nip);
    html += inp("o_nazwa", "Nazwa / opis obiektu", w.obiekt.nazwa);
    html += '</div>';
    html += inp("o_adres", "Adres obiektu", w.obiekt.adres);
    html += '<div class="grid2">';
    html += inp("o_miejscowosc", "Miejscowość", w.obiekt.miejscowosc);
    html += selTyp("o_typ", w.obiekt.typ);
    html += inp("o_lokali", "Liczba lokali", w.obiekt.liczba_lokali, "number");
    html += inp("o_kond", "Liczba kondygnacji", w.obiekt.liczba_kondygnacji, "number");
    html += inp("o_klatek", "Liczba klatek/pionów", w.obiekt.liczba_klatek, "number");
    html += inp("o_pow", "Powierzchnia [m²]", w.obiekt.powierzchnia_m2, "number");
    html += inp("o_rok", "Rok budowy", w.obiekt.rok_budowy, "number");
    html += '</div></div>';

    // Pozycje
    html += '<div class="card"><h2 style="margin-top:0;font-size:16px">Pozycje wyceny</h2>';
    html += '<div class="catalog-picker mb"><input type="text" id="kat-search" placeholder="Dodaj usługę z katalogu — wpisz nazwę…">' +
      '<div class="catalog-list hidden" id="kat-list"></div></div>';
    html += '<div class="table-scroll"><table class="tbl"><thead><tr>' +
      '<th style="width:34%">Usługa</th><th>Jedn.</th><th class="num">Ilość</th><th class="num">Stawka</th>' +
      '<th class="num">Min.</th><th class="num">Korekta</th><th class="num">Wartość</th><th></th>' +
      '</tr></thead><tbody id="poz-body"></tbody></table></div>';
    html += '<p class="small muted mt">„Korekta” nadpisuje wyliczoną wartość pozycji (kwota netto). Zostaw puste, by liczyć wg stawki × ilość (min. z „Min.”).</p>';
    html += '</div>';

    // Modyfikatory i rabat
    html += '<div class="card"><h2 style="margin-top:0;font-size:16px">Modyfikatory i rabat</h2>';
    html += '<div class="row-inline">';
    html += tog("m_ekspres", "Ekspres (×" + cennik.modyfikatory.pilnosc.ekspres.mnoznik + ")", w.modyfikatory.ekspres);
    html += tog("m_weekend", "Weekend (×" + cennik.modyfikatory.weekend.mnoznik + ")", w.modyfikatory.weekend);
    html += tog("m_wysokosc", "Wysokość (×" + cennik.modyfikatory.wysokosc.mnoznik + ")", w.modyfikatory.wysokosc);
    html += '</div>';
    html += '<div class="grid2 mt">';
    html += '<label class="field"><span class="lbl">Strefa dojazdu</span><select id="m_strefa">' +
      cennik.strefy_dojazdu.map(function (s) { return '<option value="' + s.id + '"' + (w.modyfikatory.strefa_id === s.id ? " selected" : "") + '>' + T.esc(s.nazwa) + ' (+' + T.fmtPLN(s.doplata) + ')</option>'; }).join("") +
      '</select></label>';
    html += '<label class="field"><span class="lbl">Rabat</span><select id="r_typ">' +
      '<option value="brak"' + (w.rabat.typ === "brak" ? " selected" : "") + '>Brak</option>' +
      '<option value="pakiet"' + (w.rabat.typ === "pakiet" ? " selected" : "") + '>Pakietowy (auto ≥3 usługi)</option>' +
      '<option value="abonament"' + (w.rabat.typ === "abonament" ? " selected" : "") + '>Abonament (' + cennik.modyfikatory.abonament.procent + '%)</option>' +
      '<option value="reczny"' + (w.rabat.typ === "reczny" ? " selected" : "") + '>Ręczny %</option>' +
      '</select></label>';
    html += '</div>';
    html += '<label class="field' + (w.rabat.typ === "reczny" ? "" : " hidden") + '" id="r_reczny-wrap"><span class="lbl">Rabat ręczny [%]</span>' +
      '<input type="number" min="0" max="100" id="r_reczny" value="' + T.esc(w.rabat.procent) + '"></label>';
    html += '</div>';

    // Warunki / uwagi
    html += '<div class="card"><h2 style="margin-top:0;font-size:16px">Warunki oferty</h2><div class="grid2">';
    html += inp("w_waznosc", "Ważność oferty [dni]", w.waznosc_oferty_dni, "number");
    html += inp("w_termin", "Termin realizacji", w.termin_realizacji);
    html += '</div>';
    html += '<label class="field"><span class="lbl">Uwagi</span><textarea id="w_uwagi">' + T.esc(w.uwagi) + '</textarea></label>';
    html += '</div>';

    html += '</div>'; // koniec lewej kolumny

    /* --- prawa kolumna: podsumowanie --- */
    html += '<div><div class="card summary-box" id="summary"></div>' +
      '<div class="actions" style="margin-top:12px">' +
      '<button class="btn btn-primary" id="btn-zapisz">Zapisz</button>' +
      '<button class="btn btn-ghost" id="btn-podglad">Podgląd oferty (PDF)</button>' +
      '<button class="btn btn-ghost" id="btn-wroc">← Do listy</button>' +
      '</div></div>';

    html += '</div>';
    app.innerHTML = html;
    bindTabs();
    bindEdytor();
    rysujPozycje();
    rysujPodsumowanie();
  }

  function inp(id, label, val, typ) {
    return '<label class="field"><span class="lbl">' + label + '</span>' +
      '<input type="' + (typ || "text") + '" id="' + id + '" value="' + T.esc(val == null ? "" : val) + '"></label>';
  }
  function tog(id, label, on) {
    return '<button type="button" class="pill-toggle' + (on ? " on" : "") + '" id="' + id + '">' + label + '</button>';
  }
  function selTyp(id, val) {
    var typy = ["wielorodzinny", "biurowy", "handlowy", "przemysłowo-magazynowy", "użyteczności publicznej", "inny"];
    return '<label class="field"><span class="lbl">Typ obiektu</span><select id="' + id + '"><option value="">—</option>' +
      typy.map(function (t) { return '<option' + (val === t ? " selected" : "") + '>' + t + '</option>'; }).join("") + '</select></label>';
  }

  function bindEdytor() {
    var w = stanEdycji;
    bind("e_status", function (v) { w.status = v; }, "change");
    bind("k_nazwa", function (v) { w.klient.nazwa = v; });
    bind("k_osoba", function (v) { w.klient.osoba_kontaktowa = v; });
    bind("k_email", function (v) { w.klient.email = v; });
    bind("k_tel", function (v) { w.klient.telefon = v; });
    bind("k_nip", function (v) { w.klient.nip = v; });
    bind("o_nazwa", function (v) { w.obiekt.nazwa = v; });
    bind("o_adres", function (v) { w.obiekt.adres = v; });
    bind("o_miejscowosc", function (v) { w.obiekt.miejscowosc = v; });
    bind("o_typ", function (v) { w.obiekt.typ = v; }, "change");
    bind("o_lokali", function (v) { w.obiekt.liczba_lokali = v; });
    bind("o_kond", function (v) { w.obiekt.liczba_kondygnacji = v; });
    bind("o_klatek", function (v) { w.obiekt.liczba_klatek = v; });
    bind("o_pow", function (v) { w.obiekt.powierzchnia_m2 = v; });
    bind("o_rok", function (v) { w.obiekt.rok_budowy = v; });
    bind("w_waznosc", function (v) { w.waznosc_oferty_dni = v; });
    bind("w_termin", function (v) { w.termin_realizacji = v; });
    bind("w_uwagi", function (v) { w.uwagi = v; });

    ["ekspres", "weekend", "wysokosc"].forEach(function (m) {
      document.getElementById("m_" + m).addEventListener("click", function () {
        w.modyfikatory[m] = !w.modyfikatory[m];
        this.classList.toggle("on"); rysujPodsumowanie();
      });
    });
    document.getElementById("m_strefa").addEventListener("change", function (e) { w.modyfikatory.strefa_id = e.target.value; rysujPodsumowanie(); });
    document.getElementById("r_typ").addEventListener("change", function (e) {
      w.rabat.typ = e.target.value;
      document.getElementById("r_reczny-wrap").classList.toggle("hidden", e.target.value !== "reczny");
      rysujPodsumowanie();
    });
    bind("r_reczny", function (v) { w.rabat.procent = v; rysujPodsumowanie(); });

    document.getElementById("btn-zapisz").addEventListener("click", zapiszBiezaca);
    document.getElementById("btn-podglad").addEventListener("click", function () { zapiszBiezaca(true); pokazOferte(stanEdycji); });
    document.getElementById("btn-wroc").addEventListener("click", function () { widok = "lista"; renderApp(); });

    // wyszukiwarka katalogu
    var search = document.getElementById("kat-search"), list = document.getElementById("kat-list");
    search.addEventListener("input", function () {
      var q = search.value.toLowerCase().trim();
      if (!q) { list.classList.add("hidden"); return; }
      var trafienia = cennik.uslugi.filter(function (u) { return u.nazwa.toLowerCase().indexOf(q) >= 0; });
      list.innerHTML = trafienia.map(function (u) {
        return '<div class="catalog-item" data-add="' + u.id + '"><strong>' + T.esc(u.nazwa) + '</strong> ' +
          '<span class="small muted">· ' + T.esc(u.jednostka) + (u.przyklad ? ' · <span class="badge badge-przyklad">stawka przykładowa</span>' : '') + '</span></div>';
      }).join("") || '<div class="catalog-item muted">Brak dopasowań</div>';
      list.classList.remove("hidden");
      list.querySelectorAll("[data-add]").forEach(function (it) {
        it.addEventListener("click", function () { dodajPozycje(it.getAttribute("data-add")); search.value = ""; list.classList.add("hidden"); });
      });
    });
  }
  function bind(id, fn, ev) {
    var el = document.getElementById(id); if (!el) return;
    el.addEventListener(ev || "input", function (e) { fn(e.target.value); });
  }

  function dodajPozycje(uslugaId) {
    var u = T.getUsluga(cennik, uslugaId); if (!u) return;
    stanEdycji.pozycje.push({
      usluga_id: u.id, nazwa: u.nazwa, jednostka: u.jednostka,
      ilosc: u.indywidualna ? 1 : (u.ilosc && u.ilosc.domyslnie != null ? u.ilosc.domyslnie : 1),
      stawka_jednostkowa: u.stawka_domyslna, minimum_pozycji: u.minimum_pozycji,
      korekta_reczna: "", uwaga: "", indywidualna: !!u.indywidualna, przyklad: !!u.przyklad
    });
    rysujPozycje(); rysujPodsumowanie();
  }

  function rysujPozycje() {
    var body = document.getElementById("poz-body"); if (!body) return;
    var w = stanEdycji;
    if (!w.pozycje.length) { body.innerHTML = '<tr><td colspan="8" class="muted">Brak pozycji — dodaj z katalogu powyżej.</td></tr>'; return; }
    body.innerHTML = w.pozycje.map(function (p, i) {
      var cena = p.indywidualna ? null : T.cenaPozycji(p);
      return '<tr class="poz-row">' +
        '<td><input type="text" data-p="nazwa" data-i="' + i + '" value="' + T.esc(p.nazwa) + '">' +
          (p.przyklad ? ' <span class="badge badge-przyklad">przykładowa</span>' : '') +
          '<input type="text" data-p="uwaga" data-i="' + i + '" placeholder="uwaga do pozycji…" style="margin-top:4px;font-size:12px">' +
        '</td>' +
        '<td class="small">' + T.esc(p.jednostka) + '</td>' +
        '<td class="num"><input type="number" min="0" data-p="ilosc" data-i="' + i + '" value="' + T.esc(p.ilosc) + '" style="width:72px;text-align:right"></td>' +
        '<td class="num"><input type="number" min="0" data-p="stawka_jednostkowa" data-i="' + i + '" value="' + T.esc(p.stawka_jednostkowa) + '" style="width:80px;text-align:right"></td>' +
        '<td class="num"><input type="number" min="0" data-p="minimum_pozycji" data-i="' + i + '" value="' + T.esc(p.minimum_pozycji) + '" style="width:80px;text-align:right"></td>' +
        '<td class="num"><input type="number" min="0" data-p="korekta_reczna" data-i="' + i + '" value="' + T.esc(p.korekta_reczna) + '" style="width:80px;text-align:right" placeholder="—"></td>' +
        '<td class="num"><strong>' + (p.indywidualna ? "indyw." : T.fmtPLN(cena)) + '</strong></td>' +
        '<td class="num"><button class="btn btn-danger btn-sm" data-del-poz="' + i + '">✕</button></td>' +
        '</tr>';
    }).join("");

    body.querySelectorAll("input[data-p]").forEach(function (el) {
      el.addEventListener("input", function () {
        var i = +el.getAttribute("data-i"), pole = el.getAttribute("data-p");
        stanEdycji.pozycje[i][pole] = el.value;
        // odśwież wartość pozycji na żywo
        var cell = el.closest("tr").querySelector("td.num strong");
        var p = stanEdycji.pozycje[i];
        if (cell && !p.indywidualna) cell.textContent = T.fmtPLN(T.cenaPozycji(p));
        rysujPodsumowanie();
      });
    });
    body.querySelectorAll("[data-del-poz]").forEach(function (b) {
      b.addEventListener("click", function () { stanEdycji.pozycje.splice(+b.getAttribute("data-del-poz"), 1); rysujPozycje(); rysujPodsumowanie(); });
    });
  }

  function rysujPodsumowanie() {
    var box = document.getElementById("summary"); if (!box) return;
    var w = stanEdycji, r = przeliczWycene(w);
    var html = '<h2 style="margin-top:0;font-size:16px">Podsumowanie</h2>';
    html += line("Suma pozycji", T.fmtPLN(r.suma_pozycji));
    if (r.mnozniki.ekspres !== 1) html += line("× ekspres", "×" + r.mnozniki.ekspres);
    if (r.mnozniki.weekend !== 1) html += line("× weekend", "×" + r.mnozniki.weekend);
    if (r.mnozniki.wysokosc !== 1) html += line("× wysokość", "×" + r.mnozniki.wysokosc);
    if (r.doplata_strefowa) html += line("+ dojazd (" + (r.strefa ? r.strefa.id : "") + ")", T.fmtPLN(r.doplata_strefowa));
    if (r.rabat_procent) html += line("− rabat " + T.fmtProc(r.rabat_procent), "−" + T.fmtPLN(r.po_dojezdzie - r.po_rabacie));
    html += line("<strong>Netto</strong>", "<strong>" + T.fmtPLN(r.netto) + "</strong>");
    html += line("VAT " + T.fmtProc(r.vat_procent), T.fmtPLN(r.vat_kwota));
    html += '<div class="summary-line total"><span>Brutto</span><span>' + T.fmtPLN(r.brutto) + '</span></div>';
    if (T.czyPrzykladowe(cennik)) html += '<div class="alert alert-warn small mt">Uwaga: użyto stawek przykładowych — podmień w zakładce „Ustawienia / cennik”.</div>';
    box.innerHTML = html;
  }
  function line(l, v) { return '<div class="summary-line"><span>' + l + '</span><span>' + v + '</span></div>'; }

  function zapiszBiezaca(cicho) {
    var arr = wczytajWyceny();
    var idx = arr.findIndex(function (x) { return x.id === stanEdycji.id; });
    if (idx >= 0) arr[idx] = stanEdycji; else arr.push(stanEdycji);
    zapiszWyceny(arr);
    if (!cicho) { alert("Zapisano wycenę " + stanEdycji.numer + "."); }
  }

  /* ============================= OFERTA (PDF) ============================= */
  function pokazOferte(w) {
    var r = przeliczWycene(w);
    var f = cennik.firma;
    var lp = 0;
    var wiersze = w.pozycje.map(function (p) {
      lp++;
      var cena = p.indywidualna ? null : T.cenaPozycji(p);
      return '<tr><td class="num">' + lp + '</td><td>' + T.esc(p.nazwa) + (p.uwaga ? '<br><span class="of-note">' + T.esc(p.uwaga) + '</span>' : '') + '</td>' +
        '<td>' + T.esc(p.jednostka) + '</td><td class="num">' + T.esc(p.ilosc) + '</td>' +
        '<td class="num">' + (p.indywidualna ? "indyw." : T.fmtPLN(p.stawka_jednostkowa)) + '</td>' +
        '<td class="num">' + (p.indywidualna ? "—" : T.fmtPLN(cena)) + '</td></tr>';
    }).join("");

    var html = '<div class="oferta-toolbar no-print">' +
      '<strong>Podgląd oferty ' + T.esc(w.numer) + '</strong><span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-sm" id="of-wyslana">Oznacz jako wysłaną</button>' +
      '<button class="btn btn-primary btn-sm" id="of-print">Drukuj / zapisz PDF</button>' +
      '<button class="btn btn-ghost btn-sm" id="of-close">Zamknij</button></div>';

    html += '<div class="oferta">';
    // 1. nagłówek
    html += '<div class="of-head">' + T.logoSVG(52) +
      '<div class="of-title"><h1>Oferta ' + T.esc(w.numer) + '</h1>' +
      '<div class="small muted">' + T.esc(f.nazwa) + '</div></div>' +
      '<div class="of-meta">Data: ' + T.dataPL(w.data_utworzenia) + '<br>Ważność oferty: ' + T.dataZaDni(w.waznosc_oferty_dni) + '</div></div>';

    // 2. klient / obiekt
    html += '<div class="of-section"><div class="of-two">' +
      '<div class="of-box"><strong>Zamawiający</strong><br>' +
        T.esc(w.klient.nazwa || "—") +
        (w.klient.osoba_kontaktowa ? '<br>' + T.esc(w.klient.osoba_kontaktowa) : '') +
        (w.klient.email ? '<br>' + T.esc(w.klient.email) : '') +
        (w.klient.telefon ? '<br>tel. ' + T.esc(w.klient.telefon) : '') +
        (w.klient.nip ? '<br>NIP: ' + T.esc(w.klient.nip) : '') + '</div>' +
      '<div class="of-box"><strong>Obiekt</strong><br>' +
        T.esc(w.obiekt.nazwa || "—") +
        (w.obiekt.adres ? '<br>' + T.esc(w.obiekt.adres) : '') +
        (w.obiekt.miejscowosc ? '<br>' + T.esc(w.obiekt.miejscowosc) : '') +
        (w.obiekt.typ ? '<br>Typ: ' + T.esc(w.obiekt.typ) : '') +
        obiektParametry(w.obiekt) + '</div>' +
      '</div></div>';

    // 3. tabela pozycji
    html += '<div class="of-section"><h2>Zakres prac i wycena</h2>' +
      '<table class="of-tbl"><thead><tr><th class="num">Lp.</th><th>Zakres prac</th><th>Jedn.</th><th class="num">Ilość</th><th class="num">Cena jedn. netto</th><th class="num">Wartość netto</th></tr></thead>' +
      '<tbody>' + (wiersze || '<tr><td colspan="6" class="muted">Brak pozycji.</td></tr>') + '</tbody></table>';

    // 4. podsumowanie
    html += '<div class="of-sum">';
    if (r.rabat_procent) html += '<div class="l"><span>Rabat</span><span>' + T.fmtProc(r.rabat_procent) + '</span></div>';
    html += '<div class="l"><span>Razem netto</span><span>' + T.fmtPLN(r.netto) + '</span></div>' +
      '<div class="l"><span>VAT ' + T.fmtProc(r.vat_procent) + '</span><span>' + T.fmtPLN(r.vat_kwota) + '</span></div>' +
      '<div class="l brutto"><span>Razem brutto</span><span>' + T.fmtPLN(r.brutto) + '</span></div></div>';
    if (T.czyPrzykladowe(cennik)) html += '<p class="of-note">Uwaga wewnętrzna: wycena zawiera stawki przykładowe — przed wysłaniem klientowi zweryfikuj cennik.</p>';

    // 5. zakres i standard wykonania (TYLKO zatwierdzone normy)
    html += '<div class="of-section"><h2>Zakres i standard wykonania</h2><ul class="of-list">' +
      '<li>Prawo budowlane, art. 62 — okresowe kontrole stanu technicznego.</li>' +
      '<li>PN-EN 12599 — kontrola i pomiary instalacji wentylacji.</li>' +
      '<li>PN-HD 60364-6 — pomiary instalacji elektrycznych.</li>' +
      '<li>PN-EN 1838 / PN-EN 50172 — oświetlenie awaryjne.</li>' +
      '<li>PN-EN 54 — systemy sygnalizacji pożarowej.</li>' +
      '<li>PN-EN 671-3 — hydranty wewnętrzne i węże.</li>' +
      '</ul><p class="of-note">Pomiary wykonujemy sprzętem Afriso i Testo z aktualną kalibracją.</p></div>';

    // 6. co klient otrzymuje
    html += '<div class="of-section"><h2>Co otrzymuje Zamawiający</h2><ul class="of-list">' +
      '<li>Protokoły z wykonanych przeglądów i pomiarów.</li>' +
      '<li>Dokumentację potwierdzającą wykonanie prac.</li>' +
      '<li>Zalecenia pokontrolne i wskazanie ewentualnych nieprawidłowości.</li></ul></div>';

    // 7. kwalifikacje
    html += '<div class="of-section"><h2>Kwalifikacje</h2><ul class="of-list">' +
      '<li>Uprawnienia budowlane bez ograniczeń.</li>' +
      '<li>Świadectwa kwalifikacyjne SEP: G1, G2, G3.</li>' +
      '<li>Uprawnienia do sporządzania świadectw charakterystyki energetycznej.</li></ul></div>';

    // 8. warunki
    html += '<div class="of-section"><h2>Warunki</h2><div class="of-box">' +
      'Termin realizacji: ' + T.esc(w.termin_realizacji || "do uzgodnienia") + '<br>' +
      'Ważność oferty: ' + T.esc(w.waznosc_oferty_dni) + ' dni (do ' + T.dataZaDni(w.waznosc_oferty_dni) + ')<br>' +
      'Sposób płatności: do uzgodnienia' +
      (w.uwagi ? '<br>Uwagi: ' + T.esc(w.uwagi) : '') + '</div></div>';

    // 9. stopka
    html += '<div class="of-footer">' + T.esc(f.nazwa) +
      ' · tel. ' + T.esc(f.telefon) + ' · ' + T.esc(f.email) + ' · ' + T.esc(f.www) +
      (f.adres ? ' · ' + T.esc(f.adres) : '') +
      (f.nip ? '<br>NIP: ' + T.esc(f.nip) : '') + (f.regon ? ' · REGON: ' + T.esc(f.regon) : '') +
      (f.rachunek ? '<br>Rachunek: ' + T.esc(f.rachunek) : '') + '</div>';

    html += '</div>'; // .oferta
    overlay.innerHTML = html;
    overlay.classList.remove("hidden");
    document.body.classList.add("show-oferta");

    document.getElementById("of-close").addEventListener("click", zamknijOferte);
    document.getElementById("of-print").addEventListener("click", function () { window.print(); });
    document.getElementById("of-wyslana").addEventListener("click", function () {
      stanEdycji.status = "wyslana"; zapiszBiezaca(true);
      alert("Oznaczono jako wysłaną."); zamknijOferte(); renderApp();
    });
  }
  function zamknijOferte() { overlay.classList.add("hidden"); overlay.innerHTML = ""; document.body.classList.remove("show-oferta"); }
  function obiektParametry(o) {
    var p = [];
    if (o.liczba_lokali) p.push("lokali: " + o.liczba_lokali);
    if (o.liczba_kondygnacji) p.push("kondygnacji: " + o.liczba_kondygnacji);
    if (o.liczba_klatek) p.push("klatek/pionów: " + o.liczba_klatek);
    if (o.powierzchnia_m2) p.push(o.powierzchnia_m2 + " m²");
    if (o.rok_budowy) p.push("rok: " + o.rok_budowy);
    return p.length ? '<br>' + T.esc(p.join(" · ")) : "";
  }

  /* ============================= CENNIK / USTAWIENIA ============================= */
  function renderCennik() {
    var ov = T.loadCennikOverride();
    var html = tabs("cennik");
    html += '<div class="card"><h1 style="margin-top:0">Ustawienia i cennik</h1>' +
      '<p class="muted">Zmiany zapisują się w pamięci przeglądarki i nadpisują stawki z pliku <code>cennik.js</code>. ' +
      'Aby zmienić stawki na stałe dla wszystkich urządzeń — edytuj plik <code>cennik.js</code> na serwerze.</p>';

    html += '<h2 style="font-size:16px">Ogólne</h2><div class="grid2">';
    html += '<label class="field"><span class="lbl">VAT [%]</span><input type="number" id="c_vat" value="' + T.esc(cennik.meta.vat_procent) + '"></label>';
    html += '<label class="field"><span class="lbl">Widełki w kalkulatorze [±%]</span><input type="number" id="c_widelki" value="' + T.esc(cennik.meta.widelki_procent) + '"></label>';
    html += '</div>';

    html += '<h2 style="font-size:16px">Modyfikatory</h2><div class="grid2">';
    html += '<label class="field"><span class="lbl">Ekspres — mnożnik</span><input type="number" step="0.05" id="c_ekspres" value="' + T.esc(cennik.modyfikatory.pilnosc.ekspres.mnoznik) + '"></label>';
    html += '<label class="field"><span class="lbl">Weekend — mnożnik</span><input type="number" step="0.05" id="c_weekend" value="' + T.esc(cennik.modyfikatory.weekend.mnoznik) + '"></label>';
    html += '<label class="field"><span class="lbl">Wysokość — mnożnik</span><input type="number" step="0.05" id="c_wysokosc" value="' + T.esc(cennik.modyfikatory.wysokosc.mnoznik) + '"></label>';
    html += '<label class="field"><span class="lbl">Rabat pakietowy [%]</span><input type="number" id="c_pakiet" value="' + T.esc(cennik.modyfikatory.rabat_pakietowy.procent) + '"></label>';
    html += '<label class="field"><span class="lbl">Abonament [%]</span><input type="number" id="c_abonament" value="' + T.esc(cennik.modyfikatory.abonament.procent) + '"></label>';
    html += '</div>';

    html += '<h2 style="font-size:16px">Strefy dojazdu (dopłata kwotowa)</h2><div class="grid2">';
    cennik.strefy_dojazdu.forEach(function (s) {
      html += '<label class="field"><span class="lbl">' + T.esc(s.nazwa) + '</span><input type="number" data-strefa="' + s.id + '" value="' + T.esc(s.doplata) + '"></label>';
    });
    html += '</div>';

    html += '<h2 style="font-size:16px">Stawki usług</h2><div class="table-scroll"><table class="tbl"><thead><tr>' +
      '<th>Usługa</th><th>Jedn.</th><th class="num">Stawka netto</th><th class="num">Minimum</th><th>Przykładowa?</th></tr></thead><tbody>';
    cennik.uslugi.forEach(function (u) {
      if (u.indywidualna) return;
      html += '<tr><td>' + T.esc(u.nazwa) + '</td><td class="small">' + T.esc(u.jednostka) + '</td>' +
        '<td class="num"><input type="number" min="0" data-stawka="' + u.id + '" value="' + T.esc(u.stawka_domyslna) + '" style="width:90px;text-align:right"></td>' +
        '<td class="num"><input type="number" min="0" data-min="' + u.id + '" value="' + T.esc(u.minimum_pozycji) + '" style="width:90px;text-align:right"></td>' +
        '<td><input type="checkbox" data-przyklad="' + u.id + '"' + (u.przyklad ? " checked" : "") + '></td></tr>';
    });
    html += '</tbody></table></div>';

    html += '<div class="actions"><button class="btn btn-primary" id="c_zapisz">Zapisz cennik</button>' +
      '<button class="btn btn-danger" id="c_reset">Przywróć wartości z pliku</button></div>';
    html += '<div id="c_msg"></div></div>';

    app.innerHTML = html;
    bindTabs();

    document.getElementById("c_zapisz").addEventListener("click", function () {
      var nowy = {
        meta: { vat_procent: num("c_vat"), widelki_procent: num("c_widelki") },
        modyfikatory: {
          ekspres_mnoznik: num("c_ekspres"), weekend_mnoznik: num("c_weekend"), wysokosc_mnoznik: num("c_wysokosc"),
          rabat_pakietowy_procent: num("c_pakiet"), abonament_procent: num("c_abonament")
        },
        strefy_dojazdu: {}, uslugi: {}
      };
      app.querySelectorAll("[data-strefa]").forEach(function (el) { nowy.strefy_dojazdu[el.getAttribute("data-strefa")] = { doplata: Number(el.value) || 0 }; });
      app.querySelectorAll("[data-stawka]").forEach(function (el) {
        var id = el.getAttribute("data-stawka");
        nowy.uslugi[id] = nowy.uslugi[id] || {};
        nowy.uslugi[id].stawka_domyslna = Number(el.value) || 0;
      });
      app.querySelectorAll("[data-min]").forEach(function (el) {
        var id = el.getAttribute("data-min");
        nowy.uslugi[id] = nowy.uslugi[id] || {};
        nowy.uslugi[id].minimum_pozycji = Number(el.value) || 0;
      });
      app.querySelectorAll("[data-przyklad]").forEach(function (el) {
        var id = el.getAttribute("data-przyklad");
        nowy.uslugi[id] = nowy.uslugi[id] || {};
        nowy.uslugi[id].przyklad = el.checked;
      });
      if (T.saveCennikOverride(nowy)) {
        cennik = T.getCennik();
        document.getElementById("c_msg").innerHTML = '<div class="alert alert-info">Zapisano. Nowe stawki obowiązują od teraz.</div>';
      }
    });
    document.getElementById("c_reset").addEventListener("click", function () {
      if (!confirm("Przywrócić stawki z pliku cennik.js? Zmiany zapisane w przeglądarce zostaną usunięte.")) return;
      try { localStorage.removeItem(T.LS_CENNIK_OVERRIDE); } catch (e) {}
      cennik = T.getCennik(); renderCennik();
    });
  }
  function num(id) { return Number(document.getElementById(id).value) || 0; }

  /* ---------------- start ---------------- */
  if (zalogowany()) renderApp(); else renderLogin();
})();
