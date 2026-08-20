# Six weeks to the exam

Roughly 8–10 hours a week. Compress it if you have more time, but do not skip the mock exams — they are the only honest feedback in here.

## The loop, every session

1. **Read** one lecture (`/learn`). Do the self-checks before opening them.
2. **Drill** that lecture (`/drill?lecture=…`). Read every explanation, including for the ones you got right.
3. **Cards** — clear whatever is due (`/cards`). Five minutes.
4. **Fix** — tag anything new in `/mistakes` with *why* you missed it.

That is 45–60 minutes. Two or three of those a week plus one longer weekend session gets you there.

---

## Week 1 — Ground rules and compute
**Lectures 01–05.** The shape of AWS, IAM, EC2, load balancing and auto scaling, serverless.

IAM is the densest topic on the exam and lecture 02 is worth reading twice. Drill `secure` at the end of the week.

> Target: comfortable with "compute needs AWS access → IAM role" as a reflex.

## Week 2 — Storage
**Lectures 06–07.** S3 in depth, then block and file.

S3 alone is roughly a fifth of the exam. Learn the storage classes *with their minimum durations* — that is what makes tempting lifecycle answers wrong. Drill `cost`.

> **First checkpoint:** a 15-question quick exam at the end of the week. Do not expect to pass. It calibrates.

## Week 3 — Networking
**Lectures 08–10.** VPC, connecting VPCs and data centres, the edge.

The highest-value week. Draw the two-AZ VPC from memory on paper before reading lecture 09 — `/whiteboard` will check it. Drill `secure` and `resilient`.

> Target: security group vs NACL, and gateway vs interface endpoint, answered without hesitating.

## Week 4 — Data
**Lectures 11–13.** RDS and Aurora, DynamoDB, caching and analytics.

Multi-AZ vs read replicas is the most-tested distinction in this block. Lecture 13 is mostly service recognition — cards do more for it than reading does. Drill `perf`.

> **Second checkpoint: a full 65-question mock.** Whatever the score, spend the next session on the mistakes rather than new material.

## Week 5 — Integration, ops, security
**Lectures 14–16.** Decoupling, observability and governance, the security toolbox.

CloudWatch vs CloudTrail vs Config, and the four threat-detection cue words, are near-free marks. Then go back through every mistake logged so far and re-read the lectures they point at — `/progress` sorts lectures worst-first for exactly this.

## Week 6 — Architecting and tactics
**Lectures 17–19.** Resilience and DR, cost, the exam playbook.

Lecture 19 is about the exam itself, not AWS. Read it twice.

> **Two full mocks, 48 hours apart, on different draws.** Consistently 80%+ on both means book it. One good score and one bad one means keep going.

---

## Before you book

- Two mocks above 80% on different draws.
- No open mistakes tagged `knowledge` in a domain worth 24% or more.
- You can state, without looking: Multi-AZ vs read replica · gateway vs interface endpoint · SQS vs Kinesis · pilot light vs warm standby · latency vs geolocation routing · CloudWatch vs CloudTrail vs Config.

## The day before

Nothing new. Skim, in this order: your mistake log, `/cheatsheet`, the takeaways at the end of each lecture. Sleep.

## The day itself

65 questions, 130 minutes, two minutes each. Three passes: answer what you know and flag the rest, then work the flagged ones, then change an answer only if you can say out loud why. Never leave a blank — there is no penalty for a wrong guess.
