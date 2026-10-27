# Exam Warriors

Study library, practice quizzes and a shared leaderboard for NDU students, with a
password-protected admin page.

- Students: `/`  (Library, Quizzes, Leaderboard)
- You (admin): `/admin`

No build step. The server uses only Node's built-in modules. The `mongodb` package is
loaded only when you connect a database.

## Run it on your computer

1. Install Node.js 18 or newer from nodejs.org.
2. In this folder, run:

       npm install
       ADMIN_PASSWORD="choose-a-strong-password" npm start

   On Windows (Command Prompt):

       set ADMIN_PASSWORD=choose-a-strong-password
       npm start

3. Open http://localhost:3000 and http://localhost:3000/admin.

Locally, data is saved in the `data` folder.

## Put it online for free (Render + MongoDB Atlas)

Free hosts wipe their local disk on every restart, so the site keeps its data in a free
MongoDB Atlas database instead. Free plans and limits change, so check each site's
current pricing page.

**1. Database (MongoDB Atlas)**
1. Create a free account at mongodb.com/atlas and create a free (M0) cluster.
2. Database Access: add a database user with a password.
3. Network Access: add the IP address `0.0.0.0/0` (Render's addresses change).
4. Connect > Drivers: copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/`. Put your real password in it.

**2. Code (GitHub)**
1. Create a free GitHub account and a new empty repository.
2. Upload every file in this folder (the `node_modules` and `data` folders are not needed).

**3. Website (Render)**
1. Create a free account at render.com, then New > Web Service, and connect the repository.
2. Settings: Runtime `Node`, Build command `npm install`, Start command `npm start`.
3. Environment variables (these keep secrets out of your code):
   - `ADMIN_PASSWORD` = a strong password only you know
   - `MONGODB_URI` = the connection string from step 1
4. Deploy. Render gives you a link like `https://exam-warriors.onrender.com`.

Share that link with students. Go to `/admin` on the same link to log in.

Note: on Render's free plan the site goes to sleep when nobody visits for a while, so the
first visit after a quiet period can take about a minute to load. Your data is not lost.

## Using the admin page

- **Notice banner:** one line shown at the top of the site (test dates, announcements).
- **Add study material:** a title, course and type, plus any of: note text, a file
  (PDF, Word, PowerPoint, Excel, images, CSV, text; up to 12 MB) or a link.
- **Create a quiz:** one question per line:

      Question | Option A | Option B | Option C | Option D | Answer letter | Explanation (optional)

  Example:

      Which enzyme joins Okazaki fragments? | DNA polymerase I | DNA ligase | Helicase | Primase | B | Ligase seals the nicks.

- **Remove** anything you published, or a name from the leaderboard.

## How scoring works

Students do not need accounts. Each phone gets a private random ID saved in its browser,
and scores are tied to it. The server marks the answers itself, so scores cannot be faked
by editing the page. A student who clears their browser data or switches phone starts as a
new warrior. Points are 10 per correct answer, counted from the best attempt at each quiz.

## Security notes

- Set a long `ADMIN_PASSWORD`. Without one, the admin page stays switched off.
- Admin login is limited to a few tries per 15 minutes and lasts 12 hours.
- Uploaded files are checked by type and contents, and are served in a sandbox.
- Do not publish the connection string or password anywhere public.
