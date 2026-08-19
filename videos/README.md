# Video-Ordner — VSL (Hintergrund-Loop lokal, volles Video via Cloudflare R2)

Die Video-Section auf der Startseite (`index.html`, `#video`) hat zwei
`<video>`-Elemente übereinander:

- **`.vsl__bg`** — stummer, endlos loopender Clip aus **diesem Ordner**
  (`/videos/vsl.mp4`), der sofort autoplayt und als „lebendiges" Thumbnail
  hinter dem Play-Button liegt. Läuft immer mit normaler Geschwindigkeit
  (1×), egal welchen `data-speed` das eigentliche VSL nutzt.
- **`.vsl__video`** — das eigentliche VSL, eingebunden per **externer URL**
  (aktuell ein Cloudflare-R2-Bucket, siehe unten) statt einer lokalen Datei —
  die volle Datei war zu groß fürs Repo. **Pagespeed-optimiert**: Beim
  Seitenaufruf wird **kein** Byte davon geladen. Erst beim Klick auf den
  Play-Button wird die Datei geladen und abgespielt (Loom-artiges Verhalten
  mit nativen Steuerelementen: Play/Pause, Scrubbing, Lautstärke, Vollbild).
  Die Wiedergabegeschwindigkeit wird automatisch auf den im Speed-Widget
  hinterlegten Wert (`data-speed`, aktuell `1.25`) gesetzt.

## Externes Hosting (Cloudflare R2)

Das volle VSL liegt in einem öffentlichen R2-Bucket:
`https://pub-091972a94ee1449e9ff66fd286474ac0.r2.dev/vsl-full.mp4`

Referenziert wird das direkt im `data-src` der `<source>` in
`<video class="vsl__video">` in `index.html` — beim Klick auf Play
promotet das Player-Skript `data-src` → `src` genau wie bei einer lokalen
Datei, nur zeigt die URL jetzt auf R2 statt auf `/videos/`.

**Neue Datei hochladen:** Lade die neue Version in denselben (oder einen
neuen) R2-Bucket hoch und aktualisiere die URL im `data-src`-Attribut.
Achte darauf, dass der Bucket weiterhin öffentlich lesbar ist und
Byte-Range-Requests unterstützt (nötig fürs Scrubbing/Seeking — R2 kann das
nativ). Ein Video-Objekt-Wechsel braucht keinen Code-Change im JS, nur die
neue URL im HTML.

**Download-Schutz:** Der native „Herunterladen"-Button in den Video-Controls
ist deaktiviert (`controlsList="nodownload"`) und Rechtsklick → „Video
speichern unter…" ist blockiert. Das verhindert die bequemen Wege für
normale Besucher, ist aber **kein echter Kopierschutz** — technisch versierte
Besucher (Entwicklertools, Netzwerk-Tab, `curl`) können die Datei weiterhin
laden, da der Browser sie zum Abspielen sowieso herunterladen muss. Echter
Schutz bräuchte einen Streaming-Dienst mit DRM/signierten URLs (z. B. Vimeo
privat, Mux, Cloudflare Stream).

## So bindest du dein Video ein

1. **Hintergrund-Loop (`.vsl__bg`):** Lege die Datei als `/videos/vsl.mp4`
   in diesen Ordner. Behalte den Dateinamen bei, dann musst du **nichts im
   Code ändern**. Kurz halten (paar Sekunden reichen, sie loopt) — sie lädt
   sofort beim Seitenaufruf.

2. **Volles VSL (`.vsl__video`):** Liegt aktuell auf Cloudflare R2 (siehe
   oben) statt lokal, weil die Datei fürs Repo zu groß ist. Neue Version →
   R2-URL im `data-src` in `index.html` aktualisieren (siehe „Externes
   Hosting" oben). Passt die Datei doch mal ins Repo, kannst du stattdessen
   wieder `/videos/vsl.mp4` (+ optional `vsl.webm`) referenzieren.

3. **Poster (Thumbnail):** `/images/video-poster.svg` wird nur gezeigt, falls
   der Autoplay-Loop (`.vsl__bg`) aus irgendeinem Grund nicht startet (z. B.
   sehr restriktive Browser-Einstellungen). Willst du trotzdem ein Standbild
   pflegen, ersetze es durch ein echtes Bild (JPG/AVIF/WebP, 1280×720) und
   passe das `poster="..."`-Attribut im `<video class="vsl__video">`-Tag an.

4. **Länge im Speed-Widget:** Passe im `<section id="video">`-Block das
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
