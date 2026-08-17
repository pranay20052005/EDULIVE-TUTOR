export function renderErrorPage() {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>EduLive — Something went wrong</title>
      <style>
        :root { color-scheme: light dark; }
        body { margin: 0; font-family: system-ui, sans-serif; background: #0b1220; color: white; display: grid; place-items: center; min-height: 100vh; }
        .card { max-width: 560px; padding: 2rem; border-radius: 18px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); text-align: center; }
        h1 { font-size: clamp(2rem, 4vw, 3rem); margin: 0 0 1rem; }
        p { margin: 0; opacity: .8; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Something went wrong</h1>
        <p>The EduLive app hit an unexpected server error. Please refresh and try again.</p>
      </div>
    </body>
  </html>`;
}
