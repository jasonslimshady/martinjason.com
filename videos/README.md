# Video-Ordner — selbst-gehostetes VSL

Die Video-Section auf der Startseite (`index.html`, `#video`) hat zwei
`<video>`-Elemente übereinander:

- **`.vsl__bg`** — stummer, endlos loopender Clip, der sofort autoplayt und
  als „lebendiges" Thumbnail hinter dem Play-Button liegt.
- **`.vsl__video`** — das eigentliche VSL. **Pagespeed-optimiert**: Beim
  Seitenaufruf wird **kein** Byte davon geladen. Erst beim Klick auf den
  Play-Button wird die Datei geladen und abgespielt (Loom-artiges Verhalten
  mit nativen Steuerelementen: Play/Pause, Scrubbing, Lautstärke, Vollbild).
  Die Wiedergabegeschwindigkeit wird automatisch auf den im Speed-Widget
  hinterlegten Wert (`data-speed`, aktuell `1.25`) gesetzt.

Aktuell zeigen **beide** testweise auf dieselbe Datei (`vsl.mp4`) — das
hochgeladene Video ohne Ton. Sobald das echte VSL fertig ist, ersetze
einfach `vsl.mp4` (und optional `vsl.webm`) durch die finale Version; der
Loop-Hintergrund kann weiterhin ein kurzer Ausschnitt oder eine eigene
kleine Datei sein. Der Loop läuft dabei immer mit normaler Geschwindigkeit
(1×) — nur das eigentliche VSL läuft mit dem hinterlegten `data-speed`.

**Download-Schutz:** Der native „Herunterladen"-Button in den Video-Controls
ist deaktiviert (`controlsList="nodownload"`) und Rechtsklick → „Video
speichern unter…" ist blockiert. Das verhindert die bequemen Wege für
normale Besucher, ist aber **kein echter Kopierschutz** — technisch versierte
Besucher (Entwicklertools, Netzwerk-Tab, `curl`) können die Datei weiterhin
laden, da der Browser sie zum Abspielen sowieso herunterladen muss. Echter
Schutz bräuchte einen Streaming-Dienst mit DRM/signierten URLs (z. B. Vimeo
privat, Mux, Cloudflare Stream).

## So bindest du dein Video ein

1. Lege deine Videodatei(en) in **diesen Ordner** (`/videos/`):
   - `vsl.mp4`  — Pflicht (H.264/AAC, breite Kompatibilität)
   - `vsl.webm` — optional, empfohlen (VP9/AV1, kleiner → schneller). Wird
     bevorzugt, falls vorhanden; sonst fällt der Player automatisch auf `.mp4` zurück.

   Behalte die Dateinamen bei, dann musst du **nichts im Code ändern**.
   Andernfalls passe die `src`- bzw. `data-src`-Attribute im
   `<section id="video">`-Block in `index.html` an.

2. **Poster (Thumbnail):** `/images/video-poster.svg` wird nur gezeigt, falls
   der Autoplay-Loop (`.vsl__bg`) aus irgendeinem Grund nicht startet (z. B.
   sehr restriktive Browser-Einstellungen). Willst du trotzdem ein Standbild
   pflegen, ersetze es durch ein echtes Bild (JPG/AVIF/WebP, 1280×720) und
   passe das `poster="..."`-Attribut im `<video class="vsl__video">`-Tag an.

3. **Länge im Speed-Widget:** Passe im `<section id="video">`-Block das
   `data-vsl-original-min`-Attribut auf `<span class="vsl__speed-original">`
   auf die echte Original-Länge (in Minuten) an — die angezeigte
   „sped-up"-Länge (`24 min`) wird daraus automatisch berechnet
   (`Original ÷ data-speed`, aktuell `1.25`).

## Empfehlungen für kleine Dateigröße
- Auflösung: 1080p reicht; bei reinem Sprechervideo genügt oft 720p.
- Bitrate: ~2–4 Mbps (H.264). WebM/AV1 nochmals deutlich kleiner.
- Länge: so kurz wie möglich (VSL ~60–120 s).
- Tipp (ffmpeg):
  `ffmpeg -i input.mov -c:v libx264 -crf 23 -preset slow -c:a aac -b:a 128k -movflags +faststart vsl.mp4`
  (`+faststart` verschiebt die Metadaten an den Anfang → schnelleres Starten.)
