# Claude Code w pracy inżyniera instalacji sanitarnych — research (stan: 11.10.2026)

> Zakres: przedmiarowanie, kosztorysowanie i analiza dokumentacji IS/HVAC przy użyciu Claude Code.
> Metoda: wyszukiwanie w sieci (dokumentacja Anthropic, GitHub, katalogi MCP, dokumentacja bibliotek, publikacje naukowe) + analiza Twoich istniejących skilli Claude (`kosztorys-sanitarny`, `obmiar-z-dwg`, `kosztorys-norma-ath`, `analiza-dokumentacji-is`, `komparator-ofert-is`, `kontrola-przed-wysylka`).
> **Nie przeprowadziłem testów na Twoich plikach.** Wszystkie „oszczędności czasu” są szacunkami eksperckimi, nie pomiarami — wyraźnie to oznaczam.

## Legenda

| Znak | Znaczenie |
|---|---|
| 🟢 | **Potwierdzone** — istnieją działające narzędzia i przykłady (w tym Twoje skille, które już działają na realnych projektach) |
| 🟡 | **Możliwe technicznie** — wymaga integracji, skryptu lub własnego rozwiązania; brak gotowca „z pudełka” |
| 🔴 | **Niepotwierdzone / niewiarygodne w praktyce** |
| **N** | funkcja **natywna** Claude Code (bez instalowania czegokolwiek) |
| **P** | wymaga **bibliotek Python / narzędzi CLI** (pip/apt) |
| **M** | wymaga **serwera MCP** |
| **CAD** | wymaga **aplikacji CAD** (AutoCAD/BricsCAD) lub konwertera |
| *szac.* | oszacowanie oszczędności czasu — **bez danych z pomiarów** |

---

## 0. Najważniejsze wnioski (TL;DR)

