# Claude Co-Work Prompt — LinkedIn-Post-Statistiken nach Supabase

Kopiere den Text unter der Linie in eine **Claude Co-Work**-Session.
Voraussetzungen:
- Ein **lokaler** Task, bei dem Claude deinen **Chrome** öffnen darf (dort bist
  du bei LinkedIn eingeloggt, also sind die Analytics-Seiten sichtbar).
- Zugriff auf das Supabase-Projekt des Dashboards (`blibykmyvkdtdvgzuwyr`,
  Tabelle `public.posts`) über den Supabase-Connector oder MCP.

Voraussetzung im Dashboard: Trage vorher unter **LinkedIn → Statistiken** bei
jedem Post im Feld **„LinkedIn Analytics-URL"** den Analytics-Link ein und
klicke **Speichern** (z. B. `https://www.linkedin.com/analytics/post-summary/urn:li:activity:7497540898298245120/`).

---

Du aktualisierst LinkedIn-Post-Statistiken in meiner Supabase-Datenbank.

**Datenquelle:** Supabase-Projekt `blibykmyvkdtdvgzuwyr`, Tabelle `public.posts`.

**Schritt 1 — Posts laden.** Hole die letzten 7 veröffentlichten Posts:

```sql
select id, content, posted_at, analytics_url,
       impressions, members_reached, reactions, comments,
       reshares, post_saves, link_clicks,
       profile_viewers_from_post, followers_gained_from_post
from public.posts
where status = 'posted' and analytics_url is not null
order by posted_at desc
limit 7;
```

**Schritt 2 — Pro Post die Zahlen beschaffen.** Für jeden Post:
1. Öffne die `analytics_url` in meinem Chrome (ich bin bei LinkedIn
   eingeloggt). Warte, bis die Analytics-Seite vollständig geladen ist.
2. Lies die sichtbaren Kennzahlen direkt von der Seite ab. Nur wenn eine Seite
   nicht lädt oder eine Zahl wirklich unlesbar ist: zeige mir den Post (erste
   Zeile von `content`) samt `analytics_url` und **frag mich** — rate niemals
   Werte.
3. Ordne die Kennzahlen den Spalten zu:

   | LinkedIn-Analytics-Label            | Supabase-Spalte              |
   |-------------------------------------|------------------------------|
   | Impressions / Impressionen          | `impressions`                |
   | Members reached / Mitglieder erreicht | `members_reached`          |
   | Reactions / Reaktionen              | `reactions`                  |
   | Comments / Kommentare               | `comments`                   |
   | Reposts / Reposts                   | `reshares`                   |
   | Saves / Gespeichert                 | `post_saves`                 |
   | Link clicks / Link-Klicks           | `link_clicks`                |
   | Profile viewers / Profilaufrufe     | `profile_viewers_from_post`  |
   | Followers gained / Neue Follower    | `followers_gained_from_post` |

   Nicht jede Kennzahl steht auf jeder Seite. Was nicht sichtbar ist, **lässt
   du unverändert** (nicht auf 0 setzen).

**Schritt 3 — Bestätigen.** Zeige mir eine kompakte Tabelle: pro Post die erste
Zeile des Textes und die ausgelesenen Werte. Warte auf mein **OK**, bevor du
schreibst.

**Schritt 4 — Schreiben.** Nach meinem OK aktualisiere jede Zeile per `id`,
setze nur die Spalten, für die du echte Zahlen hast, und stemple die
Synchronisation:

```sql
update public.posts
set impressions = :impressions,        -- nur gesetzte Werte
    members_reached = :members_reached,
    reactions = :reactions,
    comments = :comments,
    reshares = :reshares,
    post_saves = :post_saves,
    link_clicks = :link_clicks,
    profile_viewers_from_post = :profile_viewers_from_post,
    followers_gained_from_post = :followers_gained_from_post,
    analytics_synced_at = now()
where id = :id;
```

**Regeln:**
- Nur diese 7 Posts anfassen, keine anderen Zeilen.
- Zahlen als reine Ganzzahlen speichern (z. B. `1.234` / `1,234` → `1234`).
- Fehlende Werte nicht überschreiben.
- Am Ende: kurze Zusammenfassung, welche Posts aktualisiert wurden und welche
  Kennzahlen jeweils gesetzt wurden.

Danach erscheinen die Zahlen automatisch im Dashboard unter
**LinkedIn → Statistiken**.
