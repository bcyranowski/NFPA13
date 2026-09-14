# TOM-KA Wycena — aplikacja do wycen

Statyczna aplikacja (HTML/CSS/JS, bez build-stepu, bez backendu) do szybkiej wyceny
usług przeglądowo-pomiarowych i instalacyjnych. Do wgrania na zwykły hosting przez FTP.

## Dwa tryby

- **Tryb A — publiczny kalkulator** (`index.html`)
  Kreator krok po kroku dla klienta/zarządcy. Pokazuje **widełki orientacyjne** ceny
  (nie pokazuje stawek jednostkowych) i kończy się formularzem kontaktowym, który wysyła
  komplet parametrów obiektu na e-mail TOM-KA.

- **Tryb B — panel wewnętrzny** (`panel.html`)
  Lista wycen, edytor pozycji z podglądem sumy na żywo, generator oferty PDF, duplikowanie
  wycen i edycja cennika. Dostęp chroniony prostym PIN-em (patrz niżej).

## Struktura plików

```
tom-ka-wycena/
├─ index.html                 # Tryb A — kalkulator publiczny
├─ panel.html                 # Tryb B — panel wewnętrzny
├─ polityka-prywatnosci.html  # szablon polityki prywatności (RODO)
├─ cennik.js                  # >>> STAWKI I MODYFIKATORY — jedyny plik do edycji cen <<<
└─ assets/
   ├─ styles.css              # style i identyfikacja wizualna TOM-KA
   ├─ shared.js               # logo, pomocniki
   ├─ calc.js                 # silnik obliczeń (kolejność wg brief 6.3)
   ├─ public.js               # logika trybu A
   ├─ panel.js                # logika trybu B
   └─ fonts/                  # (do dodania) Caladea + Carlito
```

## Uruchomienie / wgranie

1. Skopiuj cały folder `tom-ka-wycena/` na hosting (FTP) — np. do katalogu
   `.../wycena/` na `tom-kainstalacjesanitarne.pl`.
2. Kalkulator publiczny: `.../wycena/index.html`
   Panel wewnętrzny: `.../wycena/panel.html`
3. Działa też lokalnie — wystarczy otworzyć `index.html` w przeglądarce (dane wczytywane
   z `cennik.js`, bez potrzeby serwera).

## >>> DO UZUPEŁNIENIA <<<

### 1. Stawki i modyfikatory — `cennik.js`
**Wszystkie kwoty w `cennik.js` są PRZYKŁADOWE** (oznaczone `// PRZYKŁAD – DO PODMIANY`
oraz polem `"przyklad": true`). Dopóki tak jest, aplikacja wyświetla ostrzeżenie
„stawki przykładowe”. Po wpisaniu prawdziwych stawek zmień `"przyklad"` na `false`
przy danej pozycji (lub odznacz „Przykładowa?” w panelu → Ustawienia).

- Nie wpisuj zmyślonych cen. Jeśli nie znasz stawki — wpisz `0`; aplikacja pokaże
  „stawka do uzupełnienia” zamiast liczby.
- Stawki można też zmieniać z poziomu panelu (**Ustawienia / cennik**) — zapisują się
  w pamięci przeglądarki i nadpisują plik. Zmiana na stałe dla wszystkich = edycja `cennik.js`.

### 2. Dane firmy — `cennik.js` → `firma`
Uzupełnij NIP, REGON, numer rachunku (jeśli mają być na ofercie).

### 3. PIN do panelu — `assets/panel.js`
Na górze pliku: `var PIN = "tomka";` — zmień na własny.
To prosty dostęp po stronie przeglądarki, **nie pełne logowanie** (do tego potrzebny
byłby backend — poza zakresem MVP).

### 4. Wysyłka zapytań — `cennik.js` → `meta`
Domyślnie zapytanie otwiera program pocztowy (`mailto:`) z gotową treścią na
`email_firmowy`. Opcjonalnie możesz wpisać `formspree_endpoint` (adres z Formspree),
żeby wysyłać bez otwierania poczty — pamiętaj wtedy uzupełnić politykę prywatności.

### 5. Logo i fonty
- Logo: obecnie jest zastępczy symbol SVG. Podmień na dostarczony PNG w
  `assets/shared.js` (funkcja `logoSVG`) lub wstaw `<img src="assets/logo-tomka.png">`.
- Fonty Caladea (nagłówki) + Carlito (treść): wgraj pliki do `assets/fonts/` i odkomentuj
  bloki `@font-face` na górze `assets/styles.css`. Do czasu wgrania używane są zgodne
  metrycznie zamienniki (Cambria/Calibri), więc wygląd jest bardzo zbliżony.

### 6. Polityka prywatności (RODO)
`polityka-prywatnosci.html` to **szablon** — uzupełnij dane administratora i zweryfikuj treść.

## Zasady wbudowane w aplikację

- Ceny wyłącznie z `cennik.js` — brak wartości = komunikat „do uzupełnienia”, nigdy
  zmyślona liczba.
- Wynik w trybie A jest orientacyjny — przy wyniku obowiązkowa klauzula, że nie stanowi
  oferty w rozumieniu Kodeksu cywilnego.
- Podstawy prawne / normy tylko z zatwierdzonej listy (Prawo budowlane art. 62, PN-EN 12599,
  PN-HD 60364-6, PN-EN 1838/50172, PN-EN 54, PN-EN 671-3).
- Brak zewnętrznych skryptów śledzących; zgoda RODO wymagana w formularzu.

## Kolejność obliczeń (brief 6.3)

```
1. cena_pozycji  = max(stawka × ilość, minimum_pozycji)
2. suma_pozycji  = Σ cena_pozycji
3. po_mnoznikach = suma × ekspres × weekend × wysokość
4. po_dojazdzie  = po_mnoznikach + dopłata_strefowa
5. po_rabacie    = po_dojazdzie × (1 − rabat%)
6. netto         = po_rabacie          (zaokrąglenie do pełnych zł, w górę)
7. brutto        = netto × (1 + VAT)
8. widełki (tryb A) = netto ± % (domyślnie ±15%)
```
