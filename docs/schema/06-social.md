# Social Layer

## posts

Teacher (or eventually student) posts to a specific activity instance.

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  icon TEXT,      -- emoji chosen by teacher, e.g. 'ℹ️', '📢', '❓'
  content TEXT NOT NULL,
  requires_response BOOLEAN DEFAULT false,
  response_type TEXT CHECK (response_type IN ('text', 'single_select', 'multi_select')),
  -- response_type required when requires_response = true
  -- MVP: 'text' only
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_instance ON posts(activity_instance_id);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_instance_created ON posts(activity_instance_id, created_at DESC);
```

Posts are instance-specific — they live on one activity on one date. There is no multi-day range or pinning in MVP. The feed surfaces posts chronologically so students see them even if they don't navigate back to that specific day.

All enrolled students of the activity see the post. For monitoring sessions, the post passes through to the student's activity view — the student sees it in the context of whatever activity they were doing during that block, with a label indicating it came from the monitoring session.

---

## post_responses

Student submission in response to a `requires_response` post.

```sql
CREATE TABLE post_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_response UNIQUE (post_id, student_id)
);

CREATE INDEX idx_post_responses_post ON post_responses(post_id);
CREATE INDEX idx_post_responses_student ON post_responses(student_id);
```

One response per student per post. Students can edit their response (editing updates `updated_at`). Comments can be threaded on both the post itself and on individual responses.

---

## comments

Discussion on posts, post responses, or status updates. Uses nullable FK columns instead of polymorphic `parent_type`/`parent_id` to get real foreign keys and cascading deletes.

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Exactly one of these must be set (enforced by constraint below)
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  post_response_id UUID REFERENCES post_responses(id) ON DELETE CASCADE,
  status_update_id UUID REFERENCES status_updates(id) ON DELETE CASCADE,

  thread_parent_id UUID REFERENCES comments(id),
  -- NULL = top-level comment; set = reply within a thread

  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT exactly_one_parent CHECK (
    num_nonnulls(post_id, post_response_id, status_update_id) = 1
  )
);

CREATE INDEX idx_comments_post ON comments(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_comments_post_response ON comments(post_response_id) WHERE post_response_id IS NOT NULL;
CREATE INDEX idx_comments_status_update ON comments(status_update_id) WHERE status_update_id IS NOT NULL;
CREATE INDEX idx_comments_thread ON comments(thread_parent_id);
CREATE INDEX idx_comments_author ON comments(author_id);
```

Anyone (teacher or student) can comment on a post, a post response, or a status update. Comments on posts are visible to all students enrolled in that activity. Comments on a post response are visible to the student who wrote it and all teachers. Threading is via `thread_parent_id` — MVP can treat all comments as flat (ignore threading) and enable it later without schema changes.

**Note on table creation order:** `status_updates` must be created before `comments` since `comments` references it. See migration strategy for the correct creation sequence.

---

## status_updates

Student-authored updates about their work.

```sql
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES check_ins(id),
  -- set when created during check-in/out flow, null otherwise

  status_type TEXT NOT NULL CHECK (status_type IN ('plans', 'progress', 'reflection')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_updates_student ON status_updates(student_id);
CREATE INDEX idx_status_updates_instance ON status_updates(activity_instance_id);
CREATE INDEX idx_status_updates_checkin ON status_updates(checkin_id);
CREATE INDEX idx_status_updates_type ON status_updates(activity_instance_id, status_type);
```

**Status types:**
- `plans` — What the student is working on (prompted at check-in)
- `progress` — What the student accomplished (prompted at check-out)
- `reflection` — Thoughts, questions, observations (can be added anytime)

Multiple status updates per student per instance are allowed. They display as a timeline. Teachers can comment on individual status updates via the `comments` table.
