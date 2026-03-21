-- Prevent duplicate votes (race condition between check and insert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_per_user
  ON votes(proposal_id, human_user_id);
