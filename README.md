# Pull Request Semver Bumper

## About this project

This repository contains a suite of **Composite GitHub Actions** designed to automate semantic version bumping for various project types (Python, Maven, NPM, etc.) within Pull Requests.

## Design Rationale & Relationship to SAP Piper

This action is purpose-built to complement [SAP Project Piper](https://www.project-piper.io/) pipelines, not to replace general-purpose release automation tools like `semantic-release` or `release-please`.

### Why not semantic-release or release-please?

Tools like `semantic-release` and `release-please` own the entire release pipeline — changelog generation, GitHub Releases, package publishing. In SAP projects, **Piper owns the release pipeline** and enforces compliance requirements (security scans, audit trails, legal sign-offs) that third-party release tools cannot satisfy.

### Where this action fits

This action solves a specific gap: **automating the base version bump in the PR**, before Piper takes over on merge.

```
PR opened (feat: add login flow)
  └─► semver-bumper commits 1.2.0 → 1.3.0 to the PR branch
        └─► PR reviewed & merged
              └─► Piper pipeline runs
                    └─► artifactPrepareVersion reads 1.3.0 from descriptor file
                          └─► Piper produces final artifact version (e.g. 1.3.0-20260405143022_abc1234)
```

### Piper versioning and the role of the base version

This action is designed for projects using Piper's **`versioningType: library`**. In this mode, Piper reads the version from the descriptor file (`pom.xml`, `package.json`, etc.) and does **not** overwrite it — the version committed by this action is exactly what gets published.

This makes the semver bump explicit, reviewable, and traceable: the version change lives in the PR diff alongside the code change that motivated it, and Piper picks it up on merge without any additional transformation.

## Requirements

This project relies on the following software and tools:

*   **[GitHub Actions Runner](https://github.com/actions/runner)**: Linux, macOS, or Windows runner.
*   **[Git](https://git-scm.com/)**: Version control system.
*   **[Node.js](https://nodejs.org/)**: Version 20 or higher (required for the action runtime).

Depending on your project type, you will also need:

*   **[Maven](https://maven.apache.org/)**: For Maven projects (requires `mvn` in the PATH).
*   **[NPM](https://www.npmjs.com/)**: For Node.js projects (requires `npm` in the PATH).
*   **[Python](https://www.python.org/) & [Poetry](https://python-poetry.org/)**: For Python projects (requires `poetry` in the PATH).

## GitHub Marketplace Usage

You can use this action directly from the GitHub Marketplace. It supports multiple project types via the `type` input.

```yaml
uses: sap/pull-request-semver-bumper@main
with:
  type: 'npm' # Options: npm, maven, python, version-file
  token: ${{ secrets.GITHUB_TOKEN }}
  # Optional: Custom file paths
  package-json-file: 'custom/package.json' # For npm
  pom-file: 'custom/pom.xml'               # For maven
  pyproject-file: 'custom/pyproject.toml'  # For python
  version-file: 'custom/VERSION'           # For version-file
```

### Inputs

| Input | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `type` | **Required**. Project type to bump (`maven`, `npm`, `python`, `version-file`). | | Yes |
| `token` | **Required**. GitHub token. | | Yes |
| `dry-run` | If true, skip git push. | `false` | No |
| `bump-command` | Custom command to update version. | (auto) | No |
| `commit-message` | Custom commit message. | `version bump to` | No |
| `package-json-file` | Path to package.json (npm only). | `package.json` | No |
| `pom-file` | Path to pom.xml (maven only). | `pom.xml` | No |
| `pyproject-file` | Path to pyproject.toml (python only). | `pyproject.toml` | No |
| `version-file` | Path to version file (version-file only). | `VERSION` | No |



## Contributing

### Forked Repositories
If you are contributing from a forked repository, you **must** run `npm run build` in `.github/actions/core` and commit the changes to the `dist/` folder before pushing.
The CI workflow cannot automatically push changes to your fork due to GitHub security restrictions.

We have included a `pre-commit` hook (using `husky`) that will automatically build and add the `dist` folder when you commit changes in `.github/actions/core`.
The hook is located in the project root (`.husky/`) and is automatically configured when you run `npm install` in `.github/actions/core`.

### Local Development
1.  Install dependencies: `cd .github/actions/core && npm install`
    *   This will also set up the git hooks in the project root.
2.  Make changes.
3.  The pre-commit hook will handle the build.

## Core Concepts

### 1. Semantic Versioning via PR Titles
All actions in this suite rely on [Conventional Commits](https://www.conventionalcommits.org/) to determine the version bump level. The Pull Request title is analyzed to decide whether to perform a major, minor, or patch bump.

| PR Title Example | Bump Type | Result Example |
| :--- | :--- | :--- |
| `feat: add new login flow` | **Minor** | `1.2.0` -> `1.3.0` |
| `fix: handle null pointer` | **Patch** | `1.2.0` -> `1.2.1` |
| `refactor!: drop legacy api` | **Major** | `1.2.0` -> `2.0.0` |
| `chore: update deps` | **Patch** | `1.2.0` -> `1.2.1` |

> **⚠️ Important:** If the PR title does not follow the Conventional Commits specification, the action will fail, and no version bump will occur.

### 2. Why bump during the PR, not post-merge?

Most versioning tools run after merge to the default branch. This action deliberately bumps **inside the PR branch** so that:

- The version change is **visible and reviewable** as part of the PR diff — no hidden post-merge side effects
- Piper picks up the correct base version **immediately on merge**, with no intermediate step needed
- Version history stays linear and traceable alongside the code change that motivated it

### 3. Architecture
These actions are **Composite Actions** that delegate the heavy lifting to a shared core action (`.github/actions/core`).
- **Validation:** Checks PR title semantics.
- **Version Extraction:** Reads the current version from the project file (e.g., `pom.xml`, `package.json`).
- **Calculation:** Computes the next version based on the PR title.
- **Execution:** Runs the ecosystem-specific bump command.
- **Commit & Push:** Commits the change back to the PR branch.

## Supported Ecosystems

Select the action that matches your project type for specific configuration and usage instructions:

> **Note:** The "Action Path" listed below is for reference. We recommend using the main Gateway Action (`sap/pull-request-semver-bumper@main`) with the appropriate `type` input.

| Ecosystem | Action Path | Description |
| :--- | :--- | :--- |
| **[Python](.github/actions/version-bumping/python/README.md)** | `./.github/actions/version-bumping/python` | Supports `pyproject.toml` (Poetry). |
| **[Maven](.github/actions/version-bumping/maven/README.md)** | `./.github/actions/version-bumping/maven` | Supports `pom.xml` via `versions-maven-plugin`. |
| **[NPM](.github/actions/version-bumping/npm/README.md)** | `./.github/actions/version-bumping/npm` | Supports `package.json` via `npm version`. |
| **[Generic Version File](.github/actions/version-bumping/version-file/README.md)** | `./.github/actions/version-bumping/version-file` | Supports generic `VERSION` files. |

For detailed documentation on specific ecosystem behaviors, click the links above.

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/SAP/<your-project>/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure
If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/SAP/<your-project>/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright (2025) SAP SE or an SAP affiliate company and pull-request-semver-bumper contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP/pull-request-semver-bumper).
