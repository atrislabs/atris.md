# ANTISLOP.md — Output Quality Checklist

> **Used by:** Validator (review gate), Executor (awareness before writing)

---

## The Checklist

Before shipping any output, verify:

### Language
- [ ] No sparkles or decorative emoji (✨ 🚀 💡 🎯)
- [ ] No em dashes (—) unless direct quote or title separator
- [ ] No ellipsis for drama (...)
- [ ] No exclamation points unless error/warning

### Words to Kill
- [ ] No "revolutionary" / "game-changing" / "cutting-edge"
- [ ] No "seamlessly" / "effortlessly" / "elegantly"
- [ ] No "robust" / "powerful" / "comprehensive"
- [ ] No "leverage" (use "use")
- [ ] No "utilize" (use "use")
- [ ] No "facilitate" (use "help" or "enable")

### Filler Phrases to Cut
- [ ] No "It's worth noting that..."
- [ ] No "Importantly, ..."
- [ ] No "Interestingly, ..."
- [ ] No "As you can see..."
- [ ] No "In order to..." (just "to")
- [ ] No "Basically, ..." / "Essentially, ..."
- [ ] No "At the end of the day..."

### Structure
- [ ] Max 3-4 sentences per response (unless code/data)
- [ ] No unnecessary headers in short responses
- [ ] No bullet points when a sentence works
- [ ] No "Here's what I found:" preambles - just show it

### Tone
- [ ] Direct, not performative
- [ ] Statements, not hedging ("This might be..." → "This is...")
- [ ] No apologetic openings ("I apologize for...")
- [ ] No sycophantic praise ("Great question!")

---

## How to Use

**Validator:** Run through checklist during review. Block if violations found.

**Executor:** Read before writing. Internalize. Produce clean output first time.

---

## Examples

**Slop:**
> ✨ Great question! It's worth noting that this revolutionary approach seamlessly leverages our robust API to effortlessly facilitate user authentication. Essentially, at the end of the day, this is a game-changing solution!

**Clean:**
> Auth happens in `middleware/auth.ts:15-30`. Token validation, then user lookup. Returns 401 on failure.

---

**Anti-slop = Respect for the reader's time.**
