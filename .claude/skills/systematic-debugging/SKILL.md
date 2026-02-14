---
name: systematic-debugging
description: "Systematic debugging methodology - root cause first, no blind fixes, four-phase framework. Use when debugging issues, investigating bugs, or when fixes keep failing."
---

# Systematic Debugging

> "NO FIXES WITHOUT ROOT CAUSE FIRST"

## Core Principle

**Never attempt a fix until you understand WHY the bug exists.**

Red flags that indicate you're guessing:
- "Let me just try..."
- "This should work..."
- "Quick fix..."
- "Maybe if I..."

If you catch yourself saying these, STOP. Go back to investigation.

---

## Four-Phase Framework

### Phase 1: Root Cause Investigation

**Goal**: Understand exactly what's happening and why.

```
1. Reproduce the bug consistently
   - What exact steps trigger it?
   - Can you reproduce it every time?
   - What are the minimum conditions?

2. Trace the data flow
   - What inputs lead to the bug?
   - What's the expected output?
   - What's the actual output?
   - Where does expected diverge from actual?

3. Gather evidence
   - Error messages (full stack trace)
   - Log output around the failure
   - State of relevant variables
   - Recent changes to this code path
```

### Phase 2: Pattern Analysis

**Goal**: Identify when it works vs when it fails.

```
1. Find working cases
   - What inputs work correctly?
   - What's different about failing inputs?

2. Isolate the difference
   - Compare working vs broken code paths
   - Identify the exact divergence point

3. Form hypothesis
   - Based on evidence, what's the likely cause?
   - Can you predict when it will fail?
```

### Phase 3: Hypothesis Testing

**Goal**: Validate your understanding before fixing.

```
1. Scientific method
   - State your hypothesis clearly
   - Design a test that would prove/disprove it
   - Run the test
   - Evaluate results

2. One variable at a time
   - Change only one thing per test
   - Keep track of what you've tried
   - Document results

3. Validate understanding
   - Can you explain why the bug happens?
   - Can you predict its behavior?
   - If not, go back to Phase 1
```

### Phase 4: Implementation

**Goal**: Fix with confidence, verify thoroughly.

```
1. Write test first
   - Test that currently fails
   - Captures the exact bug behavior
   - Will pass after fix

2. Implement fix
   - Minimal change to fix the issue
   - Don't refactor while fixing
   - Don't fix adjacent issues

3. Verify
   - Original bug test passes
   - All existing tests pass
   - No regressions introduced
```

---

## Debugging Techniques

### Error Chain Analysis

```go
// Read the full error chain
// "process request: validate input: parse date: invalid format"
//
// Work backwards:
// 1. invalid format - the actual error
// 2. parse date - where it happened
// 3. validate input - caller context
// 4. process request - entry point
```

### Binary Search Debugging

```go
// When bug is in a large code path, bisect:
// 1. Add log at midpoint
// 2. Is state correct at midpoint?
//    - Yes: bug is in second half
//    - No: bug is in first half
// 3. Repeat until isolated
```

### State Inspection

```go
// Add temporary logging to understand state
log.Debug("state at checkpoint",
    "input", input,
    "intermediate", intermediate,
    "expected", expected,
)
// Remove after debugging - don't commit debug logs
```

### Minimal Reproduction

```go
// Write smallest possible test that reproduces the bug
func TestBugRepro(t *testing.T) {
    // Minimum setup
    svc := NewService()
    
    // Exact failing input
    input := Input{Field: "problematic value"}
    
    // The failure
    _, err := svc.Process(input)
    if !errors.Is(err, ErrExpected) {
        t.Errorf("got %v, want ErrExpected", err)
    }
}
```

---

## Warning Signs

### Stop If You See These

| Sign | What It Means | Action |
|------|---------------|--------|
| 3+ consecutive failed fixes | Don't understand root cause | Go back to Phase 1 |
| "It works on my machine" | Environment difference | Investigate environment |
| Fix breaks other tests | Incomplete understanding | Revert, investigate more |
| Can't explain the fix | Got lucky, not understanding | Document why it works |
| Fix is much larger than bug | Scope creep | Split into smaller issues |

### Common Traps

```
❌ "Let me just add a nil check"
   - WHY is it nil? Fix the source.

❌ "Let me just catch this error"
   - WHY is the error happening? Fix the cause.

❌ "Let me just retry on failure"
   - WHY is it failing? Retrying hides bugs.

❌ "Let me refactor while I'm here"
   - Fix the bug first. Refactor separately.
```

---

## Investigation Checklist

Before attempting any fix, answer:

```
[ ] Can I reproduce the bug consistently?
[ ] Do I know the exact input that causes it?
[ ] Do I know where in the code it fails?
[ ] Do I understand WHY it fails with that input?
[ ] Can I predict when it will/won't fail?
[ ] Have I written a failing test?
```

If any answer is "No", keep investigating.

---

## After the Fix

```
1. Verify the fix
   - Bug test passes
   - All other tests pass
   - Manual verification if needed

2. Document the root cause
   - In commit message
   - In PR description
   - Future developers should understand

3. Consider prevention
   - Could this bug class be prevented?
   - Add validation? Better types? Tests?
```

---

## Integration Notes

- **go-error-handling**: Use error chain to trace bugs
- **go-testing**: Write failing test before fixing