1. **Masz już ok. 60% Wariantu B.** Twoje skille realizują pełny łańcuch: analiza dokumentacji → obmiar z DWG (LibreDWG + parser DXF) → budowa `.ath` dla Kobry/Normy → wgrywanie cen → audyt. Najwięcej da teraz nie nowy system, tylko **domknięcie trzech luk**: (a) system cytowania źródeł każdej ilości, (b) automatyczny audyt przedmiaru w Excelu, (c) porównanie rewizji.
2. **Claude „na oko” nie mierzy rysunków.** Benchmark AECV-Bench (styczeń 2026) pokazuje, że modele multimodalne (w tym Claude) dobrze czytają **tekst** z rysunków (do ~0,95 trafności), ale **liczenie symboli** to tylko ~0,40–0,55 trafności dokładnej. Wniosek: ilości muszą pochodzić z **geometrii wektorowej (DXF/PDF) lub z tekstu (etykiety, zestawienia)**, a model ma tylko orkiestrować skrypty i interpretować wyniki. 🟢 (źródło: [AECV-Bench, arXiv 2601.04819](https://arxiv.org/abs/2601.04819))
3. **DWG/DXF to najlepsze źródło ilości** — długości po warstwach, bloki, atrybuty, etykiety średnic. Działa bez AutoCAD (ezdxf + LibreDWG/ODA). Twój skill `obmiar-z-dwg` to potwierdza na realnym projekcie. 🟢
4. **PDF wektorowy** — długości są możliwe (PyMuPDF `get_drawings()` + kalibracja skali), ale rozdzielenie „która linia to który kanał/rura” jest trudne. 🟡. **Skan rastrowy** — praktycznie tylko OCR tekstu i liczenie wspomagane; długości 🔴.
5. **Nie ma oficjalnego serwera MCP dla AutoCAD.** Autodesk publikuje MCP dla Revit, Model Data Explorer i Fusion; AutoCAD obsługują wyłącznie projekty społecznościowe (najpopularniejszy `puran-water/autocad-mcp`, 557★). 🟡
6. **Format Normy (.ath)** nie ma publicznej specyfikacji. Twój skill ma go rozpracowanego (CP1250, CRLF, sekcje `[POZYCJA]`, `[RMS n]`, suma kontrolna zerowana) i działa z importem do Kobry — to rzadkie i cenne know-how. CSV **nie jest** kosztorysem. 🟢 (Twoja praktyka) / 🔴 (publiczna dokumentacja)

---

## 1. Co Claude Code potrafi natywnie, a co wymaga dodatków (październik 2026)

### 1.1 Funkcje natywne (potwierdzone w dokumentacji Anthropic)

| Funkcja | Co daje inżynierowi IS | Źródło |
|---|---|---|
| Odczyt plików (tekst, **PDF**, obrazy) | czytanie opisów, specyfikacji, rysunków PDF jako obraz; PDF czytany stronami (do 20 stron na wywołanie) | [Overview](https://code.claude.com/docs/en/overview) |
| Bash/PowerShell + uruchamianie Pythona | to jest „silnik” całej automatyzacji: pandas, openpyxl, PyMuPDF, ezdxf uruchamiane przez Claude | [Overview](https://code.claude.com/docs/en/overview) |
| `CLAUDE.md` + auto memory | stałe reguły firmy: jednostki, KNR, struktura działów, nazewnictwo, „nie zmyślaj ilości” | [Memory](https://code.claude.com/docs/en/memory) |
| **Skills** (`SKILL.md` + skrypty) | powtarzalne procedury (np. Twoje `obmiar-z-dwg`); `${CLAUDE_SKILL_DIR}` dla skryptów, `context: fork` do uruchomienia w subagencie, `allowed-tools` | [Skills](https://code.claude.com/docs/en/skills) |
| **Subagenci** | równoległa analiza wielu plików w osobnym kontekście (np. 1 agent = 1 branża) | [Sub-agents](https://code.claude.com/docs/en/sub-agents) |
| **Hooks** | deterministyczne kontrole po każdym zapisie pliku (np. walidacja `.ath`/`.xlsx`), niezależne od „woli” modelu | [Hooks](https://code.claude.com/docs/en/hooks) |
| **MCP** | podłączanie zewnętrznych narzędzi: CAD, Excel na żywo, IFC | [MCP](https://code.claude.com/docs/en/mcp) |
| Plugins / marketplace | paczki skilli+hooków+MCP do instalacji jedną komendą | [Skills](https://code.claude.com/docs/en/skills) |
| Tryb nienadzorowany `claude -p` | wsadowe przetwarzanie folderów, uruchamianie z harmonogramu | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| Routines / Desktop scheduled tasks | cykliczne zadania (np. codzienny raport, nocna analiza nowych rewizji); zadania Desktop mają dostęp do lokalnych plików | [Routines](https://code.claude.com/docs/en/routines), [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks) |
| Agent SDK | budowa własnego agenta (np. aplikacja „Weryfikator przedmiaru” dla zespołu) | [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) |
| Windows natywnie | instalacja na Windows (zalecany Git for Windows); ważne dla COM: AutoCAD/Excel | [Overview](https://code.claude.com/docs/en/overview) |

**Uwaga o skillach dokumentowych:** gotowe skille Anthropic `xlsx`, `docx`, `pdf`, `pptx` są w repo [anthropics/skills](https://github.com/anthropics/skills) i instaluje się je w Claude Code jako plugin:
```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
```
Są „source-available” (nie open source) i — wg README — przeznaczone do demonstracji; trzeba je przetestować przed krytycznym użyciem. Ty masz je już zsynchronizowane z claude.ai.

**Osobny produkt:** *Claude for Excel* (dodatek do Excela) — według źródeł wtórnych beta od X 2025, GA od 7.05.2026 dla płatnych planów ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/2143/claude-microsoft-365-outlook-beta), [the-decoder](https://the-decoder.com/anthropic-activates-claudes-excel-integration-for-all-pro-subscribers)). To nie jest Claude Code, ale dobrze uzupełnia go przy ręcznej pracy w arkuszu. Daty potwierdź na stronie Anthropic.

### 1.2 Co wymaga dodatków

| Potrzeba | Narzędzie | Typ | Status |
|---|---|---|---|
| Wektory i tekst z PDF ze współrzędnymi | PyMuPDF (`get_drawings()`, `get_text('words')`), pdfplumber, `pdftotext -layout` | P | 🟢 |
| Tabele z PDF | pdfplumber, Camelot, Docling | P | 🟢 (tabele tekstowe) |
| OCR skanów | Tesseract / OCRmyPDF (skill `pdf` to obsługuje) | P | 🟢 tekst, 🔴 geometria |
| DWG → DXF | LibreDWG (`dwg2dxf`), ODA File Converter | P/CAD | 🟢 |
| Odczyt DXF | ezdxf (lub Twój strumieniowy parser dla plików 400+ MB) | P | 🟢 |
| AutoCAD na żywo | `puran-water/autocad-mcp`, `Porta048/AutoCad-MCP`, `multiCAD-mcp` (COM/AutoLISP) | M+CAD | 🟡 |
| Excel na żywo (Power Query, makra) | `sbroenne/mcp-server-excel`, `mcp-server-xlwings` | M | 🟡 |
| Pliki Excel bez Excela | openpyxl, pandas, `excel-mcp-server` | P/M | 🟢 |
| Model IFC | IfcOpenShell (+ `ifcmcp`) | P/M | 🟡 |
| Obliczenia hydrauliczne | `fluids`, CoolProp, `hvac_pressure` | P | 🟢 biblioteki, 🟡 zastosowanie |
| Wykrywanie symboli (CV) | YOLO (np. YOLOplan) + własne dane treningowe | P | 🟡/🔴 |

---

## 2. 32 konkretne zastosowania

Kolumny: **Proces** = jak działa; **We → dane → wynik**; **Typ** = N/P/M/CAD (patrz legenda); **Gotowe** = czy istnieje gotowe rozwiązanie; **Trudność** 1–5; **Oszczędność** = *szac.* względem pracy ręcznej, bez pomiarów.

### 2.1 Excel, przedmiary, kosztorysy

| # | Zastosowanie | Proces | We → dane → wynik | Typ | Gotowe | Tr. | Oszcz. *szac.* | Ograniczenia / ryzyko |
|---|---|---|---|---|---|---|---|---|
| 1 🟢 | **Audyt przedmiaru** (jednostki, duplikaty, puste ilości, sumy) | pandas czyta wszystkie arkusze → reguły (np. rura w `szt`, kanał w `m` bez wymiaru, kształtki w `m`) → raport | XLSX → pozycje, jm, ilości → XLSX z kolorowaniem + lista uwag | N+P | częściowo (skill `xlsx`, Twój `kontrola-przed-wysylka`) | 2 | 50–80% czasu kontroli | reguły trzeba spisać raz; scalone komórki i „kreatywne” arkusze projektantów |
| 2 🟢 | **Ujednolicenie struktury kosztorysu** (działy, numeracja, nazwy) | mapowanie nazw do słownika działów (wod-kan, c.o., went., ppoż) → nowa struktura | XLSX → pozycje → XLSX wg szablonu firmy | N+P | nie | 2 | 60–80% | błędne przypisanie przy nietypowych nazwach → kolumna „pewność” |
| 3 🟢 | **Wykrywanie błędnych jednostek** | słownik „element → dopuszczalne jm” + heurystyki (np. izolacja w m vs m²) | XLSX → konflikty jm → lista | N+P | nie | 1 | 70% | wyjątki branżowe (np. izolacja otulinowa w m) — słownik musi je znać |
| 4 🟢 | **Wykrywanie brakujących pozycji** (checklista kompletności) | szablon „co musi być” dla każdej instalacji (próby, płukanie, dezynfekcja, oznakowanie, regulacja, rozruch, przejścia ppoż, podpory) → porównanie | XLSX + checklista → brakujące → raport | N+P | nie (do zbudowania z Twoich doświadczeń) | 2 | wysoka wartość, czas 30–50% | checklista = know-how firmy; model może proponować, decyzja Twoja |
| 5 🟢 | **Przypisanie KNR do pozycji** | dopasowanie do bazy (Twój skill: baza Kobry) → propozycja + uzasadnienie | XLSX/JSON → KNR, tablica, kolumna → `.ath` | P | **tak — Twój `kosztorys-norma-ath`** | 3 | 50–70% | dobór kolumny wg średnicy/materiału bywa niejednoznaczny; zawsze lista do akceptacji |
| 6 🟢 | **Generowanie `.ath` do Normy/Kobry** | `items.json` + `prices.json` → generator → weryfikacja (CP1250, suma kontrolna, osierocone zasoby) | JSON → pozycje+RMS → `.ath` | P | **tak — Twój skill** | 4 | 60–80% przepisywania | brak publicznej specyfikacji formatu; wymaga pliku-wzorca; test importu w programie obowiązkowy |
| 7 🟢 | **Wgrywanie cen z ofert do kosztorysu** | mapowanie pozycji oferty ↔ pozycji kosztorysu → podmiana ceny materiału z zachowaniem R/S | oferty PDF/XLSX → ceny → `.ath`/XLSX | P | **tak — Twoje skille** | 3 | 50–70% | błędne mapowanie podobnych pozycji (np. DN25 vs DN32) — wymaga tabeli mapowania do akceptacji |
| 8 🟢 | **Porównanie ofert podwykonawców** | normalizacja ofert do przedmiaru referencyjnego → tabela, braki, odchylenia od mediany | 2+ oferty → ceny/zakresy → XLSX porównawczy | P | **tak — `komparator-ofert-is`** | 2 | skill deklaruje 1–2 h → ~10 min (deklaracja, nie pomiar) | oferty ryczałtowe bez rozbicia; „w cenie” vs „poza zakresem” w przypisach |
| 9 🟢 | **Generowanie zapytań ofertowych (RFQ)** | z przedmiaru wycinany zakres + wymagania z STWiOR → pismo + załącznik XLSX do wypełnienia | XLSX + DOCX → zakres, parametry → DOCX + XLSX | N+P | częściowo (skille `docx`, `xlsx`) | 1 | 70% | trzeba pilnować, by parametry techniczne były cytowane, nie „wymyślane” |
| 10 🟢 | **Raport ryzyk kosztowych** | reguły: pozycje bez ilości, „wg projektu”, ryczałty, ceny odstające, zapisy umowne (kary, waloryzacja) → ranking | XLSX + umowa/STWiOR → ryzyka → XLSX/DOCX | N+P | nie | 2 | 40–60% | ocena kwot ryzyka = Twoja; model jedynie sygnalizuje |
| 11 🟢 | **Kalkulator narzutów i wariantów ceny** | arkusz z formułami (R, M, S, Kp, Z) generowany przez openpyxl z formułami, nie wartościami | parametry → arkusz z formułami | P | częściowo (skill `xlsx`) | 1 | jednorazowo | openpyxl zapisuje formuły, ale **nie przelicza** — wartości po otwarciu w Excelu (lub LibreOffice headless) |
| 12 🟡 | **Eksport do programu kosztorysowego innego niż Norma** | CSV/XLSX wg szablonu importu programu | XLSX → CSV | P | nie | 2 | 30% | CSV ≠ kosztorys: przenosi pozycje i ilości, **nie** nakłady RMS, KNR-y ani narzuty |

### 2.2 Analiza dokumentacji (PDF, DOCX)

| # | Zastosowanie | Proces | We → dane → wynik | Typ | Gotowe | Tr. | Oszcz. *szac.* | Ograniczenia / ryzyko |
|---|---|---|---|---|---|---|---|---|
| 13 🟢 | **Inwentaryzacja folderu projektu** (lista rysunków, branże, rewizje, brakujące pliki) | listowanie plików + odczyt tabliczek rysunkowych (tekst z PDF po współrzędnych) | folder → nr rys., tytuł, rewizja, data, skala → XLSX „rejestr dokumentacji” | N+P | częściowo (Twój `analiza-dokumentacji-is`) | 1 | 70–90% | tabliczki o nietypowym układzie; skany |
| 14 🟢 | **Ekstrakcja zestawień urządzeń z PDF** (centrale, wentylatory, pompy, kotły) | pdfplumber/Docling → tabele → normalizacja | PDF → typ, parametry, ilość → XLSX | P | częściowo | 2 | 60–80% | tabele narysowane liniami CAD (nie tabele tekstowe) wymagają ekstrakcji po współrzędnych słów |
| 15 🟢 | **Streszczenie opisu technicznego/STWiOR do „karty zakresu”** | DOCX/PDF → sekcje → wymagania (materiały, próby, izolacje, granice zakresu) | DOCX → wymagania z cytatem i nr strony → XLSX/MD | N | tak (natywnie + skill `docx`) | 1 | 50–70% | ryzyko pominięcia zapisu w załączniku — wymagana lista przeczytanych plików |
| 16 🟢 | **Krzyżowa kontrola opis ↔ rysunki ↔ przedmiar** | rejestr faktów z cytatami (patrz §6) → porównanie liczności i parametrów | wszystkie dokumenty → rozbieżności z lokalizacją → XLSX | N+P | częściowo (Twój skill wykrywa rozbieżności, ale bez systemu cytowań) | 3 | 40–60% | jakość = jakość ekstrakcji z rysunków; liczności z rzutów tylko z DWG/etykiet |
| 17 🟢 | **Pytania do projektanta / inwestora** | z listy rozbieżności i braków → pytania z odnośnikiem do dokumentu | raport rozbieżności → DOCX/XLSX | N | **tak — Twój skill** | 1 | 70% | pytania „ogólnikowe” — wymuś szablon: dokument/strona/co/dlaczego/wpływ na koszt |
| 18 🟡 | **Weryfikacja zgodności z wymaganiami inwestora** (wytyczne, standardy materiałowe) | wytyczne → lista wymagań → sprawdzenie w opisie/zestawieniach | PDF/DOCX → niezgodności | N | nie | 2 | 30–50% | interpretacja wymagań funkcjonalnych — decyzja człowieka |
| 19 🟡 | **Wykrywanie potencjalnych błędów projektowych** (np. średnica za mała dla liczby przyborów, prędkość w kanale) | dane z zestawień → obliczenia kontrolne (pkt 27–29) → odstępstwa | zestawienia + rzuty → sygnały → lista | P | nie | 3 | — (wartość jakościowa) | to **sygnały do sprawdzenia**, nie diagnoza; brak pełnych danych wejściowych |
| 20 🟢 | **Kontrola kompletności dokumentacji powykonawczej/odbiorowej** | checklista (protokoły prób, DTR, deklaracje, atesty PZH, pomiary) ↔ zawartość folderu | folder → braki → XLSX | N+P | nie | 1 | 60–80% | rozpoznanie typu dokumentu po treści, nie po nazwie pliku |

### 2.3 Rysunki: DWG/DXF i PDF

| # | Zastosowanie | Proces | We → dane → wynik | Typ | Gotowe | Tr. | Oszcz. *szac.* | Ograniczenia / ryzyko |
|---|---|---|---|---|---|---|---|---|
| 21 🟢 | **Długości rurociągów wg warstw** (DWG/DXF) | DWG→DXF (LibreDWG/ODA) → suma LINE/LWPOLYLINE/ARC po warstwie → m | DWG → m na warstwę → XLSX | P | **tak — Twój `obmiar-z-dwg`** | 3 | 70–90% vs ręczny obmiar | warstwy xref architektury dają fałszywe metry; jednostki; piony na rzutach nie mają długości |
| 22 🟡 | **Przypisanie średnic do odcinków** | najbliższa etykieta tekstowa do środka odcinka, filtr sensownych DN | DXF → m na średnicę → XLSX | P | tak (Twój skill), ale **orientacyjnie** | 3 | 50–70% | etykiety wspólne dla kilku instalacji; Twoja praktyka: łączna długość pewna, rozbicie na DN orientacyjne |
| 23 🟢 | **Zliczanie bloków i atrybutów** (grzejniki, hydranty, wpusty, nawiewniki, klapy ppoż) | INSERT wg nazwy bloku + ATTRIB → licznik per typ/kondygnacja | DWG → szt. per typ → XLSX | P | tak (ezdxf, Twój skill) | 2 | 80–95% | bloki odniesienia (oznaczenia pionów) ≠ urządzenia — Twój przypadek: 15 etykiet „HP33” vs 6 hydrantów |
| 24 🟡 | **Kanały wentylacyjne z DWG** (prostokątne/okrągłe, m, m²) | warstwy kanałów + etykiety „400x200”/„Ø250” → długość osi × obwód | DWG → m i m² per wymiar → XLSX | P | nie | 4 | 50–70% | kanały rysowane dwiema liniami (krawędzie) zamiast osią — trzeba sparować krawędzie lub liczyć z etykiet; obiekty AutoCAD MEP mogą być niewidoczne dla ezdxf (patrz §4) |
| 25 🟡 | **Porównanie rewizji DWG** (co doszło/ubyło) | dwa DXF → zestawienie warstw/bloków/długości → różnice | 2×DWG → Δ ilości → XLSX „zmiany kosztowe” | P | nie (brak gotowego DXF-diff open source) | 3 | 60–80% przy dużych zmianach | różnice geometryczne „kosmetyczne” (przesunięcia) — porównuj **ilości**, nie uchwyty |
| 26 🟡 | **Długości z PDF wektorowego** | PyMuPDF `get_drawings()` → filtr (kolor, grubość, styl linii) → suma × skala | PDF → m per „styl linii” → XLSX | P | częściowo (OpenTakeoff: `set_scale`, `measure_line`) | 4 | 30–60% | brak warstw; dopasowanie stylu linii do instalacji; tekst i kreskowania jako wektory; skala per arkusz/rzut |
| 27 🟡 | **Zliczanie etykiet z PDF wektorowego** (np. „N1”, „W2”, „KPP”) | `get_text('words')` → wyrażenia regularne → deduplikacja po współrzędnych | PDF → szt. per oznaczenie → XLSX z nr strony | P | nie | 2 | 50–70% | etykiety zbiorcze („4×N1”), symbole bez etykiet nie zostaną policzone |
| 28 🔴 | **Liczenie symboli na skanie / „na oko” przez model** | wizja modelu na renderze strony | PNG → szt. | N | — | 1 | — | AECV-Bench: liczenie symboli 0,40–0,55 trafności — **nie używać do przedmiaru** |

### 2.4 Obliczenia, raporty, aplikacje

| # | Zastosowanie | Proces | We → dane → wynik | Typ | Gotowe | Tr. | Oszcz. *szac.* | Ograniczenia / ryzyko |
|---|---|---|---|---|---|---|---|---|
| 29 🟢 | **Kalkulator strat ciśnienia (woda, c.o.)** | `fluids` (Darcy–Weisbach, Colebrook, współczynniki K) → arkusz/skrypt | DN, przepływ, długość, kształtki → Δp, v | P | biblioteki tak | 2 | szybka weryfikacja doboru | wynik zależy od założonych K; to kontrola, nie projekt |
| 30 🟢 | **Kontrola prędkości i spadków w kanałach** | `hvac_pressure` (Darcy–Weisbach + ASHRAE 2009 dla kształtek) | wymiar, V̇ → v, Δp/m → lista przekroczeń | P | biblioteka tak | 2 | j.w. | wartości ASHRAE ≠ katalog producenta |
| 31 🟢 | **Generowanie protokołów** (próby szczelności, płukanie, odbiory) | szablon DOCX + dane z pomiarów (XLSX/CSV) → protokoły seryjnie | XLSX pomiarów → DOCX/PDF | N+P | tak (skill `docx`) | 1 | 70–90% przy seriach | treść wymagań wg PN/WTWiO — szablon zatwierdza człowiek |
| 32 🟢 | **Małe aplikacje inżynierskie** (kalkulator izolacji, doboru naczynia wzbiorczego, przelicznik m→m² kanałów) | Claude pisze HTML/Python → test → użycie | parametry → wynik | N | nie (szybko do zrobienia) | 1 | — | weryfikacja wzorów na przykładzie z literatury przed użyciem |

**Podsumowanie typów:** natywnie (N) da się zrobić ok. 1/3 rzeczy (czytanie, streszczanie, pisanie dokumentów). Wszystko, co dotyczy **liczb** (ilości, sumy, porównania), powinno iść przez **skrypty (P)** — wynik jest wtedy powtarzalny i sprawdzalny. MCP i CAD są potrzebne tylko do pracy „na żywo” w AutoCAD/Excelu.

---

## 3. Automatyczne przedmiarowanie z PDF

### 3.1 Najważniejsze rozróżnienie: PDF wektorowy vs skan

| Cecha | PDF wektorowy (wydruk z CAD) | Skan rastrowy |
|---|---|---|
| Tekst (etykiety, tabelki, legendy) | dostępny bezpośrednio ze współrzędnymi (`get_text('words')`) 🟢 | tylko OCR (Tesseract) — błędy w średnicach typu `Ø110`/`0110`, `DN5O` 🟡 |
| Linie (trasy) | dostępne jako ścieżki: odcinki, krzywe Béziera, prostokąty + kolor, grubość, styl kreskowania ([PyMuPDF](https://pymupdf.readthedocs.io/en/latest/recipes-drawing-and-graphics.html)) 🟡 | tylko wektoryzacja obrazu — w praktyce 🔴 |
| Warstwy CAD | zwykle **utracone** (czasem jako „Optional Content Groups”, jeśli drukarka PDF je zachowała) | brak |
| Skala | z opisu skali + kalibracja na znanym wymiarze 🟡 | j.w., plus zniekształcenia skanu 🔴 |
| Wniosek | ilości możliwe dla **tekstu i etykiet**; długości — półautomatycznie z kontrolą | do przedmiaru tylko jako podgląd; poproś o DWG lub PDF wektorowy |

**Czy Claude Code sam zmierzy długość na rysunku?** Nie w sensie „patrzenia”. Model widzi render strony jak obraz — może przeczytać legendę i opisy, ale pomiar wzrokowy nie jest wiarygodny (AECV-Bench: dobre wyniki dla tekstu, słabe dla symboli i liczenia). Pomiar wymaga **przetwarzania wektorowego + kalibracji skali**, a dla skanów — komputerowego widzenia z własnym treningiem. Claude Code świetnie **pisze i uruchamia** takie skrypty, ale to skrypt mierzy, nie model.

### 3.2 Proponowany pipeline (PDF wektorowy)

```
PDF ─► [1] podział na arkusze, tekst tabliczki (nr rys., tytuł, skala, rewizja)          🟢
    ─► [2] klasyfikacja arkusza: rzut / przekrój / schemat / legenda / zestawienie       🟢 (tekst + render)
    ─► [3] legenda → słownik symboli i stylów linii (render + odczyt przez model,        🟡
           zatwierdzenie przez człowieka)
    ─► [4] skala: odczyt „1:100” + kontrola na znanym wymiarze (np. osie konstrukcyjne)  🟡 (człowiek potwierdza)
    ─► [5] tekst ze współrzędnymi → etykiety średnic/wymiarów kanałów, oznaczenia         🟢
           urządzeń → liczniki z deduplikacją
    ─► [6] ścieżki wektorowe → filtr po kolorze/grubości/stylu → długości × skala         🟡
    ─► [7] przypisanie etykiet do odcinków (najbliższa etykieta, równoległość)           🟡
    ─► [8] zestawienie + kolumna ŹRÓDŁO (plik, strona, bbox) + PEWNOŚĆ                    🟢
    ─► [9] Excel + PDF „zaznaczony” (nakładka z pomierzonymi trasami do kontroli)          🟢
```

Gotowe narzędzie najbliższe temu pipeline’owi: **[OpenTakeoff](https://github.com/Kentucky-ai/opentakeoff)** — przeglądarkowy takeoff z serwerem MCP (53 narzędzia: `set_scale`, `measure_line`, `place_count`, `symbol_sweep`, porównanie rewizji, eksport XLSX/CSV/DXF). Silnik **odmawia pomiaru arkusza bez ustawionej skali** — dobra praktyka. Uwagi: licencja zmieniona na **AGPL-3.0**, profil projektu to głównie posadzki/wykończenia, „Snap” w becie, porównanie rewizji tylko na poziomie ilości. 🟡 dla HVAC.

### 3.3 Przykład: projekt wentylacji hali w PDF — co automatycznie, co ręcznie

| Element zestawienia | Metoda | Auto? | Status | Kontrola człowieka |
|---|---|---|---|---|
| Lista kanałów wg wymiarów (400×200, Ø250…) | tekst ze współrzędnymi + regex | tak | 🟢 | przegląd listy wymiarów (literówki CAD) |
| Podział okrągłe / prostokątne | z formatu etykiety (`Ø`/`fi` vs `a×b`) | tak | 🟢 | — |
| Długości kanałów | ścieżki wektorowe × skala, przypisanie etykiet | częściowo | 🟡 | **tak** — nakładka kontrolna na PDF; kanały na dwóch liniach krawędziowych, piony, odcinki na przekrojach |
| Powierzchnia kanałów prostokątnych [m²] | `2·(a+b)·L` | tak (gdy L znane) | 🟢 wzór / 🟡 dane | dodatki na kształtki wg zasad firmy |
| Powierzchnia kanałów okrągłych [m²] | `π·d·L` | tak | 🟢 wzór / 🟡 dane | j.w. |
| Liczba kształtek (kolana, trójniki, redukcje) | topologia (załamania, rozgałęzienia, zmiana etykiety) lub wskaźnik % | szacunkowo | 🟡/🔴 | **tak** — w PDF kształtki rzadko mają etykiety; wskaźnik musi pochodzić z Twoich danych historycznych |
| Przepustnice regulacyjne | etykiety/oznaczenia; symbol bez etykiety → dopasowanie wzorca | częściowo | 🟡 | tak |
| Nawiewniki / wywiewniki | etykiety typu (`N1`, `W2`) + zestawienie urządzeń | tak, gdy etykietowane | 🟢/🟡 | porównanie z zestawieniem projektanta |
| Klapy przeciwpożarowe | etykiety + przecięcia tras z liniami ścian ppoż (jeśli rozpoznawalne) | częściowo | 🟡 | **tak** — klapy są drogie, każdą potwierdź |
| Izolacja (m² wg grubości) | długości × obwód (z grubością izolacji) wg opisu (np. „kanały nawiewne zewn. 50 mm”) | tak, gdy reguły znane | 🟡 | reguły izolacji z opisu potwierdza człowiek |
| Przedmiar w Excelu | openpyxl, kolumny: pozycja, jm, ilość, źródło, pewność, uwagi | tak | 🟢 | — |

**Wniosek praktyczny:** dla wentylacji z PDF realne jest **zestawienie kanałów wg wymiarów i liczników urządzeń z etykiet** (szybko i dokładnie), oraz **półautomatyczne długości** z kontrolą wizualną. Kształtki i klapy wymagają człowieka lub DWG. Jeśli istnieje DWG — zawsze wybieraj DWG.
