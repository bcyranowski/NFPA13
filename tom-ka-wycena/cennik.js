/* =========================================================================
   TOM-KA WYCENA — CENNIK I MODYFIKATORY
   =========================================================================

   TO JEST JEDYNY PLIK, KTÓRY TRZEBA EDYTOWAĆ, ABY ZMIENIĆ STAWKI.
   Nie trzeba dotykać żadnego innego kodu.

   >>> WSZYSTKIE KWOTY PONIŻEJ SĄ PRZYKŁADOWE <<<
   >>> // PRZYKŁAD – DO PODMIANY                <<<

   Każda pozycja z ceną przykładową ma pole  "przyklad": true.
   Dopóki tak jest, aplikacja pokazuje ostrzeżenie "stawki przykładowe,
   do potwierdzenia". Po wpisaniu prawdziwych stawek zmień "przyklad" na
   false (albo usuń to pole) dla danej pozycji.

   Zasady (nie łamać):
   - Nie wymyślać cen. Jeśli nie znasz stawki, wpisz 0 — aplikacja pokaże
     komunikat "stawka do uzupełnienia" zamiast zmyślonej liczby.
   - Podstawy prawne i normy TYLKO z zatwierdzonej listy (patrz sekcja
     "Zakres i standard wykonania" w ofercie). Czego nie ma na liście —
     nie dopisujemy.

   Kolejność obliczeń (obowiązkowa, patrz calc.js):
     1. cena_pozycji  = max(stawka × ilosc, minimum_pozycji)
     2. suma_pozycji  = Σ cena_pozycji
     3. po_mnoznikach = suma × ekspres × weekend × wysokosc
     4. po_dojazdzie  = po_mnoznikach + doplata_strefowa
     5. po_rabacie    = po_dojazdzie × (1 − rabat%)
     6. netto         = po_rabacie
     7. brutto        = netto × (1 + VAT)
     8. widelki (tryb A) = netto ± procent
     Zaokrąglanie: do pełnych złotych, w górę.
   ========================================================================= */

