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
