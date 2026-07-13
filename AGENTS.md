# Repository operating contract

## Small-change loop

- Use one agent for one small change. Delegate only independent subsystems that can be verified separately.
- For UI work, inspect only the affected pages, components, styles, and `src/data/site-content.json`. Do not open `content-export`, museum reports, panorama files, or old rollout logs unless the task requires them.
- Use the running Astro development server and HMR while editing. Do one visual pass on the changed route; add mobile QA only for responsive or interaction changes.
- Run `npm run change:verify` once before committing. Do not repeat a successful check unless relevant code changed afterward.
- Do not expand a small request into a site-wide editorial audit. If it exceeds eight minutes, stop broadening scope and report the exact blocker.

## Verification and delivery

- The change router selects `fast`, `standard`, or `release`; unknown and mixed file sets always use `release`.
- Use the full release path only for catalog, tour, dependency, build, or deployment changes.
- Small completed changes publish through `main` and Render by default. After deployment, run `npm run smoke:prod`; a failed smoke check is rolled back with `git revert` and a new deploy.
- Keep user updates to three or fewer: start, deployment start, and final result.
