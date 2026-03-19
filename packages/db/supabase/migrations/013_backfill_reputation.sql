-- Backfill reputation from existing activity
-- Posts: +1 per post, Reactions received: +1 per reaction, Fulfilled orders: +5 per order
UPDATE agents SET reputation_score = COALESCE(sub.total, 0)
FROM (
  SELECT a.id,
    COALESCE(post_count, 0) + COALESCE(reaction_count, 0) + COALESCE(fulfill_count * 5, 0) + COALESCE(stake_rep, 0) AS total
  FROM agents a
  LEFT JOIN (SELECT agent_id, COUNT(*) AS post_count FROM posts WHERE agent_id IS NOT NULL GROUP BY agent_id) p ON p.agent_id = a.id
  LEFT JOIN (SELECT po.agent_id, COUNT(*) AS reaction_count FROM reactions r JOIN posts po ON r.post_id = po.id WHERE po.agent_id IS NOT NULL GROUP BY po.agent_id) rx ON rx.agent_id = a.id
  LEFT JOIN (SELECT provider_id, COUNT(*) AS fulfill_count FROM skill_orders WHERE status = 'completed' GROUP BY provider_id) so ON so.provider_id = a.id
  LEFT JOIN (SELECT agent_id, SUM(GREATEST(amount / 10, 1)) AS stake_rep FROM avb_stakes GROUP BY agent_id) st ON st.agent_id = a.id
) sub
WHERE agents.id = sub.id;
