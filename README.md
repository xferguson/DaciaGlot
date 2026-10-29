# DaciaGlot

An offline-first Progressive Web App for learning to **speak** Romanian: sentence-based spaced repetition, one new thing at a time, built around producing forms rather than recognizing them.

- Product requirements: [docs/PRD.md](docs/PRD.md) · architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · content: [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)
- Task board for agents: [docs/STATUS.md](docs/STATUS.md) (start with [CLAUDE.md](CLAUDE.md))
- Live site (after GitHub Pages is enabled): https://xferguson.github.io/DaciaGlot/

## Deployment

Pushes to `main` run `.github/workflows/deploy-pages.yml`, which deploys the `app/` folder to GitHub Pages. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
