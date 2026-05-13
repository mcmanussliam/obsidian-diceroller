# Frontmatter Variables

Dice rolls can use numeric YAML frontmatter from the active note.

## Example

```markdown
---
STR: 4
DEX: 1
prof: 3
---

Attack: `1d20+STR+prof` Damage: `1d8+STR`
```

When you roll from that note:

```text
1d20+STR+prof
```

becomes:

```text
1d20+4+3
```

## Rules

- Variables are read from the active note's YAML frontmatter.
- Matching is case-insensitive.
- Only numeric values are substituted.
- Missing variables are left unchanged.
- If the final notation is invalid, the plugin will not roll it.

## Good Uses

Frontmatter variables are useful for character sheets, monster blocks, reusable
NPC notes, and quick encounter notes.
