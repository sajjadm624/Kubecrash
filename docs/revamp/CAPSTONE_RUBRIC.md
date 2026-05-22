# Capstone Rubric

## Goal
Evaluate whether a learner can handle realistic Kubernetes incidents end-to-end and produce portfolio-quality artifacts.

## Scoring Model (100 points)

1. Diagnosis quality (25)
- 0-10: Identifies symptoms only
- 11-20: Identifies likely root cause with partial evidence
- 21-25: Confirms root cause with clear evidence chain

2. Command execution quality (20)
- 0-8: Multiple incorrect or unsafe commands
- 9-15: Mostly correct commands with some inefficiency
- 16-20: Efficient, accurate, and safe command sequence

3. Resolution correctness (20)
- 0-8: Issue not fully resolved
- 9-15: Issue resolved but with regressions or weak verification
- 16-20: Issue resolved and verified with strong validation

4. Operational thinking (15)
- 0-6: Reactive fixes only
- 7-11: Some preventive thinking
- 12-15: Strong prevention and reliability actions

5. Retrospective quality (10)
- 0-3: Minimal reflection
- 4-7: Useful but generic reflection
- 8-10: Specific, actionable, and transferable lessons

6. Runbook artifact quality (10)
- 0-3: Incomplete or unclear runbook steps
- 4-7: Usable runbook with gaps
- 8-10: Clear, reusable, and production-ready runbook snippet

## Pass thresholds
- Capstone pass: 70+
- Distinction: 85+
- Mastery: 92+

## Mandatory fail conditions
- Unsafe production action without validation
- Failure to verify fix outcome
- Missing retrospective submission

## Evaluator checklist
- [ ] Root cause evidence is explicit
- [ ] Command path is logical and reproducible
- [ ] Resolution includes verification
- [ ] Preventive action is meaningful
- [ ] Artifact can be reused by another engineer
