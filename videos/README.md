# Video-Ordner — selbst-gehostetes VSL

Die Video-Section auf der Startseite (`index.html`, `#video`) lädt das Video
**Pagespeed-optimiert**: Beim Seitenaufruf wird **kein** Video-Byte geladen —
nur das Poster-Bild. Erst beim Klick auf den Play-Button wird die Videodatei
geladen und abgespielt (Loom-artiges Verhalten mit nativen Steuerelementen:
Play/Pause, Scrubbing, Lautstärke, Vollbild, Geschwindigkeit).

## So bindest du dein Video ein

1. Lege deine Videodatei(en) in **diesen Ordner** (`/videos/`):
   - `vsl.mp4`  — Pflicht (H.264/AAC, breite Kompatibilität)
   - `vsl.webm` — optional, empfohlen (VP9/AV1, kleiner → schneller). Wird
     bevorzugt, falls vorhanden; sonst fällt der Player automatisch auf `.mp4` zurück.

   Behalte die Dateinamen bei, dann musst du **nichts im Code ändern**.
   Andernfalls passe die `data-src`-Attribute im `<section id="video">`-Block
   in `index.html` an.

2. **Poster (Thumbnail):** Ersetze `/images/video-poster.svg` durch ein echtes
   Standbild deines Videos (JPG/AVIF/WebP, 1280×720 oder 16:9). Das Poster ist
   das Einzige, was sofort lädt — halte es klein (< 150 KB) für Top-Pagespeed.
   Wenn du das Format änderst, passe das `poster="..."`-Attribut im `<video>`-Tag an.

## Empfehlungen für kleine Dateigröße
- Auflösung: 1080p reicht; bei reinem Sprechervideo genügt oft 720p.
- Bitrate: ~2–4 Mbps (H.264). WebM/AV1 nochmals deutlich kleiner.
- Länge: so kurz wie möglich (VSL ~60–120 s).
- Tipp (ffmpeg):
  `ffmpeg -i input.mov -c:v libx264 -crf 23 -preset slow -c:a aac -b:a 128k -movflags +faststart vsl.mp4`
  (`+faststart` verschiebt die Metadaten an den Anfang → schnelleres Starten.)
