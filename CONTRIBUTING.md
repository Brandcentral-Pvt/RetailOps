# Contributing to RetailOps

Thank you for your interest in contributing to RetailOps! This document provides guidelines and information about contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)

## Code of Conduct

Please be respectful and inclusive in all interactions. We expect all contributors to follow these standards.

## Getting Started

1. **Fork the repository** (if you're an external contributor)
2. **Clone your fork** locally
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/Brandcentral-Pvt/RetailOps.git
   ```
4. **Install dependencies**:
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd ../frontend && npm install
   ```
5. **Set up environment variables** (see `.env.example`)

## Development Workflow

### GitFlow Branching Strategy

We follow GitFlow branching model:

- **`main`** - Production-ready code
- **`develop`** - Integration branch for features
- **`feature/*`** - New features (branch from `develop`)
- **`release/*`** - Release preparation (branch from `develop`)
- **`hotfix/*`** - Emergency fixes (branch from `main`)

### Starting a New Feature

```bash
# Ensure you're on develop and up to date
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, commit, and push
git add .
git commit -m "feat: add your feature description"
git push -u origin feature/your-feature-name
```

### Creating a Pull Request

1. Push your feature branch to origin
2. Create a PR from `feature/your-feature-name` to `develop`
3. Fill out the PR template completely
4. Wait for CI checks to pass
5. Request a review from a maintainer
6. Address any feedback

## Branch Naming Conventions

Use the following prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/add-user-auth` |
| `fix/` | Bug fixes | `fix/login-redirect-issue` |
| `hotfix/` | Emergency fixes | `hotfix/security-patch` |
| `release/` | Release preparation | `release/v1.2.0` |
| `docs/` | Documentation | `docs/update-api-guide` |
| `refactor/` | Code refactoring | `refactor/optimize-queries` |
| `test/` | Adding tests | `test/add-user-tests` |

## Commit Message Guidelines

Follow Conventional Commits:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Formatting changes (no code change)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes
- **build**: Build system changes

### Examples

```
feat(auth): implement JWT token refresh
fix(api): handle null response in user endpoint
docs(readme): update installation instructions
refactor(db): optimize query performance
```

## Pull Request Process

1. **Title**: Use conventional commit format
2. **Description**: Fill out the PR template completely
3. **Tests**: Ensure all tests pass
4. **Review**: Get at least one approval
5. **Merge**: Squash and merge to `develop`

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests pass locally

## Code Style

### Backend (Node.js/Express)

- Use ESLint with project config
- Follow Airbnb style guide
- Use async/await over callbacks
- Handle errors properly

### Frontend (React)

- Use functional components with hooks
- Follow component naming conventions
- Keep components small and focused
- Use TypeScript for new components

### General

- Write meaningful variable/function names
- Keep functions under 50 lines
- Avoid magic numbers
- Add comments for complex logic

## Questions?

If you have questions about contributing, feel free to open an issue with the label "question".
