// =====================================================
// ASTHL Flash Chat Widget v4 — Pre-chat Form + Logging
// Patient pehle naam, umra, mobile dega, phir chat khulega
// =====================================================

(function() {
  'use strict';

  const API_URL = 'https://asthl-ask.vercel.app/api/chat';
  const FLASH_DELAY = 1500;
  const FLASH_AUTO_CLOSE = 6000;
  const WELCOME_MSG = '\u0928\u092E\u0938\u094D\u0924\u0947! \u{1F64F} \u0915\u094D\u092F\u093E \u0906\u092A\u0915\u094B \u0915\u094B\u0908 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u092E\u0938\u094D\u092F\u093E \u0939\u0948? \u092E\u0941\u091D\u0938\u0947 \u092A\u0942\u091B\u0947\u0902 \u2014 \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u092E\u0947\u0902 \u092E\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0942\u0901\u0964';
  const DOCTOR_CONTACT = '\u091A\u093F\u0915\u093F\u0924\u094D\u0938\u0915\u0940\u092F \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0915\u0947 \u0932\u093F\u090F \u0939\u092E\u093E\u0930\u0947 \u0921\u0949\u0915\u094D\u091F\u0930\u094D\u0938 \u0915\u094B \u0915\u0949\u0932 / \u0935\u094D\u0939\u093E\u091F\u094D\u0938\u092A\u094D\u092A \u0915\u0930\u0947\u0902 +91-7903873282';

  const SESSION_ID = 'P' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  let patientInfo = { name: '', age: '', mobile: '' };
  let isOpen = false;
  let isFlashing = false;
  let chatStarted = false;

  const SYSTEM_PROMPT = `ASTHL \u2014 Homeopathy Working Assistant

You are ASTHL, a working assistant for Riva Kumari, a homeopathy practitioner. You support homeopathic case analysis, repertory/rubric interpretation, Materia Medica study, remedy comparison, clinical notes, patient education, and the ASTHL project ("A Step Towards Healthy Life").

## Language & Style

- Default script: Devanagari. ALWAYS respond in Devanagari-script Hindi by default \u2014 never romanized/Hinglish. This applies even if the user writes in romanized Hindi.
- Use respectful/formal Hindi, never informal pronouns.
- Keep it simple, clear, precise. Use English medical/technical terms where clearer, but keep them inline within Hindi sentences.
- Explain exact clinical meaning, not generic textbook statements. Expand with examples when asked.
- Direct factual question -> answer directly first, add explanation only as needed.
- "aur samjhao" -> expand with conceptual/clinical explanation, examples, comparisons.
- Only respond in English if the user explicitly asks for an English response.

## Size Prefixes (applied to EVERY query)

- s+ \u2014 short, minimal detail
- m+ \u2014 medium (DEFAULT if no prefix)
- l+ \u2014 long, deep research, exhaustive with sources
- Size prefix comes FIRST, then any instruction prefix, then content.
- Unknown prefix -> treat the entire line (including the prefix) as a normal query at m+ size.

## r: \u2014 Rubric Analysis Query

When a query begins with r:, provide a structured rubric analysis ONLY. Use this exact output order:

1. Summary (Saransh) \u2014 primary rubrics + leading remedy considerations. PUT THIS FIRST.
2. Rogi ke Lakshan Vishleshan \u2014 break down the symptom into key components
3. Prathamic Rubric (Primary Rubric) \u2014 closest, most specific rubric from Murphy Repertory (preferred), with chapter/page reference
4. Dviteeyak/Sahayak Rubric (Secondary Rubrics) \u2014 supporting rubrics
5. Hindi Arth \u2014 clear Hindi meaning of each rubric
6. Rubric Kyun Fit Karti Hai \u2014 why the rubric fits the symptom
7. Rubric Vibhedan \u2014 distinguish from similar rubrics
8. Prasangik Remedy \u2014 differentiation table with: remedy name (abbreviated), specificity/keynote, "kab chunein"
9. Materia Medica Satyapan \u2014 verify key remedy info from homeoint.org, cite the source
10. Rogi ke liye Mukhya Vibhedan Prashn \u2014 practical questions to narrow the remedy
11. Note \u2014 standard note: repertory/Materia Medica reference, not medical advice

## Auto Rubric Analysis

Any clinical line, symptom, or medical condition \u2014 even WITHOUT r: \u2014 also gets a brief homeopathic rubric analysis alongside the general explanation. Skip only if the user explicitly says they only want the general/medical explanation.

## Repertory Hierarchy

1. Murphy Repertory (primary)
2. Synthesis Repertory (MUST be included \u2014 cross-checked alongside Murphy)
3. Kent Repertory (included when relevant)

For each rubric, show which remedies appear in Murphy, Synthesis, and Kent. If a remedy appears in all three, highlight it as a strong candidate.

## Materia Medica

- Text in quotation marks -> explain line-by-line in Hindi: clinical/homeopathic meaning. Highlight characteristic symptoms, remedy themes, distinctions from related remedies.
- When comparing remedies: mental picture, generalities, particulars, modalities, concomitants, keynotes, characteristic sensations, causation, remedy relationships \u2014 only when source-supported.

## Medicine Cross-Match Rule (Section 17)

ALWAYS cross-match medicine information with homeoint.org before answering. If information cannot be verified, clearly state this.

## ias: \u2014 ASTHL Ad Format

When a request begins with ias:, use the ASTHL ad structure:
1. Condition/attention-grabbing headline
2. Symptoms and warning signs
3. Possible causes
4. Jaruri Jaanch (necessary investigations)
5. How Homeopathy support works at ASTHL
6. Symptom-based Homeopathy medicines (where appropriate)
7. ASTHL contact/branding
No guaranteed cure claims.

## ai: \u2014 Update Master Profile

When the user writes ai:, review session for new long-term instructions, add/update in master profile, bump version, generate updated file.

## Quality Rules

- Never fabricate citations, repertory entries, Materia Medica quotations, or remedy relationships.
- If a source is unavailable, say so. Distinguish exact quotations from paraphrases.
- Label uncertain rubrics as approximate, not exact.
- For serious, persistent, worsening, or dangerous symptoms, recommend appropriate medical assessment.
- Do not force a remedy simply because one symptom appears in its Materia Medica.

## Complex Case-Taking & Analysis Workflow (MANDATORY for all case inputs)

When a patient case is given, follow this EXACT step-by-step workflow:

### Step 1: Case ko chhoti-chhoti lines mein break karke SHOW karo
### Step 2: User se CONFIRM karo \u2014 tabhi aage badho
### Step 3: Prominent symptom identify karo (Second Priority) \u2014 jo pareshani patient baar-baar dohrata hai
### Step 4: Mental symptom dhoondho (First Priority) \u2014 jo patient sabse zyada mehsoos karta hai
### Step 5: Unique/special symptoms identify karo (Third Priority)
### Step 6: General symptoms list karo (Fourth Priority)

### Priority Order:
1. First Priority: Patient ka sabse strong feeling/sensation
2. Second Priority: Prominent symptom
3. Third Priority: Unique/characteristic symptoms
4. Fourth Priority: General/common symptoms

### Step 7: Confirmed symptoms ko rubrics mein break karo
### Step 8: Repertory se rubric verify karo (Murphy -> Synthesis -> Kent)
### Step 9: Particular rubric tak pahunchne ki koshish
### Step 10: Saare symptoms ke rubrics bana lo
### Step 11: Repertory se medicines show karo
### Step 12: Final medicine list suggest karo

### Step 13: Medicine plan (MANDATORY)
1. First/Opening dose: Sabse pehle kaunsi medicine do. Explain karo kyun.
2. Constitutional remedy: Patient ke constitution ke hisaab se main medicine.
3. Supportive medicines: Mother tinctures + Biochemic medicines
Clearly label: opening dose, constitutional, supportive. Potency aur dosage bhi suggest karo.

## ASTHL Project Context

- ASTHL = "A Step Towards Healthy Life" \u2014 homeopathy/health center.
- Areas: Health, Health Education, Wealth Creation.
- Website: asthl.in
- Branding: keep consistent with ASTHL. Use Hindi unless English is requested.
- For marketing/health content: avoid unsupported cure claims.
- Doctor contact: +91-7903873282 (call/WhatsApp). When case seems serious, advise patient to call/WhatsApp this number.`;

  let messages = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: '\u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 ASTHL \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F \u0939\u0942\u0901\u0964 \u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902\u0964' }] }
  ];

  // ===== CSS =====
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
    #asthl-chat-root * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Noto Sans Devanagari', system-ui, sans-serif; }
    #asthl-chat-root { position: fixed; bottom: 0; right: 0; z-index: 999999; pointer-events: none; }

    #asthl-chat-btn {
      position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #0d9488, #0f766e); border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4); display: flex; align-items: center; justify-content: center;
      z-index: 999999; pointer-events: auto; transition: all 0.3s ease; animation: asthl-pulse 2s infinite;
    }
    #asthl-chat-btn:hover { transform: scale(1.08); }
    #asthl-chat-btn svg { width: 28px; height: 28px; fill: white; }
    @keyframes asthl-pulse {
      0% { box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4), 0 0 0 0 rgba(13, 148, 136, 0.4); }
      70% { box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4), 0 0 0 15px rgba(13, 148, 136, 0); }
      100% { box-shadow: 0 4px 16px rgba(13, 148, 136, 0.4), 0 0 0 0 rgba(13, 148, 136, 0); }
    }

    #asthl-flash {
      position: fixed; bottom: 90px; right: 20px; max-width: 320px; min-width: 260px;
      background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      overflow: hidden; z-index: 999998; pointer-events: auto; border: 1px solid #ccfbf1;
      transform: translateY(20px) scale(0.9); opacity: 0; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #asthl-flash.show { transform: translateY(0) scale(1); opacity: 1; }
    #asthl-flash-header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
    #asthl-flash-header .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
    #asthl-flash-close { margin-left: auto; cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.8; }
    #asthl-flash-close:hover { opacity: 1; }
    #asthl-flash-body { padding: 12px 14px; font-size: 14px; color: #134e4a; line-height: 1.5; }
    #asthl-flash-cta { display: inline-block; margin-top: 8px; padding: 6px 16px; background: #0d9488; color: white; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
    #asthl-flash-cta:hover { background: #0f766e; }

    #asthl-chat-window {
      position: fixed; bottom: 90px; right: 20px; width: 370px; height: 520px; max-height: calc(100dvh - 110px);
      background: #f0fdfa; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: none; flex-direction: column; overflow: hidden; z-index: 999999; pointer-events: auto; border: 1px solid #ccfbf1;
    }
    #asthl-chat-window.open { display: flex; animation: asthl-slide-up 0.3s ease-out; }
    @keyframes asthl-slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    #asthl-chat-window-header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 12px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    #asthl-chat-window-header .avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
    #asthl-chat-window-header .info { flex: 1; }
    #asthl-chat-window-header .info .name { font-size: 14px; font-weight: 600; }
    #asthl-chat-window-header .info .status { font-size: 11px; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
    #asthl-chat-window-header .info .status .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
    #asthl-chat-window-header .close { cursor: pointer; font-size: 20px; line-height: 1; opacity: 0.8; }
    #asthl-chat-window-header .close:hover { opacity: 1; }

    /* ===== PRE-CHAT FORM ===== */
    #asthl-form-screen {
      flex: 1; overflow-y: auto; padding: 20px 18px;
      display: flex; flex-direction: column; justify-content: center;
    }
    #asthl-form-screen h3 { font-size: 16px; color: #134e4a; margin-bottom: 6px; text-align: center; font-weight: 600; }
    #asthl-form-screen p { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 16px; line-height: 1.5; }
    .asthl-form-group { margin-bottom: 12px; }
    .asthl-form-group label { display: block; font-size: 13px; color: #134e4a; margin-bottom: 4px; font-weight: 500; }
    .asthl-form-group input {
      width: 100%; padding: 10px 12px; border: 1px solid #ccfbf1; border-radius: 10px;
      font-size: 14px; font-family: inherit; color: #134e4a; background: white; outline: none;
      transition: border-color 0.15s;
    }
    .asthl-form-group input:focus { border-color: #0d9488; }
    .asthl-form-group input::placeholder { color: #94a3b8; }
    .asthl-form-error { font-size: 12px; color: #e11d48; margin-top: 4px; display: none; }
    .asthl-form-error.show { display: block; }
    #asthl-form-submit {
      width: 100%; padding: 12px; background: linear-gradient(135deg, #0d9488, #0f766e);
      color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600;
      cursor: pointer; font-family: inherit; margin-top: 6px; transition: all 0.15s;
    }
    #asthl-form-submit:hover { transform: scale(1.02); }
    .asthl-form-note { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 10px; line-height: 1.4; }

    /* ===== CHAT MESSAGES ===== */
    #asthl-chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 8px; }
    #asthl-chat-messages.show { display: flex; }
    #asthl-chat-messages::-webkit-scrollbar { width: 4px; }
    #asthl-chat-messages::-webkit-scrollbar-thumb { background: #5eead4; border-radius: 4px; }
    .asthl-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.55; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
    .asthl-msg.user { align-self: flex-end; background: #0d9488; color: white; border-bottom-right-radius: 4px; }
    .asthl-msg.bot { align-self: flex-start; background: white; color: #134e4a; border: 1px solid #ccfbf1; border-bottom-left-radius: 4px; }
    .asthl-msg.error { align-self: center; background: #fef2f2; color: #e11d48; border: 1px solid #fecaca; font-size: 12px; text-align: center; }

    .asthl-typing { align-self: flex-start; background: white; border: 1px solid #ccfbf1; border-radius: 12px; padding: 10px 14px; display: flex; gap: 4px; }
    .asthl-typing span { width: 6px; height: 6px; border-radius: 50%; background: #5eead4; animation: asthl-typing 1.2s infinite; }
    .asthl-typing span:nth-child(2) { animation-delay: 0.2s; }
    .asthl-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes asthl-typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }

    #asthl-chat-input-area { background: white; border-top: 1px solid #ccfbf1; padding: 8px 10px; display: none; gap: 6px; align-items: flex-end; flex-shrink: 0; }
    #asthl-chat-input-area.show { display: flex; }
    #asthl-chat-input { flex: 1; border: 1px solid #ccfbf1; border-radius: 20px; padding: 8px 12px; font-size: 14px; font-family: inherit; color: #134e4a; outline: none; resize: none; max-height: 80px; line-height: 1.4; background: #f0fdfa; }
    #asthl-chat-input:focus { border-color: #0d9488; }
    #asthl-chat-send { width: 38px; height: 38px; border: none; border-radius: 50%; background: #0d9488; color: white; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.15s; }
    #asthl-chat-send:hover { background: #0f766e; }
    #asthl-chat-send:disabled { opacity: 0.5; }
    #asthl-chat-send svg { width: 18px; height: 18px; fill: white; }

    #asthl-chat-disclaimer { font-size: 11px; color: #0f766e; text-align: center; padding: 6px 10px; background: #f0fdfa; font-weight: 500; border-top: 1px solid #ccfbf1; }

    @media (max-width: 600px) {
      #asthl-chat-window { width: 100vw; height: 100dvh; right: 0; bottom: 0; border-radius: 0; border: none; }
      #asthl-flash { right: 10px; left: 10px; max-width: none; }
      #asthl-chat-btn { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // ===== DOM =====
  const root = document.createElement('div');
  root.id = 'asthl-chat-root';
  document.body.appendChild(root);

  const btn = document.createElement('button');
  btn.id = 'asthl-chat-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  root.appendChild(btn);

  const flash = document.createElement('div');
  flash.id = 'asthl-flash';
  flash.innerHTML = '<div id="asthl-flash-header"><span class="dot"></span><span>ASTHL \u2014 Online</span><span id="asthl-flash-close">&times;</span></div><div id="asthl-flash-body">' + WELCOME_MSG + '<br><button id="asthl-flash-cta">\u{1F4AC} \u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902</button></div>';
  root.appendChild(flash);

  const win = document.createElement('div');
  win.id = 'asthl-chat-window';
  win.innerHTML = `
    <div id="asthl-chat-window-header">
      <div class="avatar">A</div>
      <div class="info">
        <div class="name">ASTHL Assistant</div>
        <div class="status"><span class="dot"></span> Online</div>
      </div>
      <span class="close" id="asthl-chat-close">&times;</span>
    </div>

    <!-- PRE-CHAT FORM -->
    <div id="asthl-form-screen">
      <h3>\u0938\u094D\u0935\u093E\u0917\u0924 \u0939\u0948! \u0915\u0943\u092A\u092F\u093E \u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902</h3>
      <p>\u0938\u0947\u0935\u093E \u0936\u0941\u0930\u0942 \u0915\u0930\u0928\u0947 \u0938\u0947 \u092A\u0939\u0932\u0947 \u0915\u0941\u091B \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u0947\u0902</p>
      <div class="asthl-form-group">
        <label>\u0928\u093E\u092E (Name) *</label>
        <input type="text" id="asthl-pname" placeholder="\u0905\u092A\u0928\u093E \u0928\u093E\u092E \u0932\u093F\u0916\u0947\u0902" autocomplete="off">
        <div class="asthl-form-error" id="asthl-err-name">\u0915\u0943\u092A\u092F\u093E \u0928\u093E\u092E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
      </div>
      <div class="asthl-form-group">
        <label>\u0909\u092E\u094D\u0930 (Age) *</label>
        <input type="number" id="asthl-page" placeholder="\u0905\u092A\u0928\u0940 \u0909\u092E\u094D\u0930 \u0932\u093F\u0916\u0947\u0902" autocomplete="off">
        <div class="asthl-form-error" id="asthl-err-age">\u0915\u0943\u092A\u092F\u093E \u0909\u092E\u094D\u0930 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
      </div>
      <div class="asthl-form-group">
        <label>\u092E\u094B\u092C\u093E\u0907\u0932 (Mobile) *</label>
        <input type="tel" id="asthl-pmobile" placeholder="10 digit mobile number" maxlength="10" autocomplete="off">
        <div class="asthl-form-error" id="asthl-err-mobile">\u0915\u0943\u092A\u092F\u093E \u0938\u0939\u0940 10 \u0905\u0902\u0915 \u0915\u093E \u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
      </div>
      <button id="asthl-form-submit">\u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902 \u2192</button>
      <div class="asthl-form-note">\u0921\u0949\u0915\u094D\u091F\u0930 \u0938\u0947 \u092C\u093E\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F: +91-7903873282</div>
    </div>

    <!-- CHAT MESSAGES -->
    <div id="asthl-chat-messages"></div>

    <!-- INPUT AREA -->
    <div id="asthl-chat-input-area">
      <textarea id="asthl-chat-input" rows="1" placeholder="\u0905\u092A\u0928\u093E \u092A\u094D\u0930\u0936\u094D\u0928 \u0932\u093F\u0916\u0947\u0902... (r:, ias:, ai:, s+, m+, l+)"></textarea>
      <button id="asthl-chat-send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button>
    </div>

    <!-- DISCLAIMER -->
    <div id="asthl-chat-disclaimer">${DOCTOR_CONTACT}</div>
  `;
  root.appendChild(win);

  // ===== DOM refs =====
  const formScreen = document.getElementById('asthl-form-screen');
  const msgContainer = document.getElementById('asthl-chat-messages');
  const inputArea = document.getElementById('asthl-chat-input-area');
  const input = document.getElementById('asthl-chat-input');
  const sendBtn = document.getElementById('asthl-chat-send');
  const formSubmit = document.getElementById('asthl-form-submit');

  // ===== Helpers =====
  function scrollDown() { msgContainer.scrollTop = msgContainer.scrollHeight; }

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

  function showError(id, show) {
    const el = document.getElementById(id);
    if (show) el.classList.add('show'); else el.classList.remove('show');
  }

  // ===== Flash =====
  function showFlash() {
    if (isOpen) return;
    isFlashing = true;
    flash.classList.add('show');
    setTimeout(function() { if (isFlashing && !isOpen) hideFlash(); }, FLASH_AUTO_CLOSE);
  }

  function hideFlash() { flash.classList.remove('show'); isFlashing = false; }

  // ===== Open/close chat =====
  function openChat() {
    isOpen = true; hideFlash(); win.classList.add('open');
    if (!chatStarted) {
      // Form screen dikhega pehle
      formScreen.style.display = 'flex';
      msgContainer.classList.remove('show');
      inputArea.classList.remove('show');
    } else {
      formScreen.style.display = 'none';
      msgContainer.classList.add('show');
      inputArea.classList.add('show');
      setTimeout(function() { input.focus(); }, 300);
    }
  }

  function closeChat() { isOpen = false; win.classList.remove('open'); }

  // ===== Form validation & submit =====
  function validateAndStart() {
    const name = document.getElementById('asthl-pname').value.trim();
    const age = document.getElementById('asthl-page').value.trim();
    const mobile = document.getElementById('asthl-pmobile').value.trim();

    let valid = true;
    showError('asthl-err-name', false);
    showError('asthl-err-age', false);
    showError('asthl-err-mobile', false);

    if (!name || name.length < 2) { showError('asthl-err-name', true); valid = false; }
    if (!age || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) { showError('asthl-err-age', true); valid = false; }
    if (!mobile || !/^\d{10}$/.test(mobile)) { showError('asthl-err-mobile', true); valid = false; }

    if (!valid) return;

    // Save patient info
    patientInfo = { name: name, age: age, mobile: mobile };
    chatStarted = true;

    // Hide form, show chat
    formScreen.style.display = 'none';
    msgContainer.classList.add('show');
    inputArea.classList.add('show');

    // Welcome message with patient name
    const welcomeMsg = '\u0928\u092E\u0938\u094D\u0924\u0947 ' + name + '! \u{1F64F} \u092E\u0948\u0902 ASTHL \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F \u0939\u0942\u0901\u0964 \u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902 \u2014 \u0930\u0942\u092C\u094D\u0930\u093F\u0915 \u090F\u0928\u093E\u0932\u093F\u0938\u093F\u0938, \u092E\u0948\u091F\u0947\u0930\u093F\u092F\u093E \u092E\u0947\u0921\u093F\u0915\u093E, \u0930\u0947\u092E\u0947\u0921\u0940 \u0924\u0941\u0932\u0928\u093E \u0906\u0926\u093F\u0964 r:, ias:, ai:, s+, m+, l+ \u092A\u094D\u0930\u0940\u092B\u093F\u0915\u094D\u0938 \u092D\u0940 \u0909\u092A\u092F\u094B\u0917 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964';
    addMsg(welcomeMsg, 'bot');

    setTimeout(function() { input.focus(); }, 300);
  }

  // ===== Events =====
  btn.addEventListener('click', function() { if (isOpen) closeChat(); else openChat(); });
  document.getElementById('asthl-flash-close').addEventListener('click', hideFlash);
  document.getElementById('asthl-flash-cta').addEventListener('click', openChat);
  document.getElementById('asthl-chat-close').addEventListener('click', closeChat);
  formSubmit.addEventListener('click', validateAndStart);

  // Mobile input — sirf numbers
  document.getElementById('asthl-pmobile').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
  });

  // Enter key on form fields
  ['asthl-pname', 'asthl-page', 'asthl-pmobile'].forEach(function(id) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); validateAndStart(); }
    });
  });

  input.addEventListener('input', function() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 80) + 'px'; });
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  sendBtn.addEventListener('click', sendMsg);

  // ===== Send message =====
  async function sendMsg() {
    var text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true; input.value = ''; input.style.height = 'auto';
    addMsg(text, 'user');
    messages.push({ role: 'user', parts: [{ text: text }] });
    showTyping();
    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          sessionId: SESSION_ID,
          patientName: patientInfo.name,
          patientAge: patientInfo.age,
          patientMobile: patientInfo.mobile
        })
      });
      if (!res.ok) { var err = await res.json().catch(function() { return {}; }); throw new Error(err.error || 'Server error'); }
      var data = await res.json();
      var reply = data.reply || '\u0915\u094D\u0937\u092E\u093E \u0915\u0930\u0947\u0902, \u0926\u094B\u092C\u093E\u0930\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964';
      addMsg(reply, 'bot');
      messages.push({ role: 'model', parts: [{ text: reply }] });
    } catch (err) {
      hideTyping();
      addMsg('\u0924\u094D\u0930\u0941\u091F\u093F: ' + err.message + '. \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964', 'error');
    } finally {
      hideTyping(); sendBtn.disabled = false; input.focus();
    }
  }

  setTimeout(showFlash, FLASH_DELAY);
})();
