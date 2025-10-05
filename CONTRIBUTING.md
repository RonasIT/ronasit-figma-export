# Contributing

This document provides guidelines for contributing to this project.

## Getting started

1. **Fork or clone the repository**:

   ```bash
   git clone https://github.com/your-username/ronasit-figma-export.git
   cd ronasit-figma-export
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment**:
   - Copy `.env.example` to `.env` (if available)
   - Configure your Figma API token and other required environment variables

## Development workflow

For contributing or local development:

1. Make changes is source files
1. Run scripts locally using `node` to test your changes:

   ```bash
   node src/figma-export.js <command> [options]
   node src/markup.js [options]
   ```

## Repository guidelines

### Branch naming

Use descriptive branch names:

- `feat/add-new-export-format`
- `fix/handle-missing-tokens`
- `docs/update-readme`

### Commit messages

Follow conventional commit format:

- `feat: add support for CSS custom properties`
- `fix: handle empty design tokens gracefully`
- `docs: update installation instructions`
- `refactor: simplify token processing logic`

### Pull request process

1. **Create a feature branch** from `main`
2. **Make your changes** following the coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

## Releases

To create a new release:

1. **Bump the version**: Run `npm version {patch|minor|major}` to update the version number in `package.json` and create a git commit and tag
   - `patch`: Bug fixes (0.2.0 → 0.2.1)
   - `minor`: New features (0.2.0 → 0.3.0)
   - `major`: Breaking changes (0.2.0 → 1.0.0)

2. **Push changes**: Push the commit and tag to the repository:

   ```bash
   git push && git push --tags
   ```

3. **Create GitHub release**: Go to the [GitHub Releases](../../releases) page and:
   - Click "Create a new release"
   - Select the tag created in step 1
   - Add release notes describing the changes
   - Click "Publish release"

4. **Automatic NPM publication**: Once the GitHub release is published, the package will be automatically published to NPM via GitHub Actions workflow.

> **Note**: Make sure you have the `NPM_TOKEN` secret configured in your repository settings for the NPM publication to work.
