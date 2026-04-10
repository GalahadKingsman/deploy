# Story 5.4 — Screenshots

## Файлы (строго такие имена)

- `mini-account.png` — Mini App, Account (ник + Pro справа, TG ID + copy, CTA)
- `browser-none.png` — `/account?expertCta=none` (без Pro)
- `browser-expired.png` — `/account?expertCta=expired`
- `browser-active.png` — `/account?expertCta=active`
- `browser-onboarding-none.png` — `/creator/onboarding?expertCta=none`

## После того как положил PNG

```bash
# 1.2 Проверка
ls -lah docs/assets/story-5.4/*.png
git status

# 1.3 Коммит + push (из корня репо, ветка chore/5-4-post-merge-artifacts)
git checkout chore/5-4-post-merge-artifacts
git add docs/assets/story-5.4/*.png
git commit -m "docs(5.4): add story-5.4 screenshots"
git push
```

## 1.4 В GitHub

- Убедись, что картинки отображаются в `PR_ARTIFACTS_STORY_5.4.md` в PR #27.
- Дождись зелёного CI: `gh pr checks 27 --watch`
- Merge: `gh pr merge 27 --merge --delete-branch`
