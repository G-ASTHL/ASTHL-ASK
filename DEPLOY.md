# Patient Health Assistant — 100% FREE Deploy Guide

## Yeh kya hai?

Ek web chat app jisme patient apna sawaal pooch sakta hai aur Hinglish/Hindi/English mein jawab milta hai. **Bilkul free** — koi credits nahi, koi payment nahi.

## Kyun free hai?

| Cheez | Cost |
|-------|------|
| Google Gemini API | FREE (1,500 requests/day, 15/min) |
| Vercel hosting | FREE (100GB bandwidth/month) |
| Domain | FREE (`aapka-naam.vercel.app`) |
| **Total** | **₹0** |

---

## Deploy ke 4 steps (5-10 minute)

### Step 1: Google Gemini API key lo (2 min)

1. aistudio.google.com par jao
2. Google account se sign in karo
3. "Get API Key" ya "Create API Key" click karo
4. Key copy kar lo (kuch is tarah dikhega: `AIzaSy...`)

> Note: Koi credit card nahi chahiye. Free tier automatically apply hota hai.

### Step 2: Files GitHub par daalo (2 min)

1. GitHub.com par jao, naya repository banao (naam: `patient-chat`)
2. "uploading an existing file" par click karo
3. Zip se files drag kar do:
   - `index.html`
   - `api/chat.js`
   - `vercel.json`
4. "Commit changes" click karo

### Step 3: Vercel par deploy karo (2 min)

1. vercel.com par jao, "Sign Up" → "Continue with GitHub"
2. "Add New Project" click karo
3. Apna `patient-chat` repo select karo
4. "Environment Variables" par click karo:
   - Name: `GEMINI_API_KEY`
   - Value: (Step 1 ki key paste karo)
5. "Deploy" click karo — 1 minute mein live!

### Step 4: Link share karo

- Vercel ek link dega: `patient-chat.vercel.app`
- Yeh link patients ko WhatsApp/SMS/Slack se bhej do
- Patient phone mein khol lega — chat khulega
- Bas type karein aur jawab mil jayega

---

## Free tier limits

| Limit | Value |
|-------|-------|
| Requests per day | 1,500 |
| Requests per minute | 15 |
| Tokens per minute | 1,00,000 |
| Max output length | 1,000 tokens (~750 words) |

Agar 1,500/day se zyada chahiye to multiple API keys bana sakti ho (har key ka apna free quota hota hai).

---

## Customization

### Agent ka naam badalna
`index.html` mein `<h1>Health Assistant</h1>` ko apna naam do.

### System prompt badalna
`index.html` mein `messages` array ka pehla object edit karo — agent ko kaise behave karna hai woh define kar sakti ho.

### Color badalna
`index.html` mein `:root` mein `--accent: #0d9488;` ko apni pasand ka color rakho.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "API error: 400" | API key galat hai — dobara check karo |
| "API error: 429" | Free limit exceed ho gaya — thodi der wait karo (15/min reset hota hai) |
| Response bahut lamba | `api/chat.js` mein `maxOutputTokens: 1000` kam kar do |
| Site nahi khulta | Vercel dashboard mein deploy status check karo |
| Hindi text toota dikhta | Browser font issue — kuch nahi karna, phone pe theek chalega |

---

## Alternative: Agar GitHub mushkil lage

Aap files directly Vercel par bhi upload kar sakti ho:

1. Vercel dashboard → "Add New" → "Import"
2. "Deploy from folder" ya "Browse all templates"
3. Files manually upload karo
4. Environment variable mein `GEMINI_API_KEY` set karo
5. Deploy

Ya Netlify par:
1. netlify.com → "Add new site" → "Deploy manually"
2. Folder drag-and-drop karo
3. Site settings → Functions → add karo
4. Environment variable set karo
