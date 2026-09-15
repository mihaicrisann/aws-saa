# Hard drills (v2 bank) — how it was built

`content/questions-v2.json` is a separate, deliberately harder question bank. It does not
replace `content/questions.json`; the original bank is untouched and stays the default
practice set. Validate with `npm run check:v2`.

Status: **independently reviewed on 2026-09-10.** A second agent re-verified every keyed
answer against AWS documentation and adversarially re-read the distractors, and the two
ambiguous stems it found were then fixed. All 100 questions carry
`review.independentReview: passed`. See "Open after independent review" below for what
changed and for the judgement calls left standing.

## Shape of the bank

100 questions, `v2-001` … `v2-100`, all `difficulty: 3`.

| Domain | Questions | Exam weight | Multi-select |
| --- | --- | --- | --- |
| secure | 30 | 30% | 6 |
| resilient | 26 | 26% | 5 |
| perf | 24 | 24% | 5 |
| cost | 20 | 20% | 4 |
| **total** | **100** | **100%** | **20** |

The counts mirror the SAA-C03 domain weights exactly, so a 100-question run through the
bank is weighted like the real exam. Multi-select is held at 20% because the exam guide only
recognises two response shapes — one correct of four, or two or more correct of five or more
— and roughly a fifth of a real paper is the second shape.

The 20 cost questions (`v2-081` … `v2-100`) were the last block authored. Their lecture
spread:

| Lecture | Questions |
| --- | --- |
| `18-cost` | 7 |
| `06-s3` | 4 |
| `03-ec2` | 3 |
| `12-dynamodb` | 2 |
| `05-serverless`, `09-vpc-connectivity`, `17-resilience-dr`, `19-migration-hybrid` | 1 each |

Every question carries a `lecture` id that exists in `content/curriculum.json` and an
`anchor` that is a real section id in the matching `lectures/_src/*.html` fragment, so a
wrong answer links straight to the paragraph that explains it. The validator enforces both.

## Difficulty rationale

"Hard" here does not mean obscure. Each question is built so that:

- **The scenario carries a constraint that eliminates the obvious answer.** `v2-090` would be
  a one-line Graviton question if two of the twelve services did not link an x86-only vendor
  binary. `v2-082` would be "buy a Savings Plan" if capacity in a named Availability Zone were
  not also required.
- **At least two options are things a competent engineer would actually consider.** In
  `v2-094` warm standby genuinely meets both the RTO and the RPO — it is wrong only because
  the stated budget constraint rules it out. In `v2-086` three of the four options are Deep
  Archive; the question is entirely about retrieval tiers.
- **The wrong answers fail for a stated reason, not for being silly.** Every incorrect option
  has a `distractors[i]` note explaining the specific misconception it encodes. Those notes
  are what the app shows after a wrong answer, so they have to teach.
- **Numbers are avoided where they are volatile.** See the source policy below.

Recurring cost traps deliberately covered: data transfer out and NAT gateway data processing
(`v2-087`, `v2-096`, `v2-099`), Savings Plans vs Reserved Instances as a *flexibility*
decision rather than a discount one (`v2-081`, `v2-082`), Spot diversification (`v2-083`),
S3 class selection driven by retrieval fees and minimum durations (`v2-084`, `v2-086`),
storage nobody can see — noncurrent versions and orphaned multipart uploads (`v2-085`),
"stop the instances" not actually stopping the bill (`v2-099`), and the four cost tools
distinguished by the question each answers (`v2-088`, `v2-089`).

## Source policy

- **Official AWS material only.** Every `sources[].url` is on `docs.aws.amazon.com` or
  `aws.amazon.com` (service pages, pricing pages, whitepapers). The validator rejects any
  other host. No exam dumps, no braindump sites, no third-party blogs, no courseware. All
  102 distinct URLs in the bank return HTTP 200 — but **a 200 from docs.aws.amazon.com is
  not evidence a page exists.** Retired doc pages still answer 200 with an empty shell and a
  meta-refresh to the guide's landing page. Two such stubs were cited in the first draft
  (`reservedcapacity.html`, `cluster-capacity-providers.html`) and were replaced. Check the
  rendered body, not the status code.
- **`checkedAt` is a claim about a date, not about correctness.** Every source in the bank
  carries `checkedAt: 2026-09-10`. It means the page was fetched on that date and the fact
  the question relies on was read out of it — not that a second reviewer agreed.
- **No invented limits, prices or figures.** Where a number would decide the answer, it was
  read out of AWS documentation and quoted as documentation quotes it (Deep Archive Standard
  retrieval "typically finishes within 12 hours", Bulk "within 48 hours"; Expedited not
  offered for Deep Archive; DynamoDB TTL deletes "without consuming write throughput";
  CloudWatch Logs stores data "indefinitely" by default). Where a number is volatile it is
  kept out of the deciding path and replaced with a relative statement — "cheaper than",
  "no per-request charge", "charged in addition to". No question in the cost block turns on
  a dollar figure or a percentage discount.
