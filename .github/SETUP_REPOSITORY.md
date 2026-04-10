# Инструкция по созданию GitHub репозитория для v0.1

## Шаги

### 1. Создать приватный репозиторий на GitHub

1. Перейти на https://github.com/new
2. **Repository name**: `tracked-lms` (или другое имя по вашему выбору)
3. **Description**: `Telegram Mini App LMS - Version 0.1 Foundation`
4. **Visibility**: ✅ **Private**
5. **НЕ** инициализировать с README, .gitignore или license (у нас уже есть)
6. Нажать "Create repository"

### 2. Добавить remote и запушить код

```bash
# Проверить текущий remote (если есть)
git remote -v

# Если remote уже есть, можно удалить и добавить новый:
# git remote remove origin

# Добавить новый remote (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tracked-lms.git

# Или через SSH (если настроен):
# git remote add origin git@github.com:YOUR_USERNAME/tracked-lms.git

# Проверить, что remote добавлен
git remote -v

# Запушить все ветки
git push -u origin --all

# Запушить теги (если будут)
git push -u origin --tags
```

### 3. Создать Release v0.1.0 (опционально)

1. Перейти в репозиторий на GitHub
2. Нажать "Releases" → "Create a new release"
3. **Tag version**: `v0.1.0`
4. **Release title**: `v0.1.0 — Foundation (EPIC 0)`
5. **Description**: Скопировать содержимое из `.github/RELEASE_v0.1.md`
6. Нажать "Publish release"

### 4. Проверить

- ✅ Код запушен в репозиторий
- ✅ README.md отображается на главной странице
- ✅ Все файлы на месте
- ✅ CI workflow работает (при создании PR)

## Альтернатива: через GitHub CLI

Если установлен `gh`:

```bash
# Создать приватный репозиторий
gh repo create tracked-lms --private --source=. --remote=origin --push

# Создать release
gh release create v0.1.0 --title "v0.1.0 — Foundation (EPIC 0)" --notes-file .github/RELEASE_v0.1.md
```

## Проверка после пуша

```bash
# Убедиться, что все запушено
git log --oneline origin/main

# Проверить, что CI работает (создать тестовый PR или проверить Actions)
```
