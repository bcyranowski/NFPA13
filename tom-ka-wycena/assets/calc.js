/* =========================================================================
   TOM-KA WYCENA — SILNIK OBLICZEŃ (wspólny dla trybu A i B)
   Kolejność obliczeń zgodna z brief, sekcja 6.3 (obowiązkowa).
   ========================================================================= */
(function () {
  "use strict";

  var LS_CENNIK_OVERRIDE = "tomka_cennik_override";

  /* ---- Cennik: bazowy z cennik.js + ewentualne nadpisania z panelu ---- */
  function getCennik() {
    var base = window.TOMKA_CENNIK;
    if (!base) {
      console.error("Brak cennik.js — katalog usług nie został wczytany.");
      return { meta: {}, uslugi: [], kategorie: [], strefy_dojazdu: [], modyfikatory: {} };
    }
    // głęboka kopia, żeby nie modyfikować oryginału
    var cennik = JSON.parse(JSON.stringify(base));
    try {
      var raw = localStorage.getItem(LS_CENNIK_OVERRIDE);
      if (raw) {
        var ov = JSON.parse(raw);
        applyOverride(cennik, ov);
      }
    } catch (e) { /* localStorage niedostępny — używamy bazowego cennika */ }
    return cennik;
  }

  // Nadpisuje stawki/minima/modyfikatory zapisane w panelu (Ustawienia).
  function applyOverride(cennik, ov) {
    if (!ov) return;
    if (ov.meta) { Object.keys(ov.meta).forEach(function (k) { cennik.meta[k] = ov.meta[k]; }); }
    if (ov.uslugi) {
      cennik.uslugi.forEach(function (u) {
        var o = ov.uslugi[u.id];
        if (!o) return;
        if (typeof o.stawka_domyslna === "number") u.stawka_domyslna = o.stawka_domyslna;
        if (typeof o.minimum_pozycji === "number") u.minimum_pozycji = o.minimum_pozycji;
        if (typeof o.przyklad === "boolean") u.przyklad = o.przyklad;
      });
    }
    if (ov.strefy_dojazdu) {
      cennik.strefy_dojazdu.forEach(function (s) {
        var o = ov.strefy_dojazdu[s.id];
        if (o && typeof o.doplata === "number") { s.doplata = o.doplata; if (typeof o.przyklad === "boolean") s.przyklad = o.przyklad; }
      });
    }
    if (ov.modyfikatory) {
      var m = ov.modyfikatory, cm = cennik.modyfikatory;
      if (m.ekspres_mnoznik != null) cm.pilnosc.ekspres.mnoznik = m.ekspres_mnoznik;
      if (m.weekend_mnoznik != null) cm.weekend.mnoznik = m.weekend_mnoznik;
      if (m.wysokosc_mnoznik != null) cm.wysokosc.mnoznik = m.wysokosc_mnoznik;
      if (m.rabat_pakietowy_procent != null) cm.rabat_pakietowy.procent = m.rabat_pakietowy_procent;
      if (m.abonament_procent != null) cm.abonament.procent = m.abonament_procent;
      if (m.ekspres_przyklad != null) cm.pilnosc.ekspres.przyklad = m.ekspres_przyklad;
    }
  }

  function saveCennikOverride(ov) {
    try { localStorage.setItem(LS_CENNIK_OVERRIDE, JSON.stringify(ov)); return true; }
    catch (e) { return false; }
  }
  function loadCennikOverride() {
    try { var raw = localStorage.getItem(LS_CENNIK_OVERRIDE); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }

  function getUsluga(cennik, id) {
    for (var i = 0; i < cennik.uslugi.length; i++) if (cennik.uslugi[i].id === id) return cennik.uslugi[i];
    return null;
  }

  /* ---- Zaokrąglanie: do pełnych złotych, w górę ---- */
  function roundUpPLN(x) {
    if (!isFinite(x)) return 0;
    return Math.ceil(x - 1e-9); // tolerancja na błędy zmiennoprzecinkowe
  }

  /* ---- Cena pojedynczej pozycji ----
     korekta_reczna (jeśli podana jako liczba) nadpisuje wyliczoną wartość. */
  function cenaPozycji(poz) {
    if (poz.korekta_reczna != null && poz.korekta_reczna !== "" && !isNaN(poz.korekta_reczna)) {
      return Number(poz.korekta_reczna);
    }
    var stawka = Number(poz.stawka_jednostkowa) || 0;
    var ilosc = Number(poz.ilosc) || 0;
    var minimum = Number(poz.minimum_pozycji) || 0;
    return Math.max(stawka * ilosc, minimum);
  }

  /* ---- Główne obliczenie wyceny ----
     wejście:
       pozycje: [ {stawka_jednostkowa, ilosc, minimum_pozycji, korekta_reczna?, indywidualna?} ]
       mod:  { ekspres, weekend, wysokosc, strefa_id }
       rabatProcent: number (0-100)  // wynik może być z pakietu/abonamentu/ręczny
     zwraca pełny rozkład obliczenia.                                        */
  function obliczWycene(pozycje, mod, rabatProcent, cennik) {
    cennik = cennik || getCennik();
    mod = mod || {};
    var m = cennik.modyfikatory;

    // 1 + 2: suma pozycji (pomijamy pozycje indywidualne — bez ceny)
    var sumaPozycji = 0;
    var pozycjeWyliczone = pozycje.map(function (p) {
      var cena = p.indywidualna ? 0 : cenaPozycji(p);
      if (!p.indywidualna) sumaPozycji += cena;
      return Object.assign({}, p, { cena_pozycji: cena });
    });

    // 3: mnożniki
    var mnoznikEkspres = mod.ekspres ? (m.pilnosc.ekspres.mnoznik || 1) : 1;
    var mnoznikWeekend = mod.weekend ? (m.weekend.mnoznik || 1) : 1;
    var mnoznikWysokosc = mod.wysokosc ? (m.wysokosc.mnoznik || 1) : 1;
    var poMnoznikach = sumaPozycji * mnoznikEkspres * mnoznikWeekend * mnoznikWysokosc;

    // 4: dopłata strefowa (kwotowa)
    var doplataStrefowa = 0, strefa = null;
    if (mod.strefa_id) {
      strefa = cennik.strefy_dojazdu.filter(function (s) { return s.id === mod.strefa_id; })[0] || null;
      if (strefa) doplataStrefowa = Number(strefa.doplata) || 0;
    }
    var poDojezdzie = poMnoznikach + doplataStrefowa;

    // 5: rabat
    var rabat = Number(rabatProcent) || 0;
    if (rabat < 0) rabat = 0; if (rabat > 100) rabat = 100;
    var poRabacie = poDojezdzie * (1 - rabat / 100);

    // 6: netto (zaokrąglone w górę do pełnych zł)
    var netto = roundUpPLN(poRabacie);

    // 7: brutto
    var vat = (cennik.meta && cennik.meta.vat_procent != null) ? Number(cennik.meta.vat_procent) : 0;
    var brutto = roundUpPLN(netto * (1 + vat / 100));

    return {
      pozycje: pozycjeWyliczone,
      suma_pozycji: sumaPozycji,
      mnozniki: { ekspres: mnoznikEkspres, weekend: mnoznikWeekend, wysokosc: mnoznikWysokosc },
      po_mnoznikach: poMnoznikach,
      strefa: strefa,
      doplata_strefowa: doplataStrefowa,
      po_dojezdzie: poDojezdzie,
      rabat_procent: rabat,
      po_rabacie: poRabacie,
      netto: netto,
      vat_procent: vat,
      vat_kwota: brutto - netto,
      brutto: brutto
    };
  }

  /* ---- Widełki (tylko tryb A): netto ± procent, zaokrąglone do pełnych zł ---- */
  function widelki(netto, procent) {
    var p = (procent == null ? 15 : procent) / 100;
    return { dol: roundUpPLN(netto * (1 - p)), gora: roundUpPLN(netto * (1 + p)) };
  }

  /* ---- Rabat pakietowy: liczony wg liczby RÓŻNYCH kategorii usług ---- */
  function rabatPakietowyProcent(kategorieSet, cennik) {
    cennik = cennik || getCennik();
    var rp = cennik.modyfikatory.rabat_pakietowy;
    if (!rp) return 0;
    var liczbaRodzajow = (kategorieSet && kategorieSet.size) ? kategorieSet.size : 0;
    return liczbaRodzajow >= rp.prog_rodzajow ? (rp.procent || 0) : 0;
  }

  /* ---- Formatowanie kwot ---- */
  function fmtPLN(x) {
    var n = Math.round(Number(x) || 0);
    return n.toLocaleString("pl-PL") + " zł";
  }
  function fmtProc(x) {
    return (Number(x) || 0).toString().replace(".", ",") + "%";
  }

  /* ---- Czy w wycenie są jakiekolwiek stawki przykładowe? ---- */
  function czyPrzykladowe(cennik) {
    cennik = cennik || getCennik();
    var anyUsluga = cennik.uslugi.some(function (u) { return u.przyklad && !u.indywidualna; });
    var anyStrefa = cennik.strefy_dojazdu.some(function (s) { return s.przyklad && s.doplata !== 0; });
    var m = cennik.modyfikatory;
    var anyMod = (m.pilnosc.ekspres.przyklad || m.weekend.przyklad || m.wysokosc.przyklad ||
                  m.rabat_pakietowy.przyklad || m.abonament.przyklad);
    return anyUsluga || anyStrefa || anyMod;
  }

  window.TOMKA = window.TOMKA || {};
  Object.assign(window.TOMKA, {
    LS_CENNIK_OVERRIDE: LS_CENNIK_OVERRIDE,
    getCennik: getCennik,
    getUsluga: getUsluga,
    saveCennikOverride: saveCennikOverride,
    loadCennikOverride: loadCennikOverride,
    cenaPozycji: cenaPozycji,
    obliczWycene: obliczWycene,
    widelki: widelki,
    rabatPakietowyProcent: rabatPakietowyProcent,
    roundUpPLN: roundUpPLN,
    fmtPLN: fmtPLN,
    fmtProc: fmtProc,
    czyPrzykladowe: czyPrzykladowe
  });
})();
