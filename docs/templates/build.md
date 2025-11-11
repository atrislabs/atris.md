# Feature Name — Build Plan

## Build Specification (Agent Layer)

```markdown
## feature_name

files_touched:
  - path/to/file.js (new file)
  - path/to/another.js (modify)

input: what goes into this feature
output: what comes out

preconditions:
  - condition 1
  - condition 2

architecture:
  1. High-level step 1
  2. High-level step 2
  3. High-level step 3

steps:
  1. Detailed implementation step 1
  2. Detailed implementation step 2
  3. Detailed implementation step 3
  4. Test and validate

error_cases:
  - error 1 → handling strategy
  - error 2 → handling strategy
  - error 3 → handling strategy

side_effects:
  - File system changes
  - Network calls
  - State mutations

test_cases:
  - Test scenario 1
  - Test scenario 2
  - Test scenario 3

validation:
  - Success criteria 1
  - Success criteria 2
  - All tests pass
```

---

## Execution Notes

Agent will execute this plan step-by-step, showing ASCII progress after each step.

Human confirms at each stage before proceeding.

Final ASCII summary shown when complete, then human approves to ship.
