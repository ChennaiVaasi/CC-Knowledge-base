-- Read-only production diagnostic. This script never mutates content.
SELECT 'missing_chess_source' AS issue, id FROM positions WHERE trim(fen) = '' AND trim(raw_pgn) = ''
UNION ALL
SELECT 'submitted_without_open_review', p.id FROM positions p
WHERE p.status IN ('Submitted', 'Peer Review') AND NOT EXISTS (
  SELECT 1 FROM content_reviews r WHERE r.position_id = p.id AND r.status = 'Open'
)
UNION ALL
SELECT 'approved_without_snapshot', p.id FROM positions p
WHERE p.status IN ('Approved', 'Published') AND p.approved_revision_id IS NULL
UNION ALL
SELECT 'library_without_revision', l.position_id FROM library_items l
LEFT JOIN content_revisions r ON r.id = l.revision_id WHERE r.id IS NULL;

SELECT position_id, count(*) AS library_entries FROM library_items
GROUP BY position_id HAVING count(*) > 1;
