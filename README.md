# CN Ops Portal

## To run it on this machine

Open Terminal, paste these two lines one at a time.

    cd ~/Documents/CN-Ops.env.local
    npm install

Then

    npm run dev

Open http://localhost:3300 in your browser.

The first page is a connection check. It tells you whether Sanity, Google and OpenAI are wired up correctly, and what is wrong if they are not.

## Files that must never be committed

.env.local and the Google service account JSON. Both are already in .gitignore.
