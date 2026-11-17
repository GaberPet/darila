# Seznam želja 🎁

A gift wishlist website (in Slovenian), hosted for free on GitHub Pages.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The page |
| `css/slog.css` | All the styling |
| `js/stran.js` | Loads gifts and games, filters, favorites, details popup |
| `js/admin.js` | Password login and the add / edit / delete gift form |
| `podatki/darila.json` | Your gifts (the site edits this for you) |
| `podatki/nastavitve.json` | Your name, Steam link, and the locked GitHub key |
| `podatki/igre.json` | Steam games (filled automatically every day) |
| `skripte/steam.py` | Reads your Steam wishlist |
| `.github/workflows/objavi.yml` | Publishes the site and refreshes Steam games daily |

## 1. Put it on GitHub

1. Make a free account at github.com.
2. Create a **new public repository**, for example `darila`.
3. Click **Add file → Upload files** and drag in **everything inside this folder**, including the `.github` folder. Then click **Commit changes**.
   - If the `.github` folder doesn't upload (it's hidden on some computers), click **Add file → Create new file**, type `.github/workflows/objavi.yml` as the name, paste in the contents of that file, and commit.
4. Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. Open the **Actions** tab. When "Objavi stran" turns green, your site is live at
   `https://YOUR-USERNAME.github.io/darila/`

## 2. Make a GitHub key (so the "Dodaj darilo" button can save)

1. On GitHub: your avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `seznam zelja`. Expiration: pick the longest option offered.
3. **Repository access → Only select repositories →** pick your `darila` repo.
4. **Permissions → Repository permissions:**
   - **Contents: Read and write** (needed)
   - **Actions: Read and write** (only needed for the "🔄 Osveži Steam igre" button)
5. Generate the key and copy it. It starts with `github_pat_`.

## 3. First login

1. Open your site and click **🔒 Dodaj darilo** at the bottom.
2. Fill in your GitHub username, the repo name, the key, and a **new password** for the site (at least 10 characters, one you don't use anywhere else).
3. Done. From now on, clicking **Dodaj darilo** only asks for that password.

How this stays safe: the key is saved in `nastavitve.json` **locked with your password** (AES encryption), so someone who reads the file can't use the key without the password. Use a long password, because the locked key sits in a public repo. If you ever forget the password, or the key expires, click **"Nastavi nov GitHub ključ"** in the login window and make a new key.

After you save a gift, it takes **1–2 minutes** before everyone else can see it.

## 4. Connect Steam

1. On Steam: **Profile → Edit Profile → Privacy Settings → Game details: Public**. Your wishlist has to be public.
2. On your site, log in → **⚙️ Nastavitve** → paste your profile link (e.g. `https://steamcommunity.com/id/yourname/`) → Save.
3. Your games appear a few minutes later and refresh **automatically every day**. Click **🔄 Osveži Steam igre** if you don't want to wait.

Note: GitHub pauses the daily run if a public repo has had no changes for 60 days. If that happens, add a gift or click the refresh button, and it starts again.

## 5. Your own domain (optional)

Buy a domain (see the domain notes from Claude), then on GitHub go to **Settings → Pages → Custom domain** and enter it. At your domain registrar, add the DNS records GitHub shows you, then tick **Enforce HTTPS**.

## Try it on your computer

```bash
python -m http.server 8000
```
Then open http://localhost:8000. The page loads, but saving only works on the real site, because it saves to GitHub.
