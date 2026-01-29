# Changesets

This folder contains changeset files for managing releases and changelogs.

## What is a Changeset?

A changeset describes a change to the codebase that affects the version or changelog. When you make a meaningful change:

1. Run `pnpm changeset` to create a new changeset
2. Select the type of change (major/minor/patch)
3. Write a summary of the change
4. Commit the generated `.md` file

## Commands

```bash
# Create a new changeset
pnpm changeset

# Version packages (CI typically does this)
pnpm changeset version

# Publish packages (CI typically does this)
pnpm changeset publish
```

## When to Create a Changeset

Create a changeset for:

- New features (minor)
- Bug fixes (patch)
- Breaking changes (major)
- Significant refactors affecting behavior

Don't create changesets for:

- Documentation-only changes
- Internal tooling changes
- Test-only changes

## Release Process

1. PRs include changeset files describing the change
2. When merged to main, changesets are consumed to update CHANGELOG.md
3. Version is bumped according to changeset types
4. Release is tagged and deployed

For more information, see the [changesets documentation](https://github.com/changesets/changesets).
