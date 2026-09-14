// =====================================================
// ASTHL Flash Chat Widget — FULL TRAINING VERSION
// Website par embed karein — flash popup + floating chat
// =====================================================

(function() {
  'use strict';

  // ===== CONFIGURATION =====
  const API_URL = 'https://asthl-ask.vercel.app/api/chat';
  const FLASH_DELAY = 1500; // 1.5 second baad flash
  const FLASH_AUTO_CLOSE = 6000; // 6 second baad flash auto-close
  const WELCOME_MSG = 'नमस्ते! 🙏 क्या आपको कोई स्वास्थ्य समस्या है? मुझसे पूछें — होम्योपैथी में मदद कर सकता हूँ।';

  const SYSTEM_PROMPT = `ASTHL — Homeopathy Working Assistant

You are ASTHL, a working assistant for Riva Kumari, a homeopathy practitioner. You support homeopathic case analysis, repertory/rubric interpretation, Materia Medica study, remedy comparison, clinical notes, patient education, and the ASTHL project ("A Step Towards Healthy Life").

## Language & Style

- Default script: Devanagari. ALWAYS respond in Devanagari-script Hindi by default — never romanized/Hinglish (e.g., "aapko" is wrong; write Devanagari). This applies even if the user writes in romanized Hindi.
- Use respectful/formal Hindi, never informal pronouns.
- Keep it simple, clear, precise. Use English medical/technical terms where clearer, but keep them inline within Hindi sentences (e.g., "repertory rubric ka matlab...").
- Explain exact clinical meaning, not generic textbook statements. Expand with examples when asked.
- Direct factual question -> answer directly first, add explanation only as needed.
- "aur samjhao" / "or samjhao" -> expand with conceptual/clinical explanation, examples, comparisons.
- Only respond in English if the user explicitly asks for an English response.

## Size Prefixes (applied to EVERY query)

- s+ — short, minimal detail
- m+ — medium (DEFAULT if no prefix)
- l+ — long, deep research, exhaustive with sources
- Size prefix comes FIRST, then any instruction prefix, then content.
- Unknown prefix -> treat the entire line (including the prefix) as a normal query at m+ size. Do not ask what it means.

## r: — Rubric Analysis Query

When a query begins with r:, provide a structured rubric analysis ONLY (no general explanation unless asked). Use this exact output order:

1. Summary (Saransh) — primary rubrics + leading remedy considerations. PUT THIS FIRST.
2. Rogi ke Lakshan Vishleshan — break down the symptom into key components
3. Prathamic Rubric (Primary Rubric) — closest, most specific rubric from Murphy Repertory (preferred), with chapter/page reference
4. Dviteeyak/Sahayak Rubric (Secondary Rubrics) — supporting rubrics (modalities, concomitants, extensions)
5. Hindi Arth — clear Hindi meaning of each rubric
6. Rubric Kyun Fit Karti Hai — why the rubric fits the symptom
7. Rubric Vibhedan (Rubric Differentiation) — distinguish from similar rubrics
8. Prasangik Remedy (Relevant Remedies) — differentiation table with: remedy name (abbreviated), specificity/keynote, "kab chunein"
9. Materia Medica Satyapan — verify key remedy info from homeoint.org, cite the source
10. Rogi ke liye Mukhya Vibhedan Prashn — practical questions to narrow the remedy
11. Note — standard note: repertory/Materia Medica reference, not medical advice

Use clear headings and tables. Separate mind generals, physical generals, particulars, modalities, concomitants, and common symptoms where relevant.

## Auto Rubric Analysis

Any clinical line, symptom, or medical condition — even WITHOUT r: — also gets a brief homeopathic rubric analysis alongside the general explanation. Provide relevant rubric(s), Hindi meaning, why it fits, alternative rubrics, and relevant remedies (briefly). Skip only if the user explicitly says they only want the general/medical explanation.

## Repertory Hierarchy

1. Murphy Repertory (primary)
2. Synthesis Repertory (MUST be included — cross-checked and presented alongside Murphy)
3. Kent Repertory (included when relevant)

For each rubric, show which remedies appear in Murphy, Synthesis, and Kent respectively. If a remedy appears in all three, highlight it as a strong candidate. Do not automatically list large numbers of remedies — identify the characteristic symptom first, explain specificity, then match.

## Materia Medica

- Text in quotation marks -> explain line-by-line in Hindi: clinical/homeopathic meaning, not word-for-word translation. Highlight characteristic symptoms, remedy themes, distinctions from related remedies.
- When comparing remedies: mental picture, generalities, particulars, modalities, concomitants, keynotes, characteristic sensations, causation, remedy relationships — only when source-supported.
- Do not confuse "relationship" with "similarity."

## Medicine Cross-Match Rule (Section 17)

ALWAYS cross-match medicine information (remedy, dosage, potency, symptoms, relationships, Materia Medica) with homeoint.org before answering. If information cannot be verified, clearly state this. Never present medicine info as verified without cross-checking.

## ias: — ASTHL Ad Format

When a request begins with ias:, use the ASTHL ad structure:
1. Condition/attention-grabbing headline
2. Symptoms and warning signs
3. Possible causes
4. Jaruri Jaanch (necessary investigations) — NOT "Emergency — when to hospitalize"
5. How Homeopathy support works at ASTHL
6. Symptom-based Homeopathy medicines (where appropriate)
7. ASTHL contact/branding
No guaranteed cure claims.

## ai: — Update Master Profile

When the user writes ai: (alone or with content):
1. Review the current session for new long-term instructions.
2. Add/update those instructions in the master profile.
3. Bump the version number and update the "Last updated" date.
4. Generate the updated master profile file and present it for download.
5. Confirm what was updated.
If no new instructions, still generate and present the current master profile.

## Quality Rules

- Never fabricate citations, repertory entries, Materia Medica quotations, or remedy relationships.
- If a source is unavailable, say so. Distinguish exact quotations from paraphrases.
- Label uncertain rubrics as approximate, not exact.
- Do not overstate medical certainty. Do not invent patient facts.
- For serious, persistent, worsening, or dangerous symptoms, recommend appropriate medical assessment.
- Do not force a remedy simply because one symptom appears in its Materia Medica.
- Clearly distinguish repertory/Materia Medica reasoning from established medical evidence and safety considerations.

## Complex Case-Taking & Analysis Workflow (MANDATORY for all case inputs — text OR voice)

When a patient case is given, follow this EXACT step-by-step workflow. Do not skip steps. Do not jump to remedies directly.

### Step 0 (VOICE/AUDIO ONLY): Voice ko text mein convert karo
Agar user ne case voice/audio form mein upload kiya hai, toh sabse pehle uss voice ko text mein transcribe karo. User ko transcribed text dikhaao aur bolo: "Maine aapki voice ko text mein convert kiya hai — yeh sahi hai?" Tabhi aage badho jab user confirm kare.

### Step 1: Case ko chhoti-chhoti lines mein break karke SHOW karo
Patient ki saari information ko chhoti-chhoti individual symptom lines mein tod do. Numbered list mein dikhao.

### Step 2: User se CONFIRM karo — tabhi aage badho
Case break karne ke baad, user se explicitly poochho:
- "Kya mainne aapki saari pareshaniyan sahi samjha hai?"
- "Koi baat aisi hai jo main miss kar diya?"
STOP yahin par. Step 3 pe tabhi jao jab user confirm kare.

### Step 3: Prominent symptom identify karo (Second Priority)
Patient jo pareshani baar-baar dohrata hai, wahi prominent symptom hai.

### Step 4: Mental symptom dhoondho (First Priority)
Pure case ke beech se mental/emotional symptom samjhne ki koshish karo. Jo bhi patient sabse zyada mehsoos karta hai, woh First Priority mein aayega.

### Step 5: Unique/special symptoms identify karo (Third Priority)
Jo symptom unique ya special hai, aise peculiar/characteristic symptoms Third Priority mein aate hain.

### Step 6: General symptoms list karo (Fourth Priority)
Baki saari general symptoms ko list karo.

### Priority Order Summary:
1. First Priority: Patient ka sabse strong feeling/sensation
2. Second Priority: Prominent symptom — jo pareshani patient baar-baar dohrata hai
3. Third Priority: Unique/special/characteristic symptoms
4. Fourth Priority: General/common symptoms

### Step 7: Confirmed symptoms ko rubrics mein break karo
### Step 8: Repertory se rubric verify karo (Murphy -> Synthesis -> Kent)
### Step 9: Particular rubric tak pahunchne ki koshish
### Step 10: Saare symptoms ke rubrics bana lo
### Step 11: Repertory se medicines show karo
### Step 12: Final medicine list suggest karo

### Step 13: Medicine plan — kaise dena hai (MANDATORY)
1. First/Opening dose: Sabse pehle kaunsi medicine do. Explain karo kyun.
2. Constitutional remedy: Patient ke constitution ke hisaab se kaunsi main medicine deni hai.
3. Supportive medicines:
   - Mother tinctures: Kaunsi mother tincture supportive deni hai
   - Biochemic medicines: Kaunse biochemic medicine recovery speed up ke liye dein
Medicine plan mein clearly label karo: opening dose, constitutional, supportive. Potency aur dosage bhi suggest karo.

## ASTHL Project Context

- ASTHL = "A Step Towards Healthy Life" — homeopathy/health center.
- Areas: Health, Health Education, Wealth Creation.
- Website: asthl.in
- Branding: keep consistent with ASTHL. Use Hindi unless English is requested.
- For marketing/health content: avoid unsupported cure claims. Keep medical claims responsible and evidence-aware.`;

  // ===== State =====
  let messages = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: 'नमस्ते! मैं ASTHL होम्योपैथी असिस्टेंट हूँ। रूब्रिक एनालिसिस, मैटेरिया मेडिका, केस एनालिसिस — सब कुछ पूछें। r:, ias:, ai:, s+, m+, l+ जैसे प्रीफिक्स भी उपयोग कर सकते हैं।' }] }
  ];
  let isOpen = false;
  let isFlashing = false;

  // ===== Inject CSS =====
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');

    #asthl-chat-root * {
      margin: 0; padding: 0; box-sizing: border-box;
      font-family: 'Noto Sans Devanagari', system-ui, -apple-system, sans-serif;
    }

    #asthl-chat-root {
      position: fixed; bottom: 0; right: 0; z-index: 999999;
      pointer-events: none;
    }

    /* ===== Floating Button ===== */
    #asthl-chat-btn {
      position: fixed;
      bottom: 20px; right: 20px;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0d9488, #0f766e);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      pointer-events: auto;
      transition: all 0.3s ease;
      animation: asthl-pulse 2s infinite;
    }
    #asthl-chat-btn:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(13, 148, 136, 0.5); }
    #asthl-chat-btn svg { width: 28px; height: 28px; fill: white; }

    @keyframes asthl-pulse {
      0% { box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4), 0 0 0 0 rgba(13, 148, 136, 0.4); }
      70% { box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4), 0 0 0 15px rgba(13, 148, 136, 0); }
      100% { box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4), 0 0 0 0 rgba(13, 148, 136, 0); }
    }

    /* ===== Flash Popup ===== */
    #asthl-flash {
      position: fixed;
      bottom: 90px; right: 20px;
      max-width: 320px; min-width: 260px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      overflow: hidden;
      z-index: 999998;
      pointer-events: auto;
      border: 1px solid #ccfbf1;
      transform: translateY(20px) scale(0.9);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #asthl-flash.show { transform: translateY(0) scale(1); opacity: 1; }

    #asthl-flash-header {
      background: linear-gradient(135deg, #0d9488, #0f766e);
      color: white;
      padding: 10px 14px;
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600;
    }
    #asthl-flash-header .dot {
      width: 8px; height: 8px; border-radius: 50%; background: #4ade80; flex-shrink: 0;
    }
    #asthl-flash-close {
      margin-left: auto; cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.8;
    }
    #asthl-flash-close:hover { opacity: 1; }

    #asthl-flash-body {
      padding: 12px 14px;
      font-size: 14px; color: #134e4a; line-height: 1.5;
    }
    #asthl-flash-cta {
      display: inline-block;
      margin-top: 8px;
      padding: 6px 16px;
      background: #0d9488; color: white;
      border-radius: 20px; font-size: 13px; font-weight: 500;
      cursor: pointer; border: none;
      font-family: inherit;
    }
    #asthl-flash-cta:hover { background: #0f766e; }

    /* ===== Chat Window ===== */
    #asthl-chat-window {
      position: fixed;
      bottom: 90px; right: 20px;
      width: 370px; height: 520px; max-height: calc(100dvh - 110px);
      background: #f0fdfa;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      pointer-events: auto;
      border: 1px solid #ccfbf1;
    }
    #asthl-chat-window.open { display: flex; animation: asthl-slide-up 0.3s ease-out; }

    @keyframes asthl-slide-up {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    #asthl-chat-window-header {
      background: linear-gradient(135deg, #0d9488, #0f766e);
      color: white;
      padding: 12px 16px;
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    #asthl-chat-window-header .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 15px;
    }
    #asthl-chat-window-header .info { flex: 1; }
    #asthl-chat-window-header .info .name { font-size: 14px; font-weight: 600; }
    #asthl-chat-window-header .info .status { font-size: 11px; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
    #asthl-chat-window-header .info .status .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
    #asthl-chat-window-header .close {
      cursor: pointer; font-size: 20px; line-height: 1; opacity: 0.8;
    }
    #asthl-chat-window-header .close:hover { opacity: 1; }

    #asthl-chat-messages {
      flex: 1; overflow-y: auto;
      padding: 12px; display: flex; flex-direction: column; gap: 8px;
    }
    #asthl-chat-messages::-webkit-scrollbar { width: 4px; }
    #asthl-chat-messages::-webkit-scrollbar-thumb { background: #5eead4; border-radius: 4px; }

    .asthl-msg {
      max-width: 85%; padding: 10px 14px; border-radius: 12px;
      font-size: 14px; line-height: 1.55; word-wrap: break-word; overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .asthl-msg.user {
      align-self: flex-end; background: #0d9488; color: white; border-bottom-right-radius: 4px;
    }
    .asthl-msg.bot {
      align-self: flex-start; background: white; color: #134e4a;
      border: 1px solid #ccfbf1; border-bottom-left-radius: 4px;
    }
    .asthl-msg.error {
      align-self: center; background: #fef2f2; color: #e11d48; border: 1px solid #fecaca; font-size: 12px; text-align: center;
    }

    .asthl-typing {
      align-self: flex-start; background: white; border: 1px solid #ccfbf1;
      border-radius: 12px; padding: 10px 14px; display: flex; gap: 4px;
    }
    .asthl-typing span {
      width: 6px; height: 6px; border-radius: 50%; background: #5eead4;
      animation: asthl-typing 1.2s infinite;
    }
    .asthl-typing span:nth-child(2) { animation-delay: 0.2s; }
    .asthl-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes asthl-typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    #asthl-chat-input-area {
      background: white; border-top: 1px solid #ccfbf1;
      padding: 8px 10px; display: flex; gap: 6px; align-items: flex-end; flex-shrink: 0;
    }
    #asthl-chat-input {
      flex: 1; border: 1px solid #ccfbf1; border-radius: 20px;
      padding: 8px 12px; font-size: 14px; font-family: inherit;
      color: #134e4a; outline: none; resize: none; max-height: 80px; line-height: 1.4;
      background: #f0fdfa;
    }
    #asthl-chat-input:focus { border-color: #0d9488; }
    #asthl-chat-send {
      width: 38px; height: 38px; border: none; border-radius: 50%;
      background: #0d9488; color: white; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      transition: all 0.15s;
    }
    #asthl-chat-send:hover { background: #0f766e; }
    #asthl-chat-send:disabled { opacity: 0.5; }
    #asthl-chat-send svg { width: 18px; height: 18px; fill: white; }

    #asthl-chat-disclaimer {
      font-size: 10px; color: #94a3b8; text-align: center; padding: 4px 10px 6px; background: white;
    }

    /* ===== Mobile ===== */
    @media (max-width: 600px) {
      #asthl-chat-window {
        width: 100vw; height: 100dvh; right: 0; bottom: 0;
        border-radius: 0; border: none;
      }
      #asthl-flash { right: 10px; left: 10px; max-width: none; }
      #asthl-chat-btn { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // ===== Create DOM =====
  const root = document.createElement('div');
  root.id = 'asthl-chat-root';
  document.body.appendChild(root);

  // Floating button
  const btn = document.createElement('button');
  btn.id = 'asthl-chat-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  root.appendChild(btn);

  // Flash popup
  const flash = document.createElement('div');
  flash.id = 'asthl-flash';
  flash.innerHTML = '<div id="asthl-flash-header"><span class="dot"></span><span>ASTHL — Online</span><span id="asthl-flash-close">&times;</span></div><div id="asthl-flash-body">' + WELCOME_MSG + '<br><button id="asthl-flash-cta">\u{1F4AC} \u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902</button></div>';
  root.appendChild(flash);

  // Chat window
  const win = document.createElement('div');
  win.id = 'asthl-chat-window';
  win.innerHTML = '<div id="asthl-chat-window-header"><div class="avatar">A</div><div class="info"><div class="name">ASTHL Assistant</div><div class="status"><span class="dot"></span> Online</div></div><span class="close" id="asthl-chat-close">&times;</span></div><div id="asthl-chat-messages"></div><div id="asthl-chat-input-area"><textarea id="asthl-chat-input" rows="1" placeholder="\u0905\u092A\u0928\u093E \u092A\u094D\u0930\u0936\u094D\u0928 \u0932\u093F\u0916\u0947\u0902... (r:, ias:, ai:, s+, m+, l+ \u092D\u0940 \u0907\u0938\u094D\u0924\u0947\u092E\u093E\u0932 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902)"></textarea><button id="asthl-chat-send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button></div><div id="asthl-chat-disclaimer">ASTHL — A Step Towards Healthy Life | \u0936\u0948\u0915\u094D\u0937\u093F\u0915 \u0909\u0926\u094D\u0926\u0947\u0936\u094D\u092F, \u091A\u093F\u0915\u093F\u0924\u094D\u0938\u0915\u0940\u092F \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0928\u0939\u0940\u0902</div>';
  root.appendChild(win);

  // ===== DOM refs =====
  const msgContainer = document.getElementById('asthl-chat-messages');
  const input = document.getElementById('asthl-chat-input');
  const sendBtn = document.getElementById('asthl-chat-send');

  // ===== Helpers =====
  function scrollDown() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function addMsg(text, type) {
    const el = document.createElement('div');
    el.className = 'asthl-msg ' + type;
    el.textContent = text;
    msgContainer.appendChild(el);
    scrollDown();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'asthl-typing';
    el.id = 'asthl-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgContainer.appendChild(el);
    scrollDown();
  }

  function hideTyping() {
    const el = document.getElementById('asthl-typing-indicator');
    if (el) el.remove();
  }

  // ===== Flash logic =====
  function showFlash() {
    if (isOpen) return;
    isFlashing = true;
    flash.classList.add('show');
    setTimeout(function() {
      if (isFlashing && !isOpen) {
        hideFlash();
      }
    }, FLASH_AUTO_CLOSE);
  }

  function hideFlash() {
    flash.classList.remove('show');
    isFlashing = false;
  }

  // ===== Open/close chat =====
  function openChat() {
    isOpen = true;
    hideFlash();
    win.classList.add('open');
    if (msgContainer.children.length === 0) {
      addMsg('\u0928\u092E\u0938\u094D\u0924\u0947! \u{1F64F} \u092E\u0948\u0902 ASTHL \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F \u0939\u0942\u0901\u0964 \u0930\u0942\u092C\u094D\u0930\u093F\u0915 \u090F\u0928\u093E\u0932\u093F\u0938\u093F\u0938, \u092E\u0948\u091F\u0947\u0930\u093F\u092F\u093E \u092E\u0947\u0921\u093F\u0915\u093E, \u0930\u0947\u092E\u0947\u0921\u0940 \u0924\u0941\u0932\u0928\u093E, \u0915\u0947\u0938 \u090F\u0928\u093E\u0932\u093F\u0938\u093F\u0938 — \u0938\u092C \u0915\u0941\u091B \u092A\u0942\u091B\u0947\u0902\u0964 r:, ias:, ai:, s+, m+, l+ \u091C\u0948\u0938\u0947 \u092A\u094D\u0930\u0940\u092B\u093F\u0915\u094D\u0938 \u092D\u0940 \u0909\u092A\u092F\u094B\u0917 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964', 'bot');
    }
    setTimeout(function() { input.focus(); }, 300);
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
  }

  // ===== Event listeners =====
  btn.addEventListener('click', function() {
    if (isOpen) { closeChat(); } else { openChat(); }
  });

  document.getElementById('asthl-flash-close').addEventListener('click', hideFlash);
  document.getElementById('asthl-flash-cta').addEventListener('click', openChat);
  document.getElementById('asthl-chat-close').addEventListener('click', closeChat);

  input.addEventListener('input', function() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });

  sendBtn.addEventListener('click', sendMsg);

  // ===== Send message =====
  async function sendMsg() {
    var text = input.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    addMsg(text, 'user');
    messages.push({ role: 'user', parts: [{ text: text }] });
    showTyping();

    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages })
      });

      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        throw new Error(err.error || 'Server error');
      }

      var data = await res.json();
      var reply = data.reply || '\u0915\u094D\u0937\u092E\u093E \u0915\u0930\u0947\u0902, \u0938\u092E\u091D \u0928\u0939\u0940\u0902 \u0906\u092F\u093E\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964';

      addMsg(reply, 'bot');
      messages.push({ role: 'model', parts: [{ text: reply }] });

    } catch (err) {
      hideTyping();
      addMsg('\u0924\u094D\u0930\u0941\u091F\u093F: ' + err.message + '. \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964', 'error');
    } finally {
      hideTyping();
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ===== Auto flash on page load =====
  setTimeout(showFlash, FLASH_DELAY);
})();
