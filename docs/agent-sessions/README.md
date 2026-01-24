# Agent Sessions Documentation

This directory contains summaries of specialized agent work sessions to maintain persistent knowledge across conversations.

## Purpose

When specialized agents (ui-ux-designer, test-engineer, code-reviewer, etc.) complete significant work, their sessions should be documented here to:

1. **Preserve context** - Future agents and developers can understand what was done and why
2. **Track decisions** - Record architectural choices, trade-offs, and rationale
3. **Enable continuity** - Resume work seamlessly even after conversation context is lost
4. **Share knowledge** - Make agent insights available to the whole team

## When to Document

Document agent sessions when:
- ✅ Significant design or architecture decisions were made
- ✅ Multiple files were created or modified
- ✅ Complex problems were solved or analyzed
- ✅ Important recommendations or findings emerged
- ✅ Work needs to be reviewed or continued later

**Don't document** trivial tasks like:
- ❌ Single-line bug fixes
- ❌ Simple read-only explorations with no outcomes
- ❌ Quick questions answered without code changes

## How to Document

### Automatic Documentation (Recommended)

Use the `session-documenter` agent to automatically create structured summaries:

```
User: "Document this session"
Claude: [Invokes session-documenter agent to analyze recent work and create summary]
```

The session-documenter will:
1. Review the conversation history
2. Identify files modified, decisions made, and outcomes
3. Create a properly formatted markdown file
4. Update the INDEX.md file
5. Provide a concise summary

### Manual Documentation

If you prefer to document manually, use the template in [TEMPLATE.md](TEMPLATE.md):

1. Copy the template
2. Create a new file: `YYYY-MM-DD-{agent-type}-{brief-slug}.md`
3. Fill in all sections
4. Add entry to [INDEX.md](INDEX.md)

## File Naming Convention

```
YYYY-MM-DD-{agent-type}-{brief-slug}.md
```

**Examples:**
- `2026-01-24-ui-ux-designer-dashboard-redesign.md`
- `2026-01-24-test-engineer-auth-flow-tests.md`
- `2026-01-25-code-reviewer-security-audit.md`
- `2026-01-25-session-documenter-hybrid-approach.md`

**Guidelines:**
- Use ISO date format (YYYY-MM-DD)
- Use exact agent type name (from `.claude/agents/`)
- Keep slug brief (2-4 words, kebab-case)
- Be descriptive but concise

## Document Structure

Each session document should include:

1. **Header** - Agent type, date, task description
2. **Context** - Why this work was needed
3. **What Was Done** - Concrete actions and deliverables
4. **Key Decisions** - Important choices and rationale
5. **Files Modified/Created** - With clickable links
6. **Outcomes** - Results, findings, or artifacts
7. **Status** - Complete, pending review, blocked, etc.
8. **Next Steps** - Follow-up tasks or recommendations

See [TEMPLATE.md](TEMPLATE.md) for the full template.

## Browsing Sessions

- **[INDEX.md](INDEX.md)** - Chronological index of all sessions with quick summaries
- **By Agent Type** - Search for specific agent sessions (e.g., `grep "test-engineer" INDEX.md`)
- **By Date** - Files are named chronologically for easy sorting
- **By Topic** - Use file slugs and summaries to find relevant sessions

## Integration with Agents

All specialized agents are configured to:
1. **Proactively remind** users to document their sessions when significant work is complete
2. **Suggest session-documenter** as the easiest documentation method

Example agent reminder:
```
✅ Session complete! Consider documenting this work using the session-documenter
   agent so the insights are preserved for future reference.
```

## Tips for Effective Documentation

1. **Document while fresh** - Create summaries immediately after completion
2. **Focus on decisions** - Explain *why*, not just *what*
3. **Link to artifacts** - Use markdown links to all relevant files
4. **Be specific** - Include file paths, line numbers, function names
5. **Note blockers** - Document any unresolved issues or dependencies
6. **Keep it concise** - Aim for 1-2 pages; link to detailed docs if needed

## Example Workflow

```bash
# User works with an agent
User: "Help me redesign the dashboard for better UX"
[ui-ux-designer agent does extensive work, creates wireframes, updates components]

# Agent reminds user to document
ui-ux-designer: "✅ Dashboard redesign complete! Consider documenting this
                session using session-documenter for future reference."

# User triggers documentation
User: "Document this session"

# Session documenter creates summary
[session-documenter creates docs/agent-sessions/2026-01-24-ui-ux-dashboard.md]
[Updates INDEX.md with new entry]

# Future benefit
User (next week): "What design decisions were made for the dashboard?"
Claude: [Reads docs/agent-sessions/2026-01-24-ui-ux-dashboard.md and explains]
```

## Maintenance

- **Review regularly** - Ensure documentation stays current
- **Archive old sessions** - Move sessions older than 6 months to `archive/` subdirectory
- **Update INDEX.md** - Keep the index file up to date
- **Clean up duplicates** - Merge or remove redundant documentation

## Questions?

For questions about:
- **Session documentation process** - See [TEMPLATE.md](TEMPLATE.md)
- **Agent capabilities** - See `.claude/agents/{agent-name}.md`
- **Project documentation** - See [CLAUDE.md](../../CLAUDE.md)

---

**Last Updated:** 2026-01-24
**Maintained By:** Development Team + Claude Code Agents