window.TOMKA_CENNIK = {

  /* --- Ustawienia ogólne --------------------------------------------- */
  meta: {
    waluta: "zł",
    vat_procent: 23,          // PRZYKŁAD – DO POTWIERDZENIA (standardowa stawka VAT w PL)
    widelki_procent: 15,      // PRZYKŁAD – DO PODMIANY (± wokół wyniku w trybie A)
    waznosc_oferty_dni: 30,   // PRZYKŁAD – DO PODMIANY
    // e-mail, na który trafiają zapytania z kalkulatora publicznego:
    email_firmowy: "t.chlebowski.91@wp.pl",
    // Opcjonalnie: endpoint Formspree (np. "https://formspree.io/f/xxxx").
    // Puste = wysyłka przez mailto (bez usług zewnętrznych, zgodne z RODO).
    formspree_endpoint: "",
    // Link do polityki prywatności (RODO) — do podmiany na docelowy adres:
    polityka_prywatnosci_url: "polityka-prywatnosci.html"
  },

  /* --- Dane firmy (stopka oferty) — DO UZUPEŁNIENIA ------------------ */
  firma: {
    nazwa: "„TOM-KA” Instalacje Sanitarne — Tomasz Chlebowski",
    telefon: "723 878 628",
    email: "t.chlebowski.91@wp.pl",
    www: "tom-kainstalacjesanitarne.pl",
    adres: "Żerków / Środa Wielkopolska",
    nip: "",     // DO UZUPEŁNIENIA (jeśli ma się pojawiać na ofercie)
    regon: "",   // DO UZUPEŁNIENIA
    rachunek: "" // DO UZUPEŁNIENIA
  },

  /* --- Strefy dojazdu (dopłata KWOTOWA, dodawana w kroku 4 obliczeń) -- */
  strefy_dojazdu: [
    { id: "I",   nazwa: "Strefa I — do ok. 30 km od bazy",   doplata: 0,   przyklad: true }, // PRZYKŁAD – DO PODMIANY
    { id: "II",  nazwa: "Strefa II — do ok. 60 km od bazy",  doplata: 80,  przyklad: true }, // PRZYKŁAD – DO PODMIANY
    { id: "III", nazwa: "Strefa III — powyżej 60 km",        doplata: 160, przyklad: true }  // PRZYKŁAD – DO PODMIANY
  ],

  /* --- Modyfikatory (mnożniki i rabaty) ------------------------------ */
  modyfikatory: {
    // mnożniki z kroku 3 obliczeń (1.0 = brak dopłaty)
    pilnosc: {
      standard: { id: "standard", nazwa: "Termin standardowy", mnoznik: 1.0 },
      ekspres:  { id: "ekspres",  nazwa: "Ekspres (realizacja pilna)", mnoznik: 1.5, przyklad: true } // PRZYKŁAD – DO PODMIANY
    },
    weekend:  { nazwa: "Realizacja w weekend / poza godzinami", mnoznik: 1.3, przyklad: true }, // PRZYKŁAD – DO PODMIANY
    wysokosc: { nazwa: "Praca na wysokości / na dachu",         mnoznik: 1.2, przyklad: true }, // PRZYKŁAD – DO PODMIANY

    // rabaty (krok 5)
    rabat_pakietowy: {
      nazwa: "Rabat pakietowy (≥ 3 rodzaje kontroli w jednym zleceniu)",
      prog_rodzajow: 3,
      procent: 10, przyklad: true // PRZYKŁAD – DO PODMIANY
    },
    abonament: {
      nazwa: "Abonament roczny (obsługa cykliczna obiektu)",
      procent: 15, przyklad: true // PRZYKŁAD – DO PODMIANY
    }
  },

  /* --- Kategorie usług (do grupowania kart) -------------------------- */
  kategorie: [
    { id: "wentylacja",  nazwa: "Wentylacja i klimatyzacja" },
    { id: "gaz",         nazwa: "Instalacje gazowe i kominowe" },
    { id: "ppoz",        nazwa: "Ochrona przeciwpożarowa" },
    { id: "pomiary",     nazwa: "Pomiary i przeglądy" },
    { id: "energia",     nazwa: "Energia i środowisko" },
    { id: "sanitarne",   nazwa: "Instalacje sanitarne i nadzór" }
  ],

  /* --- Katalog usług -------------------------------------------------
     jednostka          — jednostka rozliczeniowa
     stawka_domyslna    — cena netto za jednostkę (PRZYKŁAD)
     minimum_pozycji    — minimalna wartość pozycji netto (PRZYKŁAD)
     przyklad           — true dopóki stawki są przykładowe
     indywidualna       — true => brak ceny w trybie A, prowadzi do kontaktu
     podstawa           — TYLKO z zatwierdzonej listy norm/przepisów
     czestotliwosc      — informacyjnie na karcie
     ilosc              — jak pobrać ilość w trybie A (pole, etykieta, z czego prefill)
     pola_dodatkowe     — dodatkowe informacje zbierane od klienta (nie liczą ceny w MVP)
     -------------------------------------------------------------------- */
  uslugi: [
    /* ---------------- WENTYLACJA ---------------- */
    {
      id: "went_dachowy", kategoria: "wentylacja",
      nazwa: "Przegląd wentylatora dachowego / kanałowego",
      opis_krotki: "Kontrola pracy, mocowań i parametrów wentylatora.",
      jednostka: "szt.", stawka_domyslna: 120, minimum_pozycji: 240, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "zwykle raz w roku",
      ilosc: { pole: "liczba_wentylatorow", etykieta: "Liczba wentylatorów", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "went_scienny", kategoria: "wentylacja",
      nazwa: "Przegląd wentylatora ściennego (z wymianą filtra)",
      opis_krotki: "Przegląd wentylatora ściennego wraz z wymianą filtra.",
      jednostka: "szt.", stawka_domyslna: 90, minimum_pozycji: 180, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "zwykle raz w roku",
      ilosc: { pole: "liczba_wentylatorow_sc", etykieta: "Liczba wentylatorów ściennych", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "went_centrala", kategoria: "wentylacja",
      nazwa: "Przegląd centrali wentylacyjnej",
      opis_krotki: "Przegląd i kontrola central wentylacyjnych.",
      jednostka: "szt.", stawka_domyslna: 350, minimum_pozycji: 350, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "zwykle raz w roku",
      ilosc: { pole: "liczba_central", etykieta: "Liczba central", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "klimatyzator", kategoria: "wentylacja",
      nazwa: "Przegląd klimatyzatora",
      opis_krotki: "Przegląd, czyszczenie i kontrola szczelności klimatyzatora.",
      jednostka: "szt.", stawka_domyslna: 150, minimum_pozycji: 150, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "zwykle raz w roku",
      ilosc: { pole: "liczba_klimatyzatorow", etykieta: "Liczba klimatyzatorów", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "pomiar_went", kategoria: "wentylacja",
      nazwa: "Pomiar skuteczności wentylacji",
      opis_krotki: "Pomiar wydajności/skuteczności wentylacji.",
      jednostka: "punkt pomiarowy / lokal", stawka_domyslna: 60, minimum_pozycji: 200, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "PN-EN 12599", czestotliwosc: "wg potrzeb / okresowo",
      ilosc: { pole: "liczba_punktow_went", etykieta: "Liczba punktów / lokali", domyslnie: 1, prefill: "liczba_lokali" },
      pola_dodatkowe: []
    },

    /* ---------------- GAZ / KOMINY ---------------- */
    {
      id: "gaz_szczelnosc", kategoria: "gaz",
      nazwa: "Kontrola szczelności instalacji gazowej",
      opis_krotki: "Okresowa kontrola szczelności instalacji gazowej.",
      jednostka: "lokal / pion", stawka_domyslna: 50, minimum_pozycji: 200, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "Prawo budowlane, art. 62", czestotliwosc: "raz w roku",
      ilosc: { pole: "liczba_lokali_gaz", etykieta: "Liczba lokali / pionów", domyslnie: 1, prefill: "liczba_lokali" },
      pola_dodatkowe: []
    },
    {
      id: "kominy", kategoria: "gaz",
      nazwa: "Kontrola przewodów kominowych",
      opis_krotki: "Kontrola drożności przewodów dymowych, spalinowych i wentylacyjnych.",
      jednostka: "przewód / lokal", stawka_domyslna: 25, minimum_pozycji: 150, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "Prawo budowlane, art. 62", czestotliwosc: "raz w roku",
      ilosc: { pole: "liczba_przewodow", etykieta: "Liczba przewodów / lokali", domyslnie: 1, prefill: "liczba_lokali" },
      pola_dodatkowe: []
    },

    /* ---------------- PPOŻ ---------------- */
    {
      id: "hydrant", kategoria: "ppoz",
      nazwa: "Przegląd hydrantu wewnętrznego",
      opis_krotki: "Roczny przegląd i kontrola hydrantu wewnętrznego.",
      jednostka: "szt.", stawka_domyslna: 40, minimum_pozycji: 160, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "PN-EN 671-3", czestotliwosc: "raz w roku",
      ilosc: { pole: "liczba_hydrantow", etykieta: "Liczba hydrantów", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "proba_wezy", kategoria: "ppoz",
      nazwa: "Próba ciśnieniowa węży hydrantowych",
      opis_krotki: "Próba ciśnieniowa węży (wykonywana co 5 lat).",
      jednostka: "szt.", stawka_domyslna: 35, minimum_pozycji: 140, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "PN-EN 671-3", czestotliwosc: "co 5 lat",
      ilosc: { pole: "liczba_wezy", etykieta: "Liczba węży", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "gasnica", kategoria: "ppoz",
      nazwa: "Przegląd gaśnicy",
      opis_krotki: "Okresowy przegląd gaśnicy wg zaleceń producenta.",
      jednostka: "szt.", stawka_domyslna: 15, minimum_pozycji: 90, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "raz w roku (wg zaleceń producenta)",
      ilosc: { pole: "liczba_gasnic", etykieta: "Liczba gaśnic", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "oswietlenie_aw", kategoria: "ppoz",
      nazwa: "Przegląd oświetlenia awaryjnego",
      opis_krotki: "Kontrola opraw oświetlenia awaryjnego i ewakuacyjnego.",
      jednostka: "oprawa", stawka_domyslna: 18, minimum_pozycji: 180, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "PN-EN 1838 / PN-EN 50172", czestotliwosc: "okresowo (min. raz w roku)",
      ilosc: { pole: "liczba_opraw", etykieta: "Liczba opraw", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "ssp", kategoria: "ppoz",
      nazwa: "Przegląd SSP / detekcji / GAZEX",
      opis_krotki: "Przegląd systemu sygnalizacji pożaru, detekcji gazu (GAZEX).",
      jednostka: "czujka / detektor / centrala", stawka_domyslna: 25, minimum_pozycji: 250, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "PN-EN 54", czestotliwosc: "okresowo wg DTR",
      ilosc: { pole: "liczba_elementow_ssp", etykieta: "Liczba czujek / detektorów", domyslnie: 1 },
      pola_dodatkowe: [
        { id: "typ_systemu", etykieta: "Typ systemu", typ: "select", opcje: ["SSP", "Detekcja gazu / GAZEX", "Mieszany"] }
      ]
    },

    /* ---------------- POMIARY / PRZEGLĄDY ---------------- */
    {
      id: "pomiary_el", kategoria: "pomiary",
      nazwa: "Okresowe pomiary elektryczne",
      opis_krotki: "Pomiary ochronne instalacji elektrycznej.",
      jednostka: "obwód / rozdzielnica / lokal", stawka_domyslna: 20, minimum_pozycji: 250, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "PN-HD 60364-6", czestotliwosc: "nie rzadziej niż co 5 lat",
      ilosc: { pole: "liczba_obwodow", etykieta: "Liczba obwodów / rozdzielnic", domyslnie: 1 },
      pola_dodatkowe: [
        { id: "liczba_rozdzielnic", etykieta: "Liczba rozdzielnic", typ: "number" }
      ]
    },
    {
      id: "budowlany_1", kategoria: "pomiary",
      nazwa: "Przegląd budowlany roczny",
      opis_krotki: "Roczny przegląd stanu technicznego obiektu.",
      jednostka: "obiekt", stawka_domyslna: 600, minimum_pozycji: 600, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "Prawo budowlane, art. 62", czestotliwosc: "raz w roku",
      ilosc: { pole: "liczba_obiektow_1", etykieta: "Liczba obiektów", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "budowlany_5", kategoria: "pomiary",
      nazwa: "Przegląd budowlany 5-letni",
      opis_krotki: "Pięcioletni przegląd stanu technicznego i przydatności obiektu.",
      jednostka: "obiekt", stawka_domyslna: 1500, minimum_pozycji: 1500, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "Prawo budowlane, art. 62", czestotliwosc: "co 5 lat",
      ilosc: { pole: "liczba_obiektow_5", etykieta: "Liczba obiektów", domyslnie: 1 },
      pola_dodatkowe: []
    },

    /* ---------------- ENERGIA / ŚRODOWISKO ---------------- */
    {
      id: "kociol", kategoria: "energia",
      nazwa: "Kontrola systemu ogrzewania (wg mocy kotła)",
      opis_krotki: "Ocena efektywności energetycznej kotła / systemu ogrzewania.",
      jednostka: "kocioł", stawka_domyslna: 300, minimum_pozycji: 300, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "okresowo",
      ilosc: { pole: "liczba_kotlow", etykieta: "Liczba kotłów", domyslnie: 1 },
      pola_dodatkowe: [
        { id: "moc_kW", etykieta: "Moc kotła [kW]", typ: "number" },
        { id: "rodzaj_paliwa", etykieta: "Rodzaj paliwa", typ: "select", opcje: ["gaz", "olej", "biomasa / pellet", "węgiel", "inne"] }
      ]
    },
    {
      id: "klima_system", kategoria: "energia",
      nazwa: "Kontrola systemu klimatyzacji (> 12 kW)",
      opis_krotki: "Ocena efektywności energetycznej systemu klimatyzacji > 12 kW.",
      jednostka: "system", stawka_domyslna: 400, minimum_pozycji: 400, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "okresowo",
      ilosc: { pole: "liczba_systemow_klima", etykieta: "Liczba systemów", domyslnie: 1 },
      pola_dodatkowe: [
        { id: "moc_klima_kW", etykieta: "Moc systemu [kW]", typ: "number" }
      ]
    },
    {
      id: "swiadectwo", kategoria: "energia",
      nazwa: "Świadectwo charakterystyki energetycznej",
      opis_krotki: "Sporządzenie świadectwa charakterystyki energetycznej.",
      jednostka: "lokal / budynek", stawka_domyslna: 500, minimum_pozycji: 500, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "jednorazowo / wg potrzeb",
      ilosc: { pole: "liczba_swiadectw", etykieta: "Liczba lokali / budynków", domyslnie: 1 },
      pola_dodatkowe: []
    },
    {
      id: "ekspertyza", kategoria: "energia",
      nazwa: "Inwentaryzacja / ekspertyza techniczna",
      opis_krotki: "Inwentaryzacja lub ekspertyza techniczna (rozliczenie za roboczogodzinę).",
      jednostka: "rbh", stawka_domyslna: 150, minimum_pozycji: 300, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "wg potrzeb",
      ilosc: { pole: "liczba_rbh_eksp", etykieta: "Szacowana liczba roboczogodzin", domyslnie: 2 },
      pola_dodatkowe: []
    },

    /* ---------------- SANITARNE / NADZÓR ---------------- */
    {
      id: "nadzor", kategoria: "sanitarne",
      nazwa: "Nadzór inwestorski",
      opis_krotki: "Nadzór inwestorski nad realizacją prac (rbh / miesiąc).",
      jednostka: "rbh", stawka_domyslna: 180, minimum_pozycji: 360, przyklad: true, // PRZYKŁAD – DO PODMIANY
      podstawa: "", czestotliwosc: "wg umowy",
      ilosc: { pole: "liczba_rbh_nadzor", etykieta: "Szacowana liczba roboczogodzin", domyslnie: 4 },
      pola_dodatkowe: []
    },
    {
      id: "montaz_san", kategoria: "sanitarne",
      nazwa: "Montaż instalacji sanitarnych",
      opis_krotki: "Montaż instalacji sanitarnych — wycena indywidualna po oględzinach.",
      jednostka: "—", stawka_domyslna: 0, minimum_pozycji: 0, przyklad: false,
      indywidualna: true,               // brak ceny w trybie A -> formularz kontaktowy
      podstawa: "", czestotliwosc: "—",
      ilosc: null,
      pola_dodatkowe: [
        { id: "opis_zakresu", etykieta: "Krótki opis zakresu montażu", typ: "textarea" }
      ]
    }
  ]
};
