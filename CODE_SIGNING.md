# Code signing policy

TWIG's Windows installers are built from this repository by GitHub Actions
(`.github/workflows/release.yml`) and signed through
[SignPath](https://about.signpath.io).

> Free code signing provided by [SignPath.io](https://about.signpath.io),
> certificate by [SignPath Foundation](https://signpath.org).
>
> *Status: application to the SignPath Foundation pending. Until it is
> approved, releases are published unsigned and the release notes say so.*

## What gets signed

Only installers built by the release workflow from a tagged commit of this
repository: the NSIS setup `.exe` and the `.msi`. Nothing built on a personal
computer is signed.

## Team roles

| Role | People |
| --- | --- |
| Committers and reviewers | [@jimweldev](https://github.com/jimweldev) |
| Approvers (approve each signing request) | [@jimweldev](https://github.com/jimweldev) |

## Privacy policy

This program will not transfer any information to other networked systems
unless specifically requested by the user or the person installing or
operating it. TWIG works offline: class records stay in a database on the
user's computer, and grade files move between teachers only when a teacher
exports one and sends it themselves. The only network request TWIG makes is when the user clicks
**Check for updates**, which reads the latest release information from GitHub.

## Update signing

Installed copies update themselves through the Tauri updater. Every release's
installers are also signed with the TWIG updater key, and the app refuses any
update whose signature doesn't match the public key built into it
(`plugins.updater.pubkey` in `apps/desktop/src-tauri/tauri.conf.json`). The
private key is kept by the maintainer and in the repository secrets
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Setting up signing (maintainers)

1. Apply at <https://signpath.org/apply> with this public repository.
2. Once approved, in SignPath create the project and a signing policy, and
   paste `.signpath/artifact-configuration.xml` as its artifact configuration.
3. In GitHub, **Settings → Secrets and variables → Actions**, add:
   - secret `SIGNPATH_API_TOKEN`
   - variables `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`,
     `SIGNPATH_SIGNING_POLICY_SLUG`, `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`
4. Push a version tag. The release workflow signs automatically from then on.
