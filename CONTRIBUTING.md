# Working on TEAM SHEEEEP

How we work together on this repo. If you haven't run the app yet, do
[Start here](README.md#start-here) in the README first.

**The short version**

1. Pick a task from **Next up** in the [tracker](docs/tracker.html) and assign yourself a GitHub issue for it.
2. Work on **your own branch**, named after you (e.g. `sam`). Bring in the latest `main` first.
3. Commit small, clear changes.
4. Run the checks.
5. Open a pull request from your branch into `main`. A teammate reviews it, then it's merged.

## Contents

1. [Setting up](#1-setting-up)
2. [Picking up work](#2-picking-up-work)
3. [Branches](#3-branches)
4. [Commits](#4-commits)
5. [Checks before a pull request](#5-checks-before-a-pull-request)
6. [Pull requests and reviews](#6-pull-requests-and-reviews)
7. [Design rules](#7-design-rules)
8. [Keeping the docs current](#8-keeping-the-docs-current)
9. [Secrets and keys](#9-secrets-and-keys)
10. [Using Claude Code](#10-using-claude-code)

## 1. Setting up

| You need | Why | Notes |
| --- | --- | --- |
| Access to the repo | It's private | The owner invites you under *Settings → Collaborators*. Accept it from your email. |
| Git | Version control | Set your name and email once: `git config --global user.name "Your Name"` and `git config --global user.email you@example.com` |
| Node.js 22 | Runs the app and the tools | The exact version is in `.nvmrc`. With nvm: `nvm install 22` then `nvm use 22`. |
| Google Chrome | The browser checks drive it | Windows uses the standard install path. On macOS or Linux set `CHROME_PATH` to your Chrome binary. |
| Python 3 + `python-docx` + `Pillow` | Only to rebuild the Word breakdown | `pip install python-docx Pillow` |

Then:

```bash
git clone https://github.com/AR13X3/team-sheeeep.git
cd team-sheeeep
npm install
npm run dev
```

The app runs at <http://localhost:5173>. No API keys are needed.

## 2. Picking up work

- **What to work on** is in the tracker's **Next up** list. Open
  <http://localhost:5173/docs/tracker.html> with the dev server running, or double-click
  `docs/tracker.html`.
- **Claim it** so two people don't do the same thing: open a GitHub issue for the task (use
  the *Task* or *Bug* template) and assign yourself. If an issue already exists, assign
  yourself and leave a comment.
- **Not sure how to do it, or it changes how the app behaves for farmers?** Talk to the team
  first, or add it to **To discuss** in the tracker. Decisions already made are listed under
  **Decisions**, with the reason for each.

## 3. Branches

- **`main` always works.** It builds, the checks pass, and it's what gets deployed. Nobody
  pushes to `main` directly; every change arrives through a pull request.
- **Every team member has their own branch**, named after them in lowercase: `sam`, `alex`,
  `jo`. It's your workspace: push to it as often as you like. Nobody else pushes to it. The
  [Team table](README.md#team) lists each person's branch.
- **Open a pull request from your branch whenever a task is finished.** Keep them small: one
  task per pull request, at least every few days, so your branch never drifts far from
  `main`.

**First time** (your branch already exists on GitHub):

```bash
git fetch origin
git switch sam                          # use your own branch name
```

**Every time you start work**, bring in what the others have merged:

```bash
git switch sam
git pull                                # your own latest pushes
git fetch origin
git merge origin/main                   # everyone else's merged work
```

**When a task is done:**

```bash
git push                                # then open a pull request: sam → main
```

**After your pull request is merged**, run `git fetch origin` and `git merge origin/main`
again before you start the next task.

Need to work on two things at once? Make an extra branch from `main` with a dash, not a
slash: `sam-supabase`, not `sam/supabase` (Git can't have both `sam` and `sam/…`). Delete it
once it's merged.

## 4. Commits

- **Write the summary as an instruction**, under about 70 characters, saying what the commit
  does: *Add variety maturity to the sowing window*, *Fix legend overlapping the map on
  phones*, *Pin Node 22 for Cloudflare Pages builds*.
- **Add a body when the why isn't obvious**: a blank line, then a few sentences.
- **One topic per commit.** Formatting changes go in their own commit.
- `node_modules/`, `dist/`, caches and screenshots from the checks are ignored by Git already.
  Don't force-add them.

## 5. Checks before a pull request

| Your change touches… | Run | Pass means |
| --- | --- | --- |
| Anything | `npm run build` | Builds with no errors |
| Any screen or style | `npm run test:e2e` (with `npm run dev` running in another terminal) | Ends with `✓ all … checks passed` |
| Layout or sizes | `npm run test:e2e -- fit` | No page scrolls as a whole or is wider than the window |
| The crop classifier (`src/logic/phenology.js`, `src/services/hls.js`) | `npm run validate:phenology` (and `validate:pixels`, `validate:canola10m`) | Accuracy is no worse than the numbers in [how-it-works.md](docs/how-it-works.md#accuracy) |
| Anything visible | Look at it in **light and dark**, and at phone width | Nothing cut off, nothing unreadable |

To run a single browser check, add part of its file name: `npm run test:e2e -- drawing`.
The checks live in `tools/e2e/`.

## 6. Pull requests and reviews

**Opening one**

- Open it into `main` from your branch. GitHub fills in a template: what changed, why, how
  you checked it, and screenshots.
- Add **before and after screenshots** for anything visible.
- Link the issue with `Closes #12` so it closes when merged.
- Open it as a **draft** if you want early feedback before it's finished.

**Reviewing one**

- Every pull request needs **one approving review from a teammate** before it's merged.
- For visible changes, run it yourself: `gh pr checkout 12` (or fetch the branch), then
  `npm run dev`.
- Check it against the [design rules](#7-design-rules), and that the tracker was updated.
- Be specific and kind: say what you'd change and why. Mark small things as *nit*.

**Merging**

- The author merges once it's approved and the checks pass, using **Create a merge commit**.
  Don't squash: your branch carries on after the merge, and a squash would make the same
  changes show up again in your next pull request.
- **Don't delete your member branch** after the merge, even though GitHub offers to. Extra
  `name-topic` branches can be deleted.

## 7. Design rules

These keep the app looking like one product. Reviewers check them.

- **Button fill and label colours stay exactly as in the Figma design.** Don't change them,
  even to fix contrast; that question is open in the tracker.
- **Keep the palette, Lato and Manami.** The rest of the layout is ours to improve.
- **Use the semantic tokens** in `src/styles/tokens.css` (`--bg`, `--surface`, `--text`,
  `--border`…) so light and dark themes both work. **Never hard-code a light-only colour.**
- **Signed-in pages** render inside `src/components/shell/AppShell.jsx` and use `<Page>`
  from `src/components/Page.jsx` for the header, setup stepper and Manami tip.
- **Farm-level numbers** (plan, soil health, crop mix, alerts) come from `useFarm()` in
  `src/state/useFarm.js`. Don't recompute them in a page.
- **Icons** are Lucide, picked by name through `src/components/Icon.jsx`.
- **The app fills the window at real size.** No page zoom; only `.shell__content` scrolls.
- **Motion** must switch off under `prefers-reduced-motion`.
- **Words for farmers**: plain language, short sentences, sentence case.

## 8. Keeping the docs current

Do these in the **same pull request** as the change, not later.

| When you… | Update |
| --- | --- |
| Finish or start a task, make a decision, or find an open question | The JSON inside `<script id="tracker-data">` in `docs/tracker.html`. Move finished **Next up** items to **Milestones**, add **Decisions** with the reason, add **To discuss** questions. Edit only the JSON and keep it valid (no trailing commas). |
| Add or change a feature | `README.md` and `docs/how-it-works.md` (plain text), and `docs/readme.html` (the visual version) |
| Change anything visible | Refresh the screenshots: `node tools/e2e/_doc-shots.mjs` with the dev server running |
| Change features or numbers in the pitch | The text in `tools/docs/build_breakdown.py`, then run `python tools/docs/build_breakdown.py` |

If two pull requests both edit the tracker, Git may report a conflict. Keep **both** sets of
entries, check the JSON is still valid, and bump `updated` to today.

## 9. Secrets and keys

The app needs no keys today. Sign-in (Supabase) and AI Manami (OpenRouter) will.

- **Never commit a key, password or token.** Not in code, not in docs, not in a commit you
  later delete (it stays in the history).
- Local keys go in **`.env.local`**, which Git ignores. Vite only exposes variables starting
  with `VITE_` to the browser, so only public keys (like Supabase's anon key) may use that
  prefix.
- The OpenRouter key never reaches the browser. It lives only in a Supabase Edge Function.
- If a key is ever pushed by mistake, tell the team and rotate it straight away.

## 10. Using Claude Code

[`CLAUDE.md`](CLAUDE.md) holds the project notes Claude Code reads automatically. It tells
Claude to read the tracker first, follow the design rules above, keep the tracker current, and
run the checks. If you use Claude, work on your own branch as usual and review its changes like
any teammate's before you open the pull request.
