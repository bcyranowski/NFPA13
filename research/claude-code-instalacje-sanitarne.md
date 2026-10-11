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

---

## 4. Automatyczne przedmiarowanie z DWG/DXF

### 4.1 Narzędzia — przegląd i ocena

| Narzędzie | Co robi | Platforma | Integracja z Claude Code | Status |
|---|---|---|---|---|
| **[ezdxf](https://ezdxf.readthedocs.io/)** (MIT, [GitHub](https://github.com/mozman/ezdxf)) | odczyt/zapis DXF: warstwy, encje, bloki, atrybuty (ATTRIB), xref (`block.is_xref`, `dxf.xref_path`), `ezdxf.bbox`; stabilna 1.4.3 (X 2025), dokumentacja 1.4.4 (V 2026) | każda | skrypty Python uruchamiane przez Claude | 🟢 |
| **[LibreDWG](https://www.gnu.org/software/libredwg/)** (`dwg2dxf`, [GitHub](https://github.com/LibreDWG/libredwg)) | DWG→DXF, odczyt r1.2–r2018 (~99% wg [manuala](https://www.gnu.org/software/libredwg/manual/html_node/Overview.html)); zapis DWG ≥2004 niedokończony | Linux/Win | CLI | 🟢 (Twoja uwaga: wydanie 0.13.3 nie czytało R2018 — budować z mastera) |
| **[ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter)** | DWG↔DXF, wsadowo z CLI (katalog źródłowy, docelowy, wersja, rekurencja, audyt); Linux DEB/RPM/AppImage | Win/Linux/Mac | CLI; ezdxf ma dodatek `odafc` (do sprawdzenia w dokumentacji) | 🟢 |
| **AutoCAD + AutoLISP / COM** | pełny dostęp do obiektów, także AutoCAD MEP; COM tylko Windows | Windows | przez MCP (poniżej) lub skrypty `.scr`/LISP generowane przez Claude | 🟢 technologia / 🟡 integracja |
| **AutoCAD Core Console** (`accoreconsole.exe`) | AutoCAD bez GUI do skryptów wsadowych; tylko komendy bez okien dialogowych i „czysty” LISP ([CADTutor](https://www.cadtutor.net/forum/topic/70601-core-console-lisp-data-extraction)) | Windows | Claude generuje `.scr`/`.lsp`, uruchamia wsadowo | 🟡 |
| **BricsCAD** | LISP kompatybilny z AutoCAD, BRX, Python (pyrx); użytkownicy forum Bricsys zauważają, że Claude nie zna funkcji LISP specyficznych dla BricsCAD ([forum](https://forum.bricsys.com/discussion/comment/58441/)) | Win/Linux/Mac | jak AutoCAD + MCP społecznościowe | 🟡 |
| **Autodesk Platform Services (APS)** | Model Derivative / Automation API (AutoCAD w chmurze); oficjalne MCP Autodesk: Revit, Model Data Explorer, Fusion Data — **brak AutoCAD MCP** ([Autodesk MCP](https://www.autodesk.com/solutions/autodesk-mcp-servers)) | chmura | REST, samodzielny hosting przykładowych serwerów APS | 🟡 (koszt i złożoność nieadekwatne do jednoosobowej pracy) |
| **IfcOpenShell** (+ `ifcmcp`) | jeśli dostajesz model IFC z Revita: rury/kanały jako obiekty z typami i wymiarami | każda | biblioteka Python; MCP `ifcmcp` (`claude mcp add --transport stdio ifc -- ifcmcp`, wg [README w lustrze repo](https://dev.glassvision.dedyn.io/Glassvision/IfcOpenShell/src/branch/AI_effort_estimate/src/ifcmcp)) | 🟡 |

### 4.2 Serwery MCP do CAD (stan wg GitHub i katalogów MCP)

| Projekt | Mechanizm | Możliwości istotne dla przedmiaru | Dojrzałość |
|---|---|---|---|
| [puran-water/autocad-mcp](https://github.com/puran-water/autocad-mcp) | AutoCAD LT 2024+ (Windows) przez dyspozytor LISP (`mcp_dispatch.lsp`, APPLOAD) + zapasowo ezdxf (headless) | lista/liczenie encji, warstwy, bloki z atrybutami; **brak operacji pomiaru długości** | 557★, 90 forków, v3.1 — najbardziej dojrzały 🟡 |
| [Porta048/AutoCad-MCP](https://glama.ai/mcp/servers/@Porta048/AutoCad-MCP) | COM (Windows), także GstarCAD/ZWCAD | głównie rysowanie (linie, teksty, wymiary) | społecznościowy, MIT 🟡 |
| multiCAD-mcp (AnCode666) | COM: AutoCAD, BricsCAD, ZWCAD, GstarCAD | sterowanie CAD | ~112★ wg katalogu ([glama](https://glama.ai/mcp/servers/i0oofrijce)) 🟡 |
| lambdacad-mcp (Psalmustrack) | AutoLISP przez most plikowy, BricsCAD na Linux | ~105 narzędzi rysunkowych | 1★ — eksperyment 🔴 |
| [Codemod3/CAD-MCP](https://github.com/Codemod3/CAD-MCP) | ezdxf + ODA | `dxf_summary`, `dxf_list_layers`, encje po typie/warstwie, teksty, wymiary, bloki | 1★, 4 commity — eksperyment 🔴 |

**Wniosek:** MCP do AutoCAD przydaje się do **pracy interaktywnej** (np. „podświetl na rysunku wszystkie klapy, które policzyłeś”, „wstaw chmurki rewizyjne”). Do **samego przedmiaru** prostszy i pewniejszy jest skrypt ezdxf na DXF — dokładnie to, co już robisz. Żaden z przeglądanych MCP nie ma wbudowanego pomiaru długości instalacji.

### 4.3 Wymagania 1–10 — co działa

| # | Wymaganie | Jak | Status |
|---|---|---|---|
| 1 | Odczyt DWG | LibreDWG/ODA → DXF → ezdxf; lub AutoCAD COM | 🟢 |
| 2 | Rozpoznanie warstw instalacyjnych | lista warstw + długości + liczba encji → Claude proponuje mapowanie warstwa→instalacja, Ty zatwierdzasz; wykluczenie xref | 🟢 (z akceptacją) |
| 3 | Bloki i atrybuty | `INSERT` + `ATTRIB` (ezdxf) | 🟢 |
| 4 | Długości przewodów | suma LINE/LWPOLYLINE/ARC (+ POLYLINE, SPLINE przybliżone) po warstwie | 🟢 dla tras rysowanych osią |
| 5 | Średnice i wymiary | etykiety (TEXT/MTEXT/atrybuty) → najbliższy odcinek; lepiej: grubość/kolor/warstwa per DN, jeśli projektant tak rysuje | 🟡 |
| 6 | Zliczanie elementów | bloki wg nazwy; etykiety z deduplikacją | 🟢 |
| 7 | Powtarzające się urządzenia | grupowanie bloków po nazwie + atrybutach (np. typ grzejnika z nazwy bloku) | 🟢 |
| 8 | Zestawienia materiałowe | agregacja → XLSX z kolumną źródła (warstwa, handle) | 🟢 |
| 9 | Eksport do Excela | openpyxl/pandas | 🟢 |
| 10 | Porównanie rewizji | diff ilości per warstwa/blok/DN; bez gotowego narzędzia open source | 🟡 |

### 4.4 Pułapki DWG (z praktyki i dokumentacji)

| Pułapka | Objaw | Zabezpieczenie |
|---|---|---|
| **Jednostki** | ezdxf **ignoruje `$INSUNITS`** w obliczeniach ([ezdxf: units](https://ezdxf.readthedocs.io/en/stable/concepts/units.html)) → 1000× za dużo/za mało | sprawdź `$INSUNITS` i sensowność (np. długość pomieszczenia znanej szerokości) |
| **Bloki w innej jednostce / skali** | elementy w blokach przeskalowane | uwzględnij skalę INSERT; wg dokumentacji ezdxf skalę między jednostkami bloków trzeba stosować jawnie |
| **XREF** | podkład architektury dołączony jako xref lub „zbindowany” → fałszywe metry na warstwach typu `xref_...` | filtr warstw po prefiksie, `is_xref`; lista warstw do akceptacji |
| **Obiekty AutoCAD MEP / proxy** | kanały/rury z AutoCAD MEP lub eksportu z Revita mogą być obiektami niestandardowymi (proxy), niewidocznymi jako zwykła geometria | poproś projektanta o „Eksport do AutoCAD” (spłaszczenie) lub IFC; *wiedza ogólna, do sprawdzenia na Twoich plikach* 🟡 |
| **Piony i odcinki pionowe** | na rzucie pion = punkt/kółko, długość 0 | długości pionów ze schematów/rozwinięć lub z wysokości kondygnacji × liczba pionów |
| **Podwójne liczenie** | ta sama trasa na rzucie i na rzucie fragmentu/detalu w modelu | wyklucz ramki/obszary detali (bbox), licz tylko w obszarze rzutów |
| **Wielkość plików** | DWG 70 MB → DXF 450 MB (Twoja obserwacja) | parsowanie strumieniowe (Twój parser) zamiast ładowania całości |

---

## 5. Kosztorysowanie i Excel

### 5.1 Agent kosztorysowy — funkcje i realność

| Funkcja | Realizacja | Status |
|---|---|---|
| Analiza przedmiaru, rozpoznanie pozycji | pandas + słownik nazw/KNR + model do niejednoznacznych | 🟢 |
| Przypisanie jednostek, wykrywanie błędnych jm | słownik reguł (pkt 3) | 🟢 |
| Porządkowanie struktury | szablon działów firmy | 🟢 |
| Wykrywanie brakujących pozycji | checklista per instalacja (pkt 4) | 🟢 |
| Porównanie ilości z dokumentacją | rejestr faktów z cytatami (§6) | 🟢/🟡 (zależnie od źródła ilości) |
| Zestawienie materiałów | agregacja z przedmiaru + rozwinięcie RMS z `.ath` | 🟢 |
| Zapytania ofertowe | DOCX + XLSX do wypełnienia | 🟢 |
| Porównanie cen podwykonawców | `komparator-ofert-is` | 🟢 |
| Kosztorys ofertowy w Excelu | openpyxl z formułami | 🟢 |
| Raport ryzyk | reguły + Twoja ocena | 🟢 (jako sygnalizacja) |

### 5.2 Integracje

| Technologia | Do czego | Ograniczenia | Status |
|---|---|---|---|
| **openpyxl** | tworzenie/edycja XLSX z formatowaniem i formułami | nie przelicza formuł; nie obsługuje `.xls` (użyj pandas+xlrd lub konwersji LibreOffice) | 🟢 |
| **pandas** | analiza, łączenie arkuszy, porównania | utrata formatowania przy zapisie | 🟢 |
| **xlwings** / [mcp-server-xlwings](https://claudemarketplaces.com/mcp/geniuskey/mcp-server-xlwings) | sterowanie otwartym Excelem (COM), makra VBA, pliki zablokowane | tylko Windows z Excelem; Claude Code musi działać natywnie na Windows, nie w WSL | 🟡 |
| **[sbroenne/mcp-server-excel](https://github.com/sbroenne/mcp-server-excel)** | Excel przez COM: Power Query (M), DAX, VBA, tabele przestawne, wykresy | Windows, Excel 2016+, MIT; liczba narzędzi różni się między wersjami | 🟡 |
| **[haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server)** | XLSX bez Excela (openpyxl): formuły, wykresy, walidacja; `claude mcp add excel-mcp-server -- uvx excel-mcp-server` | to samo co openpyxl — w Claude Code wystarczy skrypt, MCP nie jest konieczny | 🟢 |
| **Power Query** | odświeżalne zapytania łączące przedmiar z cennikami | tworzenie M przez COM (MCP powyżej) lub ręcznie wg kodu od Claude | 🟡 |
| **Microsoft Graph** | edycja skoroszytów w OneDrive/SharePoint przez REST (`/workbook/worksheets/{ws}/range(address='A1')`) ([MS Learn](https://learn.microsoft.com/en-us/graph/excel-update-range-format)) | rejestracja aplikacji w Entra ID, uprawnienia firmowe | 🟡 (ma sens tylko w pracy zespołowej) |
| **Claude for Excel** | interaktywna praca w arkuszu | osobny produkt, nie pipeline | 🟢 (wg źródeł wtórnych, GA V 2026) |

### 5.3 Norma, ATH, XML — co wiadomo

| Pytanie | Ustalenie | Status |
|---|---|---|
| Czy jest publiczna specyfikacja `.ath`? | **Nie znalazłem.** Źródła mówią jedynie, że Norma wymienia kosztorysy „uniwersalnym formatem ATH” ([izbudujemy.pl](https://izbudujemy.pl/produkty/22964/Program-Norma-STANDARD/pdf)) | 🔴 publicznie |
| Czy `.ath` da się generować? | **Tak — Twój skill `kosztorys-norma-ath`** (tekst CP1250, CRLF, pola TAB, sekcje `[KOSZTORYS ATHENASOFT]`, `[RMS ZEST n]`, `[ELEMENT n]`, `[POZYCJA]`, `[OBMIAR NEX]`, `[PRZEDMIAR]`, `[RMS n]`, `[SUMA KONTROLNA]` = 32 zera; import do Kobry działa) | 🟢 (Twoja praktyka) |
| ATH2 / XML | istnieje format **ATH2 (*.xml)** — importuje go np. ATHProject do MS Project ([instalki.pl](https://www.instalki.pl/download/programy/windows/firma/programy-branzowe/athproject/)); Comarch ERP XL importuje XML z Normy PRO (rozdziały, pozycje, nakłady RMS) ([Comarch](https://pomoc.comarch.pl/xl/?p=15453)) | 🟡 — struktury nie potwierdziłem |
| Import przedmiaru z Excela do Normy PRO/EXPERT | **nie znalazłem publicznej dokumentacji** tej funkcji; Norma EXPERT ma przeglądarkę BIM/IFC | 🔴 niepotwierdzone — sprawdź w pomocy programu lub u Athenasoft |
| CSV = kosztorys? | **Nie.** CSV przenosi listę pozycji i ilości; nie przenosi nakładów RMS, cen jednostkowych zasobów, narzutów, KNR z kolumnami ani struktury elementów | 🟢 (wniosek) |

**Rekomendacja:** zostań przy generowaniu `.ath` z pliku-wzorca (dawcy nakładów), bo masz to sprawdzone. Dodaj **test regresyjny**: po każdej zmianie generatora skrypt porównuje sumy i liczbę pozycji z poprzednim plikiem, a hook `PostToolUse` uruchamia `verify()` po każdym zapisie `.ath` (patrz §10).

---

## 6. Agent analizy dokumentacji z systemem cytowania

### 6.1 Zasada: najpierw rejestr faktów, potem wnioski

Każda liczba w raporcie musi pochodzić z **rejestru faktów** (`facts.jsonl`), w którym każdy wpis ma źródło. Model nie może wpisać ilości, której nie ma w rejestrze.

```json
{"id":"F-0142","element":"wentylator dachowy","atrybut":"liczba","wartosc":12,
 "plik":"02_Opis_techniczny_W.docx","strona":7,"rozdzial":"4.3",
 "cytat":"Projektuje się 12 wentylatorów dachowych typu ...",
 "metoda":"tekst","pewnosc":"wysoka"}
{"id":"F-0143","element":"wentylator dachowy","atrybut":"liczba","wartosc":10,
 "plik":"W-03_Rzut_dachu.pdf","strona":1,"rysunek":"W-03 rev.B",
 "bbox":[812,420,1630,1180],"metoda":"etykiety WD-1..WD-10 (regex + deduplikacja)","pewnosc":"średnia"}
{"id":"F-0144","element":"wentylator dachowy","atrybut":"liczba","wartosc":8,
 "plik":"Przedmiar_W.xlsx","arkusz":"Wentylacja","wiersz":57,"metoda":"komórka","pewnosc":"wysoka"}
```

### 6.2 Wynik — wiersz raportu rozbieżności

| ID | Element | Opis tech. | Rzut | Przedmiar | Rozbieżność | Źródła | Wpływ kosztowy | Pytanie |
|---|---|---|---|---|---|---|---|---|
| R-07 | Wentylator dachowy | 12 szt. | 10 szt. | 8 szt. | opis ≠ rzut ≠ przedmiar | F-0142 (Opis s.7, rozdz. 4.3), F-0143 (W-03 rev.B, s.1, obszar 812/420), F-0144 (Przedmiar_W.xlsx, Wentylacja!57) | 2–4 szt. × cena jedn. | „Proszę o potwierdzenie liczby wentylatorów dachowych: opis 12 szt., rzut W-03 10 szt. Które obowiązuje?” |

### 6.3 Jak to zbudować

1. **Ekstrakcja per typ pliku** (skrypty, nie model): DOCX → akapity z numerem rozdziału; PDF → słowa ze współrzędnymi i numerem strony; XLSX → komórki z adresem; DXF → encje z warstwą/handle.
2. **Normalizacja nazw** (model + słownik): „wentylator dachowy”, „WD”, „went. dach.” → jeden klucz.
3. **Porównanie** (skrypt): grupowanie faktów po (element, atrybut), wykrycie różnic wartości.
4. **Raport** (model): opis rozbieżności, pytanie, wpływ kosztowy — **tylko na bazie ID faktów**.
5. **Kontrola cytowań** (skrypt): każdy `cytat` musi występować dosłownie w tekście wskazanej strony; inaczej fakt odrzucony. To eliminuje „halucynowane cytaty”.
6. **Nakładka PDF** (PyMuPDF): ramki wokół `bbox` z numerem faktu → szybka kontrola wizualna.

Detekcja klas rozbieżności (rozszerzenie Twojego `analiza-dokumentacji-is`): liczności urządzeń; typy/modele (zestawienie vs opis); parametry (wydajność, spręż, moc); średnice (schemat vs rzut); materiały (opis vs STWiOR); granice zakresu („poza zakresem” w opisie vs pozycja w przedmiarze); pozycje bez ilości; elementy na rysunku bez pozycji w przedmiarze.

---

## 7. Skills, MCP i projekty open source

**Zastrzeżenie dot. aktualności:** dla większości repozytoriów strony GitHub pobrane w tym researchu nie pokazywały daty ostatniego commita. Podaję to, co udało się potwierdzić (wersję, datę wydania lub dokumentacji); „brak daty” oznacza, że nie potwierdziłem. Gwiazdki — stan z dnia researchu. Istnienie na GitHubie ≠ gotowość produkcyjna.

| # | Projekt | Link | Funkcjonalność | Aktualność (potwierdzona) | Integracja z Claude Code | Trudność |
|---|---|---|---|---|---|---|
| 1 | Anthropic Skills (document-skills) | [github.com/anthropics/skills](https://github.com/anthropics/skills) | skille `xlsx`, `docx`, `pdf`, `pptx` + specyfikacja Agent Skills | aktywne (60 commitów; data niepokazana) | plugin: `/plugin install document-skills@anthropic-agent-skills` | 1 |
| 2 | autocad-mcp | [github.com/puran-water/autocad-mcp](https://github.com/puran-water/autocad-mcp) | MCP dla AutoCAD LT 2024+ (LISP) + ezdxf headless; encje, warstwy, bloki z atrybutami | v3.1, 557★; brak daty | MCP stdio (uv) | 3 |
| 3 | OpenTakeoff | [github.com/Kentucky-ai/opentakeoff](https://github.com/Kentucky-ai/opentakeoff) | takeoff z PDF w przeglądarce + 53 narzędzia MCP (skala, długości, liczniki, `symbol_sweep`, porównanie rewizji, XLSX/DXF) | 712 commitów, 304★; licencja AGPL-3.0 (wcześniej Apache-2.0) | `npx -y opentakeoff-mcp` | 2 |
| 4 | ezdxf | [github.com/mozman/ezdxf](https://github.com/mozman/ezdxf) · [docs](https://ezdxf.readthedocs.io/) | odczyt/zapis DXF, bloki, atrybuty, xref, bbox | 1.4.3 (19.10.2025), docs 1.4.4 (14.05.2026) | biblioteka w skryptach | 2 |
| 5 | LibreDWG | [github.com/LibreDWG/libredwg](https://github.com/LibreDWG/libredwg) · [manual](https://www.gnu.org/software/libredwg/manual/LibreDWG.html) | DWG→DXF (`dwg2dxf`), r1.2–r2018 | manual 0.13.4 (III 2026), man `dwg2dxf` 0.14 (VI 2026) | CLI | 3 (kompilacja) |
| 6 | ODA File Converter | [opendesign.com](https://www.opendesign.com/guestfiles/oda_file_converter) | DWG↔DXF, wsadowo CLI | produkt utrzymywany (freeware, rejestracja) | CLI / ezdxf `odafc` | 1 |
| 7 | PyMuPDF | [github.com/pymupdf/PyMuPDF](https://github.com/pymupdf/PyMuPDF) · [rysunki wektorowe](https://pymupdf.readthedocs.io/en/latest/recipes-drawing-and-graphics.html) | tekst ze współrzędnymi, ścieżki wektorowe, render, adnotacje | aktywne | biblioteka (używana w skillu `pdf`) | 2 |
| 8 | Docling | [github.com/docling-project/docling](https://github.com/docling-project/docling) | PDF/DOCX → Markdown/JSON z dobrą obsługą tabel (wg porównań wtórnych) | brak daty | biblioteka/CLI | 2 |
| 9 | MarkItDown | [github.com/microsoft/markitdown](https://github.com/microsoft/markitdown) | szybka konwersja DOCX/XLSX/PDF → Markdown; słaba dla tabel w PDF ([porównanie](https://www.file2markdown.ai/blog/docling-vs-markitdown)) | brak daty | biblioteka/CLI | 1 |
| 10 | excel-mcp-server | [github.com/haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server) | XLSX bez Excela (openpyxl) | v0.1.8 wg PyPI; brak daty | `claude mcp add excel-mcp-server -- uvx excel-mcp-server` | 1 |
| 11 | mcp-server-excel (ExcelMcp) | [github.com/sbroenne/mcp-server-excel](https://github.com/sbroenne/mcp-server-excel) | Excel przez COM: Power Query, DAX, VBA, pivoty | NuGet 1.8.55 | .NET tool, Windows | 2 |
| 12 | mcp-server-xlwings | [katalog](https://claudemarketplaces.com/mcp/geniuskey/mcp-server-xlwings) | otwarty Excel przez xlwings/COM, makra | brak daty | uvx, Windows | 2 |
| 13 | YOLOplan | [github.com/DynMEP/YOLOplan](https://github.com/DynMEP/YOLOplan) | YOLO11: wykrywanie i liczenie symboli MEP na PDF/obrazach, trening własny, eksport CSV/XLSX | v1.1.0 (X 2025), 25★, brak release’ów; **brak modelu HVAC/wod-kan** | Python | 4–5 |
| 14 | PID_Symbol_Detection | [github.com/mgupta70/PID_Symbol_Detection](https://github.com/mgupta70/PID_Symbol_Detection) | półnadzorowane wykrywanie symboli na P&ID (artykuł Automation in Construction 2024) | 54★ | Python, wymaga własnych danych | 5 |
| 15 | construction-drawing-analyzer | [github.com/hamzaabduljabbar/construction-drawing-analyzer](https://github.com/hamzaabduljabbar/construction-drawing-analyzer) | skill Claude: indeks arkuszy, legendy → biblioteka symboli, odsyłacze, powierzchnie; autor: 13 250 vs 13 600 m² (1 projekt) | **zarchiwizowane 25.08.2026** | skill | 2 — jako wzorzec architektury |
| 16 | IfcOpenShell (+ ifcmcp) | [github.com/IfcOpenShell/IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell) | odczyt IFC: rury, kanały, armatura z właściwościami | aktywne; `ifcmcp` w gałęzi/katalogu `src/ifcmcp` (2026) | biblioteka / MCP | 3 |
| 17 | fluids | [github.com/CalebBell/fluids](https://github.com/CalebBell/fluids) · [docs](https://fluids.readthedocs.io/) | tarcie, Δp, kształtki (Crane TP-410), pompy; MIT | 1.3.x | biblioteka | 2 |
| 18 | CoolProp | [github.com/CoolProp/CoolProp](https://github.com/CoolProp/CoolProp) | właściwości płynów (woda, glikol, powietrze, czynniki) | aktywne | `pip install coolprop` | 2 |
| 19 | hvac_pressure | [PyPI](https://pypi.org/project/hvac-pressure/) | Δp w kanałach: Darcy–Weisbach + współczynniki ASHRAE 2009 | wczesne wersje 0.1.x | biblioteka | 2 |
| 20 | diff-pdf / diff-pdf-visually | [diff-pdf](https://vslavik.github.io/diff-pdf/) · [diff-pdf-visually](https://github.com/bgeron/diff-pdf-visually) | wizualne porównanie rewizji PDF | diff-pdf „as-is”, nierozwijany | CLI | 1 |
| 21 | Codemod3/CAD-MCP | [github.com/Codemod3/CAD-MCP](https://github.com/Codemod3/CAD-MCP) | MCP ezdxf: warstwy, encje, teksty, wymiary, bloki; DWG przez ODA | 1★, 4 commity | `claude mcp add cad -- uvx --from git+https://github.com/Codemod3/cad-mcp cad-mcp` | 2 (eksperyment) |
| 22 | AECV-Bench | [github.com/AECFoundry/AECV-Bench](https://github.com/AECFoundry/AECV-Bench) · [arXiv](https://arxiv.org/abs/2601.04819) | benchmark rozumienia rysunków przez modele multimodalne | I 2026 | — (źródło wiedzy o ograniczeniach) | — |

Dodatkowo (niezweryfikowane bezpośrednio, tylko katalogi MCP): `Porta048/AutoCad-MCP`, `multiCAD-mcp` (AnCode666), `lambdacad-mcp` (Psalmustrack, BricsCAD), `blackmount-construction-mcp` (48 narzędzi „estimating”, opis marketingowy — [katalog](https://claudemarketplaces.com/mcp/blackmount-ai/blackmount-construction-mcp)). Przegląd MCP dla CAD: [Snyk](https://snyk.io/articles/9-mcp-servers-for-computer-aided-drafting-cad-with-ai/), [Cadalyst](https://blog.cadalyst.com/architecture-infrastructure-construction-solutions/mcp-a-new-standard-for-connecting-ai-to-aec-software).

**Czego nie znalazłem:** gotowego, otwartego narzędzia do przedmiaru **HVAC/wod-kan z DWG** (Twój skill jest bardziej zaawansowany niż publiczne projekty), gotowego narzędzia do porównania rewizji DXF, relacji użytkowników Reddit o Claude Code w przedmiarach MEP (wyszukiwanie zwróciło głównie ogłoszenia freelancerów), publicznej specyfikacji `.ath`.

---

## 8. Nieoczywiste zastosowania (18)

| # | Zastosowanie | Jak | Status |
|---|---|---|---|
| 1 | **Raport „co zmiana rewizji kosztuje”** | diff ilości DWG/przedmiaru rev.A vs rev.B × ceny z Twojego `.ath` → lista zmian z kwotą; gotowe do roszczeń/aneksów | 🟡 |
| 2 | **Wykrywanie „cichych” zmian w rewizji PDF** | diff tekstu po stronach + diff-pdf wizualnie → strony ze zmianą, których nie oznaczono chmurką | 🟢 |
| 3 | **Dziennik decyzji kosztorysowych** | każda decyzja (zerowanie dubla, przyjęta interpretacja) zapisywana w JSON + uzasadnienie → przy rozliczeniu wiesz, dlaczego | 🟢 |
| 4 | **Baza cen historycznych z Twoich ofert** | ekstrakcja cen z archiwalnych ofert PDF/XLSX → tabela (materiał, DN, data, dostawca) → podpowiedź ceny i wykrywanie odstających | 🟢 |
| 5 | **Wskaźniki ilościowe z archiwum** (m rur/m² PU, kształtki % długości kanałów, m² izolacji/m kanału) | z Twoich zakończonych kosztorysów → wskaźniki do szybkiej kontroli nowych przedmiarów | 🟢 |
| 6 | **Kontrola „rozsądności” przedmiaru wskaźnikami** | nowy przedmiar vs wskaźniki z pkt 5 → sygnał, gdy np. kanałów jest 3× mniej niż typowo | 🟢 |
| 7 | **Mapowanie STWiOR → pozycje przedmiaru** | każdy wymóg STWiOR (np. próby, dezynfekcja) musi mieć pozycję lub uwagę „w cenie” | 🟢 |
| 8 | **Automatyczny „ślepak” dla podwykonawcy z Twojego `.ath`** | eksport pozycji bez cen do XLSX z blokadą kolumn ilości | 🟢 |
| 9 | **Normalizacja ofert z nazwami handlowymi** | rozpoznanie równoważności (producent/typ) i flagowanie zamienników niespełniających parametrów STWiOR | 🟡 |
| 10 | **Weryfikacja doboru urządzeń z kart katalogowych** | z karty PDF: wydajność/spręż/moc → porównanie z zestawieniem projektu | 🟡 |
| 11 | **Obliczenia kontrolne prędkości w kanałach z przedmiaru** | wymiar kanału + przepływ ze schematu → v; >dopuszczalnej → sygnał hałasu/zmiany kosztu | 🟡 |
| 12 | **Bilans wody/ścieków kontrolnie** | liczba przyborów z DWG → przepływ obliczeniowy wg przyjętej metody → porównanie z DN przyłącza | 🟡 (metoda normowa do zaprogramowania i zweryfikowania) |
| 13 | **Dokumentacja pomiarowa z telefonu** | zdjęcia protokołów/wskazań → OCR + Twoja weryfikacja → protokół DOCX | 🟡 |
| 14 | **Harmonogram rzeczowo-finansowy z kosztorysu** | działy `.ath` × założone tempo → XLSX/MS Project | 🟢 |
| 15 | **Codzienny raport IS z maili/dokumentów** (masz skill `codzienny-raport-is`) | Routine/scheduled task — raport rano | 🟢 |
| 16 | **Lista materiałów do zamówienia z podziałem na etapy** | przedmiar + harmonogram → zamówienia per etap, z zapasem | 🟢 |
| 17 | **Kontrola przejść ppoż** | przecięcia tras (DWG) z liniami ścian/stropów oddzielenia ppoż (jeśli są na osobnej warstwie) → liczba przejść i średnice → pozycje kosztowe, często pomijane | 🟡 |
| 18 | **Aplikacje HTML dla ekipy** | kalkulator izolacji, przelicznik kanałów, checklisty odbiorowe — jeden plik HTML działający offline na telefonie | 🟢 |

---

## 9. Architektura — trzy warianty

### Wariant A — prosty (Claude Code + pliki + gotowe skille)

```
Folder projektu ─► Claude Code (Desktop/terminal) ─► skille: xlsx, docx, pdf (+ Twoje IS)
                                               └─► Excel/DOCX/MD z wynikami
```

| Cecha | Opis |
|---|---|
| Narzędzia | Claude Code, Python (skille i tak go używają), skille Anthropic + Twoje, `CLAUDE.md` z regułami |
| Koszt | subskrypcja Claude (sprawdź [aktualny cennik](https://claude.com/pricing)); oprogramowanie darmowe |
| Czas wdrożenia | 1–3 dni |
| Kompetencje | opis procedur słowami; podstawy obsługi terminala/aplikacji Desktop |
| Ograniczenia | ilości z rysunków tylko z tekstu/zestawień; brak systemu cytowań; wyniki mniej powtarzalne |
| Automatyzacja | streszczenia, rozbieżności opisowe, porządkowanie Excela, RFQ, protokoły |
| Rekomendacja | start i praca z dokumentami tekstowymi |

### Wariant B — średniozaawansowany (Python + PDF/CAD + Excel + MCP)

```
                      ┌─ ingest/  (DWG→DXF, PDF→tekst+wektory, DOCX→tekst, XLSX→tabele)
Folder projektu ─► skrypty ┤
                      ├─ facts.jsonl (rejestr faktów ze źródłami)
                      └─ items.json / prices.json
                                │
              Claude Code + skille IS (orkiestrator) ─► raporty, .ath, XLSX
                                │
              hooks (walidacja) │ MCP opcjonalnie: AutoCAD (podgląd), Excel COM
```

| Cecha | Opis |
|---|---|
| Narzędzia | PyMuPDF, pdfplumber, ezdxf, LibreDWG/ODA, pandas, openpyxl; opcjonalnie `autocad-mcp`, `mcp-server-excel` |
| Koszt | j.w. + czas własny; licencje CAD/Excel już posiadane |
| Czas wdrożenia | 2–6 tygodni (Ty masz już większość — realnie 1–2 tygodnie na domknięcie luk) |
| Kompetencje | czytanie prostego Pythona, umiejętność testowania na znanym projekcie |
| Ograniczenia | PDF bez warstw; kształtki i klapy z PDF półręcznie; jakość zależy od dyscypliny warstw projektanta |
| Automatyzacja | obmiar DWG, liczniki etykiet z PDF, audyt przedmiaru, rozbieżności z cytatami, `.ath` |
| Rekomendacja | **docelowy wariant dla Ciebie** |

### Wariant C — wieloagentowy

```
               ┌─ Agent dokumentacji (DOCX/PDF/STWiOR → fakty)
               ├─ Agent CAD (DWG/DXF → ilości, warstwy, bloki)
Orkiestrator ──┼─ Agent przedmiaru (fakty → items.json, braki)
(skill         ├─ Agent kosztorysu (items → .ath, KNR, ceny)
 kosztorys-    ├─ Agent QA (cytowania, duble, jm, wskaźniki, regresja)
 sanitarny)    └─ Agent optymalizacji (zamienniki, warianty, Δkoszt)
                         ▼
             Pakiet ofertowy + raport + pytania do projektanta
```

| Cecha | Opis |
|---|---|
| Narzędzia | Wariant B + subagenci (`.claude/agents/*.md`) lub skille z `context: fork`; opcjonalnie Agent SDK |
| Koszt | wyższe zużycie limitów (wielu agentów równolegle) |
| Czas wdrożenia | 1–3 miesiące do stabilności |
| Kompetencje | jak B + projektowanie testów (zestaw „złotych” projektów z znanym wynikiem) |
| Ograniczenia | trudniejsze debugowanie; błąd jednego agenta propaguje się — konieczny agent QA i kontrakty danych (JSON schema) między agentami |
| Automatyzacja | półautomatyczny proces od dokumentacji do oferty; człowiek zatwierdza bramki: mapowanie warstw, skala, interpretacje, ceny |
| Rekomendacja | dopiero gdy B działa stabilnie na 3–5 projektach. Twój orkiestrator już jest szkieletem C — wystarczy uruchamiać etapy jako subagenci i dodać agenta QA |

---

## 10. Przykładowy workflow: folder projektu → zweryfikowany przedmiar i raport

### 10.1 Wejście i struktura katalogów

```
Projekt_X/
├─ 00_wejscie/                      ← nie modyfikować (tylko odczyt)
│  ├─ W_projekt_wentylacji.pdf
│  ├─ IS_instalacje.dwg
│  ├─ Opis_techniczny.docx
│  ├─ Przedmiar.xlsx
│  └─ STWiOR.pdf
├─ 10_ekstrakcja/                   ← generowane skryptami
│  ├─ IS_instalacje.dxf
│  ├─ pdf_words.jsonl  pdf_paths.jsonl  docx_paras.jsonl  xlsx_cells.jsonl
│  └─ facts.jsonl                   ← rejestr faktów ze źródłami
├─ 20_wyniki/
│  ├─ 1_Przedmiar_zweryfikowany.xlsx
│  ├─ 2_Zestawienie_materialow.xlsx
│  ├─ 3_Brakujace_pozycje.xlsx
│  ├─ 4_Rozbieznosci.xlsx
│  ├─ 5_Ryzyka_kosztowe.xlsx
│  ├─ 6_Optymalizacje.md
│  ├─ 7_Pytania_do_projektanta.docx
│  └─ kontrola_W_projekt.pdf        ← nakładka: co policzono i skąd
├─ CLAUDE.md                        ← reguły projektu
└─ .claude/
   ├─ settings.json                 ← hooki walidacyjne
   └─ skills/ (lub skille osobiste ~/.claude/skills/)
```

### 10.2 Etapy, narzędzia, bramki kontrolne

| Etap | Co robi | Narzędzie | Bramka człowieka |
|---|---|---|---|
| 1. Rekonesans | lista plików, typy, rewizje, branże; brakujące dokumenty | Claude + Python | — |
| 2. Ingest | DWG→DXF (LibreDWG/ODA); PDF → słowa+ścieżki (PyMuPDF); DOCX → akapity; XLSX → komórki | skrypty `ingest_*.py` | — |
| 3. Kalibracja | mapowanie warstw DXF → instalacje; skala arkuszy PDF; słownik symboli z legendy | Claude proponuje tabelę | **TAK** — akceptujesz mapowanie i skale |
| 4. Fakty | ilości z DWG (warstwy, bloki), liczniki etykiet z PDF, liczby z opisu, pozycje z przedmiaru → `facts.jsonl` | skrypty + Claude do normalizacji nazw | — |
| 5. Weryfikacja cytatów | każdy cytat sprawdzany dosłownie w źródle; fakty bez potwierdzenia odrzucone | skrypt `verify_facts.py` | — |
| 6. Porównanie | przedmiar vs fakty: braki, nadmiary, rozbieżności, błędne jm, duble | skrypt `reconcile.py` | — |
| 7. Raporty | 7 plików wynikowych; każda liczba z ID faktu | Claude + openpyxl/docx | **TAK** — przegląd rozbieżności > progu |
| 8. Kosztorys (opcjonalnie) | `items.json` → `.ath` (Twój skill) | `kosztorys-norma-ath` | **TAK** — interpretacje, ceny |
| 9. Kontrola końcowa | `kontrola-przed-wysylka` + regresja sum | Twój skill + hook | **TAK** |

### 10.3 `CLAUDE.md` projektu (fragment)

```markdown
# Reguły przedmiaru
- Ilość bez źródła = BŁĄD. Każda ilość ma ID faktu z facts.jsonl (plik, strona/warstwa, cytat/metoda).
- Ilości liczą wyłącznie skrypty. Nie szacuj liczby elementów z obrazu strony.
- Jednostki: rury, kanały [m]; kanały i izolacja [m²]; urządzenia/armatura [szt.]; próby [m] lub [kpl] wg KNR.
- Wentylacja: m² prostokątne 2(a+b)·L, okrągłe π·d·L; kształtki osobno.
- Pliki w 00_wejscie są tylko do odczytu.
- Niepewne → kolumna „pewność”: wysoka/średnia/niska + powód. Rozbicie na DN z etykiet = „średnia”.
- Na koniec: lista założeń i lista rzeczy do ręcznej weryfikacji.
```

### 10.4 Hook walidacyjny (fragment `.claude/settings.json`)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          { "type": "command",
            "command": "python \"${CLAUDE_PROJECT_DIR}/.claude/hooks/validate_outputs.py\"",
            "timeout": 60 }
        ]
      }
    ]
  }
}
```
`validate_outputs.py` sprawdza: czy każdy wiersz w `20_wyniki/*.xlsx` ma ID faktu; czy `.ath` przechodzi `verify()` (CP1250, suma kontrolna, osierocone zasoby); czy sumy nie zmieniły się bez wpisu w dzienniku decyzji. Kod wyjścia 2 = błąd wraca do Claude, który musi go poprawić ([Hooks](https://code.claude.com/docs/en/hooks)).

### 10.5 Uruchomienie

```bash
cd Projekt_X
claude                                   # tryb interaktywny
> /kosztorys-sanitarny zakres: wentylacja + wod-kan; cel: weryfikacja przedmiaru, bez cen

# lub wsadowo (np. nocą, dla nowej rewizji):
claude -p "Uruchom /analiza-dokumentacji-is dla 00_wejscie, wyniki do 20_wyniki. Tryb nienadzorowany: założenia wypisz na górze raportu."
```

---

## 11. Rzetelność i ograniczenia

### 11.1 Klasyfikacja kluczowych funkcji

| Funkcja | Status | Uzasadnienie |
|---|---|---|
| Odczyt tekstu z PDF wektorowego, DOCX, XLSX | 🟢 | biblioteki dojrzałe; AECV-Bench: zadania tekstowe do ~0,95 |
| Ekstrakcja tabel z PDF tekstowego | 🟢 | pdfplumber/Docling |
| Ekstrakcja tabel narysowanych liniami CAD | 🟡 | trzeba grupować słowa po współrzędnych |
| OCR skanów (tekst) | 🟡 | błędy w znakach typu Ø/0, O/0, 1/l — krytyczne dla średnic |
| Długości z DXF (trasy osiowe, warstwy) | 🟢 | Twoja praktyka + ezdxf |
| Rozbicie długości na średnice z etykiet | 🟡 | orientacyjne (Twoje wnioski) |
| Zliczanie bloków DWG | 🟢 | deterministyczne; ryzyko: bloki-odnośniki |
| Kanały prostokątne z DWG rysowane krawędziami | 🟡 | wymaga parowania linii lub etykiet |
| Długości z PDF wektorowego | 🟡 | brak warstw, skala per rzut |
| Długości ze skanu | 🔴 | — |
| Liczenie symboli przez model „wzrokiem” | 🔴 | AECV-Bench: 0,40–0,55 |
| Liczenie symboli przez wytrenowany detektor (YOLO) | 🟡 | wymaga setek oznaczonych przykładów Twoich symboli; brak gotowych modeli HVAC |
| Generowanie `.ath` | 🟢 / 🔴 | 🟢 u Ciebie (działa z Kobrą); 🔴 brak publicznej specyfikacji |
| Import Excel → Norma natywnie | 🔴 | niepotwierdzony w źródłach publicznych |
| Sterowanie AutoCAD przez MCP | 🟡 | projekty społecznościowe, Windows |
| Wykrywanie rozbieżności z cytowaniem źródeł | 🟢/🟡 | 🟢 dla tekstu i DWG; 🟡 gdy ilość z rysunku PDF |
| Powtarzalność wyników | 🟢 gdy liczą skrypty / 🔴 gdy liczy model | patrz 11.3 |

### 11.2 Ryzyka i zabezpieczenia

| Ryzyko | Przykład | Zabezpieczenie |
|---|---|---|
| **Halucynowanie ilości** | model „uzupełnia” brakującą ilość „typową” wartością | reguła w `CLAUDE.md` + hook: ilość bez ID faktu = błąd; braki jako `brak`, nie liczba |
| **Błędna skala** | rzut 1:50 na arkuszu z opisem 1:100; PDF wydrukowany „dopasuj do strony” | kalibracja na znanym wymiarze na każdym rzucie; skala jako fakt z akceptacją |
| **Błędna interpretacja symboli** | ten sam symbol dla przepustnicy i klapy u różnych projektantów | słownik z legendy danego projektu (nie ogólny); akceptacja |
| **Błędne średnice** | OCR `Ø11O`, etykieta innej instalacji najbliżej odcinka | filtr dopuszczalnych DN per instalacja; maks. odległość etykiety; „pewność średnia” |
| **Pomijanie elementów** | wpusty na rysunku architektury, nie w IS (Twój przypadek) | checklista elementów per instalacja; „nie znaleziono w modelu” ≠ 0 |
| **Podwójne liczenie** | detal powiększony w tym samym modelu; komplet + elementy pojedyncze | wykluczenie obszarów detali; zasada „zeruj z opisem w `uw`, nie usuwaj” (Twoja) |
| **Warstwy CAD** | xref architektury z liniami „PPOŻ pasy” = setki fałszywych metrów | lista warstw z długościami do akceptacji przed obmiarem |
| **Jednostki rysunkowe** | `$INSUNITS` mm vs m; ezdxf go ignoruje | test sensowności (znany wymiar) |
| **XREF** | podkłady niezbindowane — brak elementów; zbindowane — śmieci | `is_xref`, prefiksy warstw; poproś o czysty model IS |
| **Rozbieżności między rewizjami** | liczysz z rev.B, przedmiar z rev.A | rewizja w każdym fakcie; ostrzeżenie przy mieszaniu rewizji |
| **Powtarzalność** | dwa uruchomienia dają różne liczby | liczą skrypty (deterministycznie); model tylko interpretuje; zapis wersji skryptów i wejść (hash plików) |

### 11.3 Mechanizmy kontroli jakości (do wdrożenia)

1. **Źródło przy każdej pozycji** — kolumny: `ID faktu`, `plik`, `strona/warstwa`, `metoda`, `pewność`.
2. **Weryfikacja cytatów** — dosłowne wyszukanie w źródle; brak = odrzucenie.
3. **Nakładka kontrolna PDF** — wszystko, co policzono, zaznaczone na rysunku z numerem.
4. **Podwójna ścieżka dla kluczowych ilości** — np. liczba klap: bloki DWG vs zestawienie projektanta vs etykiety PDF; zgodność 2 z 3 lub flaga.
5. **Złoty projekt** — 1–2 zakończone projekty z ręcznie zweryfikowanym przedmiarem jako test regresyjny po każdej zmianie skilli.
6. **Wskaźniki rozsądności** — porównanie z historycznymi wskaźnikami (sekcja 8, pkt 5–6).
7. **Hook walidacyjny** — formalne reguły egzekwowane automatycznie, niezależnie od modelu.
8. **Dziennik decyzji** — każda interpretacja z uzasadnieniem.

**O oszczędnościach czasu:** wszystkie wartości w tym raporcie to oszacowania. Jedyne liczby „z praktyki” pochodzą z Twojego skilla `komparator-ofert-is` (deklaracja 1–2 h → ok. 10 min) i z jednego projektu autora `construction-drawing-analyzer` (13 250 vs 13 600 m²). Rzetelny pomiar: zmierz czas ręczny i z Claude na 2–3 projektach (sugestia w planie 30 dni).
