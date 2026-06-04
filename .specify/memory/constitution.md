<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Modified principles: all template placeholders replaced (initial ratification)
  - [PRINCIPLE_1_NAME] → I. People Over Extraction
  - [PRINCIPLE_2_NAME] → II. Simple, Intuitive Workflows
  - [PRINCIPLE_3_NAME] → III. Security First (NON-NEGOTIABLE)
  - [PRINCIPLE_4_NAME] → IV. Accessible by Default (WCAG 2.2 AA)
  - [PRINCIPLE_5_NAME] → V. Calm, Neurodivergence-Friendly Design
  - Added: VI. Readable, Simple Code
  - Added: VII. Minimal Dependencies
- Added sections: Quality Gates; Development Workflow
- Removed sections: none
- Follow-up TODOs: none
-->

# wunan Constitution

## Core Principles

### I. People Over Extraction

wunan exists to serve its users, not to extract value from them. It is built for people who are
not very tech-fluent, and it moves deliberately away from capitalistic extraction.

- Features MUST NOT exist to maximize engagement, attention, time-on-app, or data collection.
- Dark patterns are prohibited: no manipulative nudges, fake urgency, guilt-based copy,
  hidden opt-outs, pre-checked consent boxes, or confusing cancellation flows.
- No advertising, tracking pixels, or third-party analytics that profile users.
- Users MUST be able to export their own data in an open, readable format and leave freely.
- Collect only the data a feature strictly needs, and say plainly why it is needed.

**Rationale**: Trust is the product. A tool for less tech-fluent people must never exploit the
gap between what they understand and what the software does.

### II. Simple, Intuitive Workflows

Ease of use is a top priority. Every workflow MUST be completable by a person with little
technical experience, without documentation or outside help.

- Each screen MUST have one clear primary action.
- Use plain language; avoid jargon, acronyms, and technical error codes in user-facing text.
- Errors MUST explain what happened and what to do next, in plain words.
- Destructive or irreversible actions MUST ask for confirmation and, where feasible, be undoable.
- Prefer fewer steps and fewer choices; sensible defaults over configuration.
- New features MUST NOT add complexity to existing core workflows without explicit justification.

**Rationale**: If a user cannot figure it out, the feature does not work for them, no matter how
capable it is.

### III. Security First (NON-NEGOTIABLE)

Security is a top priority. Our users are often less able to recognize or recover from security
failures, so the software MUST protect them by default.

- Secure defaults: least privilege, deny by default, no security settings users must "turn on".
- All user input MUST be validated and all output encoded for its context.
- Data MUST be encrypted in transit; sensitive data MUST be encrypted at rest.
- Secrets MUST never be committed to the repository or written to logs.
- Logs MUST NOT contain personal data beyond what is strictly required for operation.
- Authentication and cryptography MUST use well-established, maintained implementations; never
  hand-rolled.
- Changes touching authentication, authorization, data storage, or external input MUST receive a
  security-focused review before merge.

**Rationale**: A single breach can do real harm to people who trusted us. Security cannot be
added later.

### IV. Accessible by Default (WCAG 2.2 AA)

The UI MUST meet WCAG 2.2 Level AA. Accessibility is a requirement, not an enhancement.

- All functionality MUST be usable by keyboard alone, with a visible focus indicator.
- Text contrast MUST be at least 4.5:1 (3:1 for large text and UI components).
- All interactive elements MUST have accessible names; images MUST have appropriate alt text.
- Use semantic HTML first; ARIA only when no native element fits.
- Information MUST NOT be conveyed by color alone.
- Layouts MUST work at 200% zoom and on narrow screens without horizontal scrolling.
- Form fields MUST have visible labels and clear, associated error messages.

**Rationale**: Excluding disabled users contradicts the purpose of a tool built for everyone.

### V. Calm, Neurodivergence-Friendly Design

The UI MUST be calm and predictable, suitable for people who are easily overstimulated.

