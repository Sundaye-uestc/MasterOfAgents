---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej Karpathy's observations on LLM coding pitfalls. Apply when doing non-trivial implementation work.
---

# Karpathy Guidelines

Behavioral guidelines inspired by Andrej Karpathy's observations: LLMs often *make wrong assumptions*, *overcomplicate code and APIs*, and *change/remove code they don't sufficiently understand*. These rules bias toward **caution over speed**. For trivial fixes, use your judgment.

---

## 1. Think Before Coding

**"Don't assume. Don't hide confusion. Surface tradeoffs."**

- State your assumptions explicitly before implementing.
- When a request is ambiguous, present multiple interpretations — don't silently pick one.
- If a simpler approach exists, say so and push back.
- If something is unclear, **stop**, name what's confusing, and ask.

---

## 2. Simplicity First

**"Minimum code that solves the problem. Nothing speculative."**

- No features beyond what was requested.
- No abstractions for single-use code.
- No unrequested flexibility or configurability.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite.
- **Self-check:** Would a senior engineer say this is overcomplicated? If yes, simplify.

---

## 3. Surgical Changes

**"Touch only what you must. Clean up only your own mess."**

- Don't improve adjacent code, comments, or formatting while fixing something else.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- When you notice unrelated dead code, mention it — but don't delete it.
- When your changes create orphans (unused imports, variables, functions), clean those up — but don't remove pre-existing dead code unless asked.
- **Test:** Every changed line should trace directly to the user's request.

---

## 4. Goal-Driven Execution

**"Transform tasks into verifiable goals. Loop until verified."**

- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a reproducing test, then make it pass.
- "Refactor X" → ensure tests pass before AND after.
- For multi-step tasks, state a brief plan with `verify: [check]` per step.
- Strong success criteria → autonomous looping. Weak criteria ("make it work") → constant hand-holding.

---

## Anti-Patterns

| Principle | Anti-Pattern |
|-----------|-------------|
| Think Before Coding | Silently assuming file format, fields, or scope |
| Simplicity First | Strategy pattern for a single discount calculation |
| Surgical Changes | Reformatting unrelated code while fixing a bug |
| Goal-Driven | "I'll review and improve the code" with no criteria |

---

**If these guidelines are working, you'll see:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions asked *before* implementation rather than after mistakes.
