# GitHub Setup Guide

## 📦 Backend Repository Setup

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `moon-modeler-backend`
3. Description: `Production-ready backend for Moon Modeler - Database schema design platform`
4. Visibility: Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have them)
6. Click "Create repository"

### Step 2: Add Remote and Push

```bash
cd C:\Users\hp\Desktop\moon-modler\backend

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/moon-modeler-backend.git

# Push to GitHub
git push -u origin master
```

### Step 3: Verify

Visit: `https://github.com/YOUR_USERNAME/moon-modeler-backend`

You should see:
- ✅ All 63 files
- ✅ README.md displayed
- ✅ Comprehensive documentation

---

## 🎨 Frontend Repository Setup (When Ready)

### Step 1: Create Frontend Repository

1. Go to https://github.com/new
2. Repository name: `moon-modeler-frontend`
3. Description: `Frontend for Moon Modeler - Database schema design platform`
4. Visibility: Choose Public or Private
5. **DO NOT** initialize with README
6. Click "Create repository"

### Step 2: Initialize and Push (After Frontend Development)

```bash
cd C:\Users\hp\Desktop\moon-modler\frontend

# Initialize Git
git init

# Add all files
git add .

# Commit (Husky will run if configured)
git commit -m "feat: initial commit - frontend application"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/moon-modeler-frontend.git

# Push
git push -u origin master
```

---

## 🔗 Monorepo Alternative (Optional)

If you prefer a single repository for both backend and frontend:

### Step 1: Create Monorepo

1. Repository name: `moon-modeler`
2. Structure:
```
moon-modeler/
├── backend/
├── frontend/
└── README.md
```

### Step 2: Setup

```bash
cd C:\Users\hp\Desktop\moon-modler

# Initialize Git
git init

# Create root README
# (Create a README.md in moon-modler folder)

# Add all
git add .

# Commit
git commit -m "feat: initial commit - monorepo with backend and frontend"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/moon-modeler.git

# Push
git push -u origin master
```

---

## 🔐 Authentication

### Option 1: HTTPS (Recommended for beginners)

When you push, GitHub will prompt for credentials:
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your account password)

**Create Personal Access Token:**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Select scopes: `repo` (full control)
4. Copy the token (you won't see it again!)
5. Use this token as your password when pushing

### Option 2: SSH (Recommended for frequent use)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "kumaraaditya324@gmail.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub:
# GitHub → Settings → SSH and GPG keys → New SSH key
# Paste the public key

# Change remote to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/moon-modeler-backend.git

# Push
git push -u origin master
```

---

## 📋 Post-Push Checklist

After pushing to GitHub:

### Backend Repository

- [ ] README.md displays correctly
- [ ] All documentation files visible
- [ ] `.gitignore` working (node_modules not pushed)
- [ ] Add repository description
- [ ] Add topics/tags: `typescript`, `nextjs`, `prisma`, `database`, `moon-modeler`
- [ ] Enable GitHub Actions (optional)
- [ ] Set up branch protection rules (optional)

### Add Topics

Go to repository → About (gear icon) → Add topics:
- `typescript`
- `nextjs`
- `prisma`
- `database-design`
- `reverse-engineering`
- `mysql`
- `mongodb`
- `api`
- `backend`

---

## 🚀 Continuous Integration (Optional)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linter
        run: npm run lint
        
      - name: Check formatting
        run: npm run format:check
        
      - name: Run tests
        run: npm test
        
      - name: Type check
        run: npx tsc --noEmit
```

---

## 🔄 Future Workflow

### Making Changes

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# ... edit files ...

# Stage changes
git add .

# Commit (Husky pre-commit hook runs automatically)
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/new-feature

# Create Pull Request on GitHub
```

### Husky Pre-commit Hook

Every commit automatically:
1. ✅ Runs ESLint on changed files
2. ✅ Formats code with Prettier
3. ✅ Blocks commit if errors found

---

## 📞 Need Help?

If you encounter issues:

1. **Authentication failed**: Use Personal Access Token, not password
2. **Permission denied**: Check repository exists and you have access
3. **Pre-commit hook fails**: Fix linting errors with `npm run lint:fix`
4. **Large files**: Check `.gitignore` is working

---

## ✅ Quick Commands Reference

```bash
# Check status
git status

# View commit history
git log --oneline

# Check remote
git remote -v

# Pull latest changes
git pull origin master

# Push changes
git push origin master

# Create branch
git checkout -b branch-name

# Switch branch
git checkout master
```

---

**Your backend is now ready to push to GitHub!** 🚀

Follow the steps above to create your repository and push the code.