- No autoplaying audio or video; no flashing or blinking content.
- Motion MUST be minimal and MUST respect `prefers-reduced-motion`.
- Use a restrained, low-saturation palette and generous whitespace; avoid visual clutter.
- Show one task at a time; avoid walls of options, dense dashboards, and competing calls to action.
- Notifications MUST be opt-in, infrequent, and never use urgency or alarm to drive action.
- Layout, navigation, and wording MUST stay consistent across screens.
- No time pressure: no countdowns or session timeouts that discard user work without warning.

**Rationale**: Sensory overload and unpredictability make software unusable for many people.
Calm design benefits every user.

### VI. Readable, Simple Code

Code MUST be easy to read, concise, and clearly documented. We prefer simple, readable code over
unnecessary, over-engineered abstractions.

- Write the simplest code that solves today's problem (YAGNI); do not build for imagined futures.
- Introduce an abstraction only when it removes real, existing duplication or complexity.
- Use clear, descriptive names; keep functions small and focused.
- Every module MUST have a short comment explaining its purpose; non-obvious logic MUST have a
  comment explaining *why*.
- User-facing features MUST be documented in plain language.
- Reviewers MUST reject code that is clever at the expense of clarity.

**Rationale**: Readable code is easier to secure, maintain, and contribute to, and keeps the
project open to contributors of varying experience.

### VII. Minimal Dependencies

Dependencies are kept to a minimum. Every dependency is code we must trust and maintain.

- Before adding any new dependency, the contributor MUST check with the maintainers and justify
  it: what it does, why the standard library or existing code is insufficient, its maintenance
  status, license, and security history.
- Prefer the platform's standard library and existing project dependencies.
- Dependencies MUST be pinned to exact versions and kept up to date for security fixes.
- Unused dependencies MUST be removed.

**Rationale**: Fewer dependencies mean a smaller attack surface, simpler code, and less exposure
to supply-chain risk.

## Quality Gates

Every change MUST pass these gates before merge:

- **Usability**: The change keeps core workflows simple and uses plain language (Principle II).
- **Accessibility**: UI changes are checked against WCAG 2.2 AA, including keyboard navigation,
  contrast, and screen-reader labels (Principle IV).
- **Calm design**: UI changes add no autoplay, flashing, unrequested motion, or urgency patterns
  (Principle V).
- **Security**: Inputs are validated, secrets are absent, and sensitive changes have had a
  security review (Principle III).
- **Non-extraction**: The change adds no tracking, dark patterns, or unnecessary data
  collection (Principle I).
- **Dependencies**: Any new dependency has been approved in advance (Principle VII).
- **Readability**: Code is clear, documented, and free of unjustified abstractions (Principle VI).

## Development Workflow

- Features follow the Spec Kit flow: specify → plan → tasks → implement. Each plan MUST include a
  Constitution Check confirming compliance with every principle.
- All changes go through review. The reviewer verifies the Quality Gates above.
- Any deviation from a principle MUST be documented in the plan's Complexity Tracking section,
  with the reason and the simpler alternative that was rejected. Principle III deviations are not
  permitted.
- Prefer small, focused changes that are easy to review.

## Governance

This constitution supersedes all other project practices. When guidance conflicts, the
constitution wins.

- **Amendments**: Proposed via a pull request that edits this file, states the reason, and
  describes any needed migration of existing code or docs. Amendments require maintainer approval.
- **Versioning**: Semantic versioning. MAJOR for removing or redefining a principle; MINOR for
  adding a principle or section or materially expanding guidance; PATCH for clarifications and
  wording fixes.
- **Compliance**: Every plan and every review MUST verify compliance with these principles.
  Complexity MUST be justified. Maintainers review the constitution periodically to keep it
  accurate and useful.

**Version**: 1.0.0 | **Ratified**: 2026-06-03 | **Last Amended**: 2026-06-03