- **Prices are never asserted.** The one place the first draft slipped — a distractor note
  in `v2-091` claiming the Fargate Savings Plan discount is "smaller than the Spot discount"
  — was an ordering AWS does not publish anywhere official, and it was rewritten to the
  argument that actually holds: a Savings Plan is a commitment to an hourly spend, which a
  forty-minute nightly burst leaves unused for most of every day.

## Answer-shape (length cue) methodology

The 80 questions authored before this pass leaked the answer through option length: the
correct option was the uniquely longest one in 24 of 64 single-answer questions — 37.5%,
where chance for a four-option question is 25%. A reader could beat random guessing by
measuring rather than reading.

The metric is deliberately broader than "is the correct option the longest". For each
single-answer question the correct option is given a **rank** by length, 1 = longest. A bank
with no length signal has a flat rank histogram at roughly 25% each. Reducing rank 1 to zero
would not fix the leak, it would just invert it into "never pick the longest" and pile the
mass onto rank 2 — which is exactly what a naive fix produces.

Three edits were used, all meaning-preserving, and no `correct` index or stem was changed:

1. **Lengthen one incorrect option** with additional accurate technical detail, so the
   correct option is no longer the longest (16 questions).
2. **Tighten the correct option** — drop filler, keep every technical term — so it is no
   longer at the top of the ranking (12 questions, 8 of them from the flagged 24).
3. **Leave 8 of the flagged 24 alone on purpose**, so that rank 1 lands near chance instead
   of being suspiciously empty.

Result, over the whole file:

| Metric | Before | After |
| --- | --- | --- |
| Single-answer questions | 64 | 80 |
| Correct option uniquely longest | 24 (37.5%) | 12 (15.0%) |
| Rank histogram (1 = longest) | 24 · 11 · 17 · 12 | 13 · 25 · 20 · 22 |
| Multi-select questions | 16 | 20 |
| Multi-select where the *k* longest options are exactly the answer | 0 (chance 10%) | 0 |
| Multi-select where the *k* shortest options are exactly the answer | 3 | 3 (15%) |

"Pick the longest option" now scores 15% — worse than guessing. The residual skew is a mild
excess at rank 2 (31%) inherited from the 40 questions that were already fine and were not
touched; a chi-square against uniform is not significant at that shape. `npm run check:v2`
prints the full histogram on every run so the number cannot quietly drift.

**Threshold:** the validator fails when the uniquely-longest rate exceeds **25%**, the
chance level for a four-option question. Above that, option length carries real information
about the answer; at or below it, it does not. The threshold is a constant at the top of
`scripts/check-v2.mjs` (`MAX_LONGEST_CUE`).

## What `npm run check:v2` enforces

JSON parses and is an array · ids unique and matching `/^v2-\d{3}$/` · `bank` is `"v2"` and
`version` is an integer · domain is one of the four curriculum domains · `lecture` exists in
the curriculum · `anchor` is a real section of that lecture fragment · options non-empty and
distinct · 4 options for single-answer, 5+ for multi · `correct` non-empty, in range, no
duplicates · multi-select stems say "Choose TWO"/"Choose THREE" matching the count, and
single-answer stems say neither · `distractors` is the same length as `options`, empty
string at every correct index, non-empty text at every incorrect index · stem and
explanation present and long enough to be a scenario and an explanation · at least one
source, on an official AWS host, with an ISO `checkedAt` date · `review.status`,
`review.independentReview`, `review.rubric` present · the 30/26/24/20 domain distribution ·
exactly 20 multi-select · the answer-length cue below threshold.

It does **not** check facts. Nothing can.

## What a reviewer should re-verify

In rough order of how much damage an error would do:

1. **Every `correct` index against its stem.** A single-answer question with the wrong index
   teaches the wrong thing and no validator will notice.
2. **The cost block's factual claims**, listed under "volatile facts" below.
3. **Distractor notes.** Twenty-four questions had one option's wording changed during the
   de-cueing pass; the note attached to that option was written for the earlier wording.
   They were re-read, but they are the most likely place for a stale sentence.
4. **The 12 tightened correct options** (`v2-020`, `v2-023`, `v2-033`, `v2-037`, `v2-054`,
   `v2-055`, `v2-057`, `v2-073`, `v2-082`, `v2-088`, `v2-092`, `v2-098`). Words were removed
   from these. Confirm nothing load-bearing went with them.
5. **Adversarial reading of the distractors** — is any "wrong" option arguably right under a
   reasonable reading of the stem? `v2-094` (warm standby does meet the targets, and is
   excluded only by the budget sentence) and `v2-082` (a zonal RI does reserve capacity, and
   is excluded only by the family-change sentence) are the two that lean hardest on one
   clause of the scenario.
6. **`review.independentReview` should flip from `pending` to `passed`** per question as it
   clears, not in bulk.

## Volatile facts most likely to age out

These are the claims to re-check first when the bank is next revisited. Each is currently
supported by the cited source, but each is the kind of thing AWS changes.

- **Lambda's execution ceiling.** The docs now describe up to 90 minutes for Lambda Managed
  Instances functions invoked asynchronously or through most event source mappings, alongside
  the familiar 15-minute default. No question in this bank turns on the Lambda timeout, and
  none should be added that does without re-reading the limits page.
- **CloudFront pricing structure.** CloudFront moved to a plan-based model (Free / Pro /
  Business / Premium). `v2-096` relies only on the stated behaviours — origin-to-CloudFront
  transfer is waived, cached objects are served from the edge — not on any per-GB comparison.
  Keep it that way.
- **S3 Intelligent-Tiering mechanics.** "No retrieval fees" and "objects under 128 KB are not
  monitored and stay in the Frequent Access tier" are both current. The monitoring-and-
  automation fee and the minimum-object-size behaviour have both changed before.
- **Glacier retrieval tiers and times.** Deep Archive: Standard within 12 hours, Bulk within
  48 hours, Expedited not available. Flexible Retrieval: Expedited 1–5 minutes, Standard 3–5
  hours, Bulk 5–12 hours. `v2-086` depends on all of these.
- **Public IPv4 charging.** All public IPv4 addresses are billed, attached or not. `v2-099`
  mentions this in a distractor note rather than in an option, so a change would not
  invalidate the answer.
- **DynamoDB TTL and reserved capacity.** TTL deletes consume no write throughput in the
  Region where the item expires; replicated deletes to global-table replicas do consume
  capacity. Reserved capacity applies to provisioned mode only.
- **Capacity Reservations combined with commitments.** `v2-082` depends on AWS's statement
  that a Capacity Reservation can be combined with a Savings Plan or a regional Reserved
  Instance to receive a discount. That is a billing rule and billing rules move.
- **DynamoDB global tables (MREC / MRSC) and the RDS Multi-AZ DB instance vs DB cluster
  split.** Not part of the cost block, but the resilience questions that use them
  (`v2-045`, `v2-046`, `v2-031`, `v2-032`) sit on recently changed ground.
- **Snow family device names and capacities.** `v2-095` names Snowball Edge but does not
  depend on any device capacity figure; the arithmetic in the stem is only "half a petabyte
  over a shared 500 Mbps link takes months", which is true by a wide margin.

## Open after independent review

Corrected on 2026-09-10 (facts, notes and sources only — no `correct` index and no stem or
option text was changed, so the answer-length cue numbers are untouched):

| Question | Defect | Fix |
| --- | --- | --- |
| `v2-039` | Cited the SNS *message filtering* page for a fan-out claim it does not make | Now cites the "Fanout Amazon SNS notifications to Amazon SQS queues" page |
| `v2-056` | Cited the NAT gateway *pricing* page for an availability-zone resilience claim | Now cites the NAT gateways concept page |
| `v2-083` | Explanation claimed `capacity-optimized` is "simultaneously the cheapest"; AWS documents it as selecting for available capacity, with `price-capacity-optimized` as the strategy that weighs price | Explanation corrected and `price-capacity-optimized` named |
| `v2-091` | Unpublishable discount-ordering claim; second source was a retired stub URL | Note rewritten around the hourly-commitment argument; source replaced |
| `v2-092` | `reservedcapacity.html` is a retired stub | Now `reserved-capacity.html`, which states reserved capacity is unavailable for on-demand mode |
| `v2-097` | Explanation claimed CloudWatch Logs storage is "far above S3's" — an unsupported magnitude | Reduced to "a higher rate than S3 does" |

Both stems the reviewer flagged were then fixed, applying the wording it proposed. All 100
questions are now marked `independentReview: passed`.

| Question | Ambiguity | Fix |
| --- | --- | --- |
| `v2-094` | "will not pay to keep a second full production environment running" did not exclude warm standby, which is by definition a scaled-down copy rather than a full one | Budget clause is now "will not pay to keep application-tier servers running in the second Region", which excludes warm standby and multi-site on the stem itself instead of on a cheapest-that-clears tiebreak |
| `v2-082` | Called the workload "licensed"; AWS documents that Capacity Reservations cannot be used with Windows BYOL, giving a candidate grounds to reject the keyed answer | The word carried no weight in the scenario and was removed |

Neither touched an option, a `correct` index or a distractor note, so the cue numbers are
unchanged.

Left alone as judgement calls, listed so the next reader does not have to rediscover them:

- **`v2-100`** says the dataset must "stay openly available", while Requester Pays forbids
  anonymous requests. The explanation teaches that catch explicitly and no other option
  shifts egress cost, so the answer is not in doubt — the adjective is just loose.
- **`v2-013`** pairs an egress rule with an ingress rule. Security groups allow all outbound
  by default, so only the ingress rule is strictly required; the pair is still the standard
  reference design and no other pair of options is defensible.
- **`v2-097`** does not offer the CloudWatch Logs Infrequent Access log class, which is a
  genuine lever for this scenario. It is not needed to answer the question, but a second
  CloudWatch cost question could be built on it.
- **Throwaway distractors.** `v2-041` option 3, `v2-099` option 2, `v2-069` option 1,
  `v2-064` option 1, `v2-076` option 1 and `v2-053` option 0 are absurd on sight and can be
  eliminated without knowing the topic. `v2-085` option 4 offers S3 Storage Lens in answer to
  a stem that asks for "lifecycle configurations", so it eliminates itself on category. None
  of these are wrong, they just waste an option slot.
