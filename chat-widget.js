// =====================================================
// ASTHL Flash Chat Widget v10 — HTTP-sites: chat opens in secure new tab (chat.html)
// Patient/Doctor categories, ek baar OTP, phir seedha chat
// =====================================================

(function() {
  'use strict';

  // ======== FIREBASE CONFIG (YAHAN APNI VALUES DAALEIN) ========
  const OTP_ENABLED = true;

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyArvYDxEHVMs_N8fPIQeSoXv3IT3rOEWvM",
    authDomain: "asthl-chat-otp.firebaseapp.com",
    projectId: "asthl-chat-otp",
    appId: "1:1060361604381:web:7cf9891b7339636c7ca5f4"
  };
  // ================================================================

  const API_URL = 'https://asthl-ask.vercel.app/api/chat';
  // Secure fullpage chat page (OTP yahan hamesha chalta hai)
  const CHAT_PAGE_URL = 'https://asthl-ask.vercel.app/chat.html';
  // chat.html is widget ko fullpage mode mein render karta hai
  const FULLPAGE_MODE = window.ASTHL_FULLPAGE === true;
  const FLASH_DELAY = 1500;
  const FLASH_AUTO_CLOSE = 6000;
  const STORAGE_KEY = 'asthl_user_v8';
  const WELCOME_MSG = '\u0928\u092E\u0938\u094D\u0924\u0947! \u{1F64F} \u0915\u094D\u092F\u093E \u0906\u092A\u0915\u094B \u0915\u094B\u0908 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u092E\u0938\u094D\u092F\u093E \u0939\u0948? \u092E\u0941\u091D\u0938\u0947 \u092A\u0942\u091B\u0947\u0902 \u2014 \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u092E\u0947\u0902 \u092E\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0942\u0901\u0964';
  const DOCTOR_CONTACT = '\u091A\u093F\u0915\u093F\u0924\u094D\u0938\u0915\u0940\u092F \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0915\u0947 \u0932\u093F\u090F \u0939\u092E\u093E\u0930\u0947 \u0921\u0949\u0915\u094D\u091F\u0930\u094D\u0938 \u0915\u094B \u0915\u0949\u0932 / \u0935\u094D\u0939\u093E\u091F\u094D\u0938\u092A\u094D\u092A \u0915\u0930\u0947\u0902 +91-7903873282';

  let SESSION_ID = 'P' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  let patientInfo = null;
  let isOpen = false;
  let isFlashing = false;
  let chatStarted = false;

  // ===== Firebase state =====
  let fbAuth = null;
  let fbAuthMod = null;
  let confirmationResult = null;
  let recaptchaVerifier = null;
  let resendTimer = null;
  let otpCooldown = 0;

  // ===== localStorage helpers =====
  function loadSavedUser() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (u && u.mobile && u.name && u.verified) return u;
      return null;
    } catch (e) { return null; }
  }
  function saveUser(u) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch (e) {}
  }
  function clearUser() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  const SYSTEM_PROMPT_BASE = `ASTHL \u2014 Homeopathy Working Assistant

You are ASTHL, a working assistant for Riva Kumari, a homeopathy practitioner. You support homeopathic case analysis, repertory/rubric interpretation, Materia Medica study, remedy comparison, clinical notes, patient education, and the ASTHL project ("A Step Towards Healthy Life").

## Language & Style

- Default script: Devanagari. ALWAYS respond in Devanagari-script Hindi by default \u2014 never romanized/Hinglish. This applies even if the user writes in romanized Hindi.
- Use respectful/formal Hindi, never informal pronouns.
- Keep it simple, clear, precise. Use English medical/technical terms where clearer, but keep them inline within Hindi sentences.
- Explain exact clinical meaning, not generic textbook statements. Expand with examples when asked.
- Direct factual question -> answer directly first, add explanation only as needed.
- "aur samjhao" -> expand with conceptual/clinical explanation, examples, comparisons.
- Only respond in English if the user explicitly asks for an English response.

## Name Rule

- ALWAYS write names in Devanagari script. "Riva" -> "\u0930\u093F\u0935\u093E", "Suresh" -> "\u0938\u0941\u0930\u0947\u0936". Never leave a person's name in Latin script inside a Hindi sentence.

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

  let messages = [];

  function buildMessages() {
    var sys = SYSTEM_PROMPT_BASE;
    if (patientInfo) {
      if (patientInfo.category === 'doctor') {
        sys += '\n\n## Current User\nThe current user is a DOCTOR (homeopathy practitioner): ' + patientInfo.name + ', clinic: ' + (patientInfo.clinic || '-') + '. Mobile verified. Since the user is a doctor, use technical/clinical language freely.';
      } else {
        sys += '\n\n## Current User\nThe current user is a PATIENT (non-medical person): ' + patientInfo.name + ', age ' + patientInfo.age + '. Mobile verified. Respond in simple, easy-to-understand Hindi.';
      }
    }
    messages = [
      { role: 'user', parts: [{ text: sys }] },
      { role: 'model', parts: [{ text: '\u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 ASTHL \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F \u0939\u0942\u0901\u0964 \u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902\u0964' }] }
    ];
  }

  // ===== CSS =====
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
    #asthl-chat-root * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Noto Sans Devanagari', system-ui, sans-serif; }
    #asthl-chat-root { position: fixed; bottom: 0; right: 0; z-index: 999999; pointer-events: none; }
    #asthl-chat-btn { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #0d9488, #0f766e); border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(13,148,136,0.4); display: flex; align-items: center; justify-content: center; z-index: 999999; pointer-events: auto; transition: all 0.3s ease; animation: asthl-pulse 2s infinite; }
    #asthl-chat-btn:hover { transform: scale(1.08); }
    #asthl-chat-btn svg { width: 28px; height: 28px; fill: white; }
    @keyframes asthl-pulse { 0% { box-shadow: 0 4px 16px rgba(13,148,136,0.4), 0 0 0 0 rgba(13,148,136,0.4); } 70% { box-shadow: 0 4px 16px rgba(13,148,136,0.4), 0 0 0 15px rgba(13,148,136,0); } 100% { box-shadow: 0 4px 16px rgba(13,148,136,0.4), 0 0 0 0 rgba(13,148,136,0); } }
    #asthl-flash { position: fixed; bottom: 90px; right: 20px; max-width: 320px; min-width: 260px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); overflow: hidden; z-index: 999998; pointer-events: auto; border: 1px solid #ccfbf1; transform: translateY(20px) scale(0.9); opacity: 0; transition: all 0.4s cubic-bezier(0.34,1.56,0.64,1); }
    #asthl-flash.show { transform: translateY(0) scale(1); opacity: 1; }
    #asthl-flash-header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
    #asthl-flash-header .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
    #asthl-flash-close { margin-left: auto; cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.8; }
    #asthl-flash-close:hover { opacity: 1; }
    #asthl-flash-body { padding: 12px 14px; font-size: 14px; color: #134e4a; line-height: 1.5; }
    #asthl-flash-cta { display: inline-block; margin-top: 8px; padding: 6px 16px; background: #0d9488; color: white; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
    #asthl-flash-cta:hover { background: #0f766e; }
    #asthl-chat-window { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 540px; max-height: calc(100dvh - 110px); background: #f0fdfa; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); display: none; flex-direction: column; overflow: hidden; z-index: 999999; pointer-events: auto; border: 1px solid #ccfbf1; }
    #asthl-chat-window.open { display: flex; animation: asthl-slide-up 0.3s ease-out; }
    @keyframes asthl-slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    #asthl-chat-window-header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 12px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    #asthl-chat-window-header .avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
    #asthl-chat-window-header .info { flex: 1; }
    #asthl-chat-window-header .info .name { font-size: 14px; font-weight: 600; }
    #asthl-chat-window-header .info .status { font-size: 11px; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
    #asthl-chat-window-header .info .status .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
    #asthl-new-chat-btn { background: rgba(255,255,255,0.2); border: none; border-radius: 12px; padding: 5px 10px; font-size: 11px; color: white; cursor: pointer; font-family: inherit; font-weight: 500; display: none; flex-shrink: 0; margin-right: 6px; transition: background 0.15s; } #asthl-new-chat-btn:hover { background: rgba(255,255,255,0.4); } #asthl-chat-window-header .close { cursor: pointer; font-size: 20px; line-height: 1; opacity: 0.8; }
    #asthl-chat-window-header .close:hover { opacity: 1; }
    #asthl-form-screen { flex: 1; overflow-y: auto; padding: 20px 18px; display: flex; flex-direction: column; }
    .asthl-step { display: flex; flex-direction: column; justify-content: center; flex: 1; }
    #asthl-form-screen h3 { font-size: 16px; color: #134e4a; margin-bottom: 6px; text-align: center; font-weight: 600; }
    #asthl-form-screen p.sub { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 16px; line-height: 1.5; }
    /* Category buttons */
    .asthl-cat-grid { display: flex; gap: 10px; margin-bottom: 14px; }
    .asthl-cat-btn { flex: 1; padding: 18px 10px; background: white; border: 2px solid #ccfbf1; border-radius: 14px; cursor: pointer; text-align: center; transition: all 0.2s; font-family: inherit; }
    .asthl-cat-btn:hover { border-color: #0d9488; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,148,136,0.15); }
    .asthl-cat-btn .cat-icon { font-size: 30px; margin-bottom: 6px; }
    .asthl-cat-btn .cat-title { font-size: 15px; font-weight: 600; color: #134e4a; display: block; }
    .asthl-cat-btn .cat-sub { font-size: 11px; color: #64748b; display: block; margin-top: 2px; }
    .asthl-form-group { margin-bottom: 11px; }
    .asthl-form-group label { display: block; font-size: 13px; color: #134e4a; margin-bottom: 4px; font-weight: 500; }
    .asthl-form-group input, .asthl-form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ccfbf1; border-radius: 10px; font-size: 14px; font-family: inherit; color: #134e4a; background: white; outline: none; transition: border-color 0.15s; }
    .asthl-form-group input:focus, .asthl-form-group textarea:focus { border-color: #0d9488; }
    .asthl-form-group input::placeholder, .asthl-form-group textarea::placeholder { color: #94a3b8; }
    .asthl-form-error { font-size: 12px; color: #e11d48; margin-top: 4px; display: none; }
    .asthl-form-error.show { display: block; }
    .asthl-btn-primary { width: 100%; padding: 12px; background: linear-gradient(135deg, #0d9488, #0f766e); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 6px; transition: all 0.15s; }
    .asthl-btn-primary:hover { transform: scale(1.02); }
    .asthl-btn-primary:disabled { opacity: 0.6; cursor: wait; }
    .asthl-link { background: none; border: none; color: #0d9488; font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline; }
    .asthl-form-note { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 10px; line-height: 1.4; }
    .asthl-otp-status { font-size: 13px; color: #0f766e; text-align: center; margin-bottom: 12px; line-height: 1.5; padding: 8px; background: #f0fdfa; border-radius: 8px; }
    #asthl-otp-input { text-align: center; font-size: 22px !important; letter-spacing: 8px; font-weight: 600; }
    .asthl-otp-links { display: flex; justify-content: space-between; margin-top: 12px; }
    .asthl-otp-links button { background: none; border: none; color: #0d9488; font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline; }
    .asthl-otp-links button:disabled { color: #94a3b8; cursor: default; text-decoration: none; }
    /* Returning user */
    .asthl-return-card { background: white; border: 1px solid #ccfbf1; border-radius: 12px; padding: 14px; margin-bottom: 14px; }
    .asthl-return-card .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #ccfbf1; }
    .asthl-return-card .row:last-child { border-bottom: none; }
    .asthl-return-card .row .k { color: #64748b; }
    .asthl-return-card .row .v { color: #134e4a; font-weight: 500; }
    .asthl-return-card .v.green { color: #166534; }
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
    @media (max-width: 600px) { #asthl-chat-window { width: 100vw; height: 100dvh; right: 0; bottom: 0; border-radius: 0; border: none; } #asthl-flash { right: 10px; left: 10px; max-width: none; } #asthl-chat-btn { bottom: 16px; right: 16px; } }
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
      <button id="asthl-new-chat-btn">⟳ नयी चैट</button>
      <span class="close" id="asthl-chat-close">&times;</span>
    </div>

    <div id="asthl-form-screen">

      <!-- STEP 0: Category -->
      <div id="asthl-step-category" class="asthl-step">
        <h3>\u0928\u092E\u0938\u094D\u0924\u0947! \u0906\u092A \u0915\u094C\u0928 \u0939\u0948\u0902?</h3>
        <p class="sub">\u092A\u0939\u0932\u0947 \u0905\u092A\u0928\u0940 \u0936\u094D\u0930\u0947\u0923\u0940 \u091A\u0941\u0928\u0947\u0902</p>
        <div class="asthl-cat-grid">
          <button class="asthl-cat-btn" id="asthl-cat-patient">
            <span class="cat-icon">\u{1F469}\u200D\u2695\uFE0F</span>
            <span class="cat-title">\u092E\u0930\u0940\u095B</span>
            <span class="cat-sub">\u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0928\u093E \u0939\u0948</span>
          </button>
          <button class="asthl-cat-btn" id="asthl-cat-doctor">
            <span class="cat-icon">\u{1F3E5}</span>
            <span class="cat-title">\u0921\u0949\u0915\u094D\u091F\u0930</span>
            <span class="cat-sub">\u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u092A\u094D\u0930\u0948\u0915\u094D\u091F\u093F\u0936\u0928\u0930</span>
          </button>
        </div>
        <div class="asthl-form-note">\u092A\u0939\u0932\u0940 \u092C\u093E\u0930 \u092A\u0902\u091C\u0940\u0930\u0923 \u092E\u0947\u0902 \u092E\u094B\u092C\u093E\u0907\u0932 OTP \u0938\u0947 \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0939\u094B\u0917\u093E\u0964 \u0909\u0938\u0915\u0947 \u092C\u093E\u0926 \u092C\u093E\u0930-\u092C\u093E\u0930 OTP \u0928\u0939\u0940\u0902 \u0932\u0917\u0947\u0917\u093E\u0964</div>
      </div>

      <!-- STEP 1: Registration Form -->
      <div id="asthl-step-form" class="asthl-step" style="display:none">
        <h3 id="asthl-form-title">\u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902</h3>
        <p class="sub" id="asthl-form-sub"></p>
        <div class="asthl-form-group">
          <label>\u0928\u093E\u092E *</label>
          <input type="text" id="asthl-pname" placeholder="\u0905\u092A\u0928\u093E \u092A\u0942\u0930\u093E \u0928\u093E\u092E" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-name">\u0915\u0943\u092A\u092F\u093E \u0928\u093E\u092E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group">
          <label>\u0909\u092E\u094D\u0930 *</label>
          <input type="number" id="asthl-page" placeholder="\u0905\u092A\u0928\u0940 \u0909\u092E\u094D\u0930" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-age">\u0915\u0943\u092A\u092F\u093E \u0938\u0939\u0940 \u0909\u092E\u094D\u0930 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group">
          <label>\u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930 *</label>
          <input type="tel" id="asthl-pmobile" placeholder="10 digit mobile number" maxlength="10" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-mobile">\u0915\u0943\u092A\u092F\u093E \u0938\u0939\u0940 10 \u0905\u0902\u0915 \u0915\u093E \u0928\u0902\u092C\u0930 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group" id="asthl-clinic-group" style="display:none">
          <label>\u0915\u094D\u0932\u093F\u0928\u093F\u0915 / \u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u0915\u093E \u0928\u093E\u092E *</label>
          <input type="text" id="asthl-pclinic" placeholder="\u0905\u092A\u0928\u0947 \u0915\u094D\u0932\u093F\u0928\u093F\u0915 \u0915\u093E \u0928\u093E\u092E \u0932\u093F\u0916\u0947\u0902" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-clinic">\u0915\u0943\u092A\u092F\u093E \u0915\u094D\u0932\u093F\u0928\u093F\u0915 \u0915\u093E \u0928\u093E\u092E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group">
          <label>\u092A\u0924\u093E *</label>
          <textarea id="asthl-paddress" rows="2" placeholder="\u0928\u0917\u0930, \u091C\u093F\u0932\u093E, \u0930\u093E\u091C\u094D\u092F \u0932\u093F\u0916\u0947\u0902" autocomplete="off"></textarea>
          <div class="asthl-form-error" id="asthl-err-address">\u0915\u0943\u092A\u092F\u093E \u092A\u0924\u093E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <button id="asthl-form-submit" class="asthl-btn-primary">\u0913\u091F\u0940\u092A\u0940 \u092D\u0947\u091C\u0947\u0902 \u2192</button>
        <div style="text-align:center;margin-top:10px">
          <button class="asthl-link" id="asthl-back-cat">\u2190 \u0936\u094D\u0930\u0947\u0923\u0940 \u092C\u0926\u0932\u0947\u0902</button>
        </div>
      </div>

      <!-- STEP 2: OTP -->
      <div id="asthl-step-otp" class="asthl-step" style="display:none">
        <h3>\u092E\u094B\u092C\u093E\u0907\u0932 \u0938\u0924\u094D\u092F\u093E\u092A\u0928</h3>
        <div class="asthl-otp-status" id="asthl-otp-status">+91-XXXXXXX \u092A\u0930 OTP \u092D\u0947\u091C\u093E \u0917\u092F\u093E \u0939\u0948</div>
        <div class="asthl-form-group">
          <label>OTP \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902 *</label>
          <input type="tel" id="asthl-otp-input" placeholder="- - - - - -" maxlength="6" autocomplete="one-time-code">
          <div class="asthl-form-error" id="asthl-err-otp">\u0917\u0932\u0924 OTP\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964</div>
        </div>
        <button id="asthl-otp-verify" class="asthl-btn-primary">\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0947\u0902 \u2713</button>
        <div class="asthl-otp-links">
          <button id="asthl-otp-back">\u2190 \u092A\u0940\u091B\u0947</button>
          <button id="asthl-otp-resend">\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902</button>
        </div>
        <div class="asthl-form-note">\u092F\u0939 \u090F\u0915 \u092C\u093E\u0930 \u0939\u0940 \u0939\u094B\u0917\u093E \u2014 \u0905\u0917\u0932\u0940 \u092C\u093E\u0930 OTP \u0928\u0939\u0940\u0902 \u092E\u093E\u0902\u0917\u093E \u091C\u093E \u0924\u0915</div>
      </div>

      <!-- STEP 3: Returning user -->
      <div id="asthl-step-return" class="asthl-step" style="display:none">
        <h3>\u0928\u092E\u0938\u094D\u0924\u0947 \u092B\u093F\u0930 \u0938\u0947, <span id="asthl-ret-name"></span>! \u{1F44B}</h3>
        <p class="sub">\u0906\u092A \u092A\u0939\u0932\u0947 \u0938\u0947 \u0930\u091C\u093F\u0938\u094D\u091F\u0930 \u0939\u0948\u0902 \u2014 \u092C\u0938 \u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902</p>
        <div class="asthl-return-card" id="asthl-ret-card"></div>
        <button id="asthl-ret-start" class="asthl-btn-primary">\u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902 \u2192</button>
        <div style="text-align:center;margin-top:12px">
          <button class="asthl-link" id="asthl-ret-reset">\u0928\u092F\u093E \u092F\u0942\u091C\u093C\u0930 \u0939\u0948\u0902? \u0926\u094B\u092C\u093E\u0930\u093E \u0930\u091C\u093F\u0938\u094D\u091F\u0930 \u0915\u0930\u0947\u0902</button>
        </div>
      </div>

      <!-- reCAPTCHA -->
      <div id="asthl-recaptcha-container"></div>
    </div>

    <div id="asthl-chat-messages"></div>

    <div id="asthl-chat-input-area">
      <textarea id="asthl-chat-input" rows="1" placeholder="\u0905\u092A\u0928\u093E \u092A\u094D\u0930\u0936\u094D\u0928 \u0932\u093F\u0916\u0947\u0902... (r:, ias:, ai:, s+, m+, l+)"></textarea>
      <button id="asthl-chat-send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button>
    </div>

    <div id="asthl-chat-disclaimer">${DOCTOR_CONTACT}</div>
  `;
  root.appendChild(win);

  // ===== DOM refs =====
  const stepCat = document.getElementById('asthl-step-category');
  const stepForm = document.getElementById('asthl-step-form');
  const stepOtp = document.getElementById('asthl-step-otp');
  const stepReturn = document.getElementById('asthl-step-return');
  const formScreen = document.getElementById('asthl-form-screen');
  const msgContainer = document.getElementById('asthl-chat-messages');
  const inputArea = document.getElementById('asthl-chat-input-area');
  const input = document.getElementById('asthl-chat-input');
  const sendBtn = document.getElementById('asthl-chat-send');
  const formSubmit = document.getElementById('asthl-form-submit');
  const otpInput = document.getElementById('asthl-otp-input');
  const otpVerifyBtn = document.getElementById('asthl-otp-verify');
  const otpResendBtn = document.getElementById('asthl-otp-resend');
  const otpBackBtn = document.getElementById('asthl-otp-back');
  const otpStatus = document.getElementById('asthl-otp-status');
  const otpErr = document.getElementById('asthl-err-otp');

  function showStep(step) {
    stepCat.style.display = 'none';
    stepForm.style.display = 'none';
    stepOtp.style.display = 'none';
    stepReturn.style.display = 'none';
    if (step) step.style.display = 'flex';
  }

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
  function hideAllErrors() {
    ['asthl-err-name','asthl-err-age','asthl-err-mobile','asthl-err-clinic','asthl-err-address'].forEach(function(id){ showError(id,false); });
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
    // HTTP (insecure) page: Firebase OTP secure context maangta hai.
    // Isliye chat ko secure page par naye tab mein khol do.
    if (!FULLPAGE_MODE && !window.isSecureContext) {
      window.open(CHAT_PAGE_URL, '_blank');
      return;
    }
    isOpen = true; hideFlash(); win.classList.add('open');
    if (chatStarted) {
      formScreen.style.display = 'none';
      msgContainer.classList.add('show');
      inputArea.classList.add('show');
      setTimeout(function() { input.focus(); }, 300);
      return;
    }
    // Registration flow
    formScreen.style.display = 'flex';
    msgContainer.classList.remove('show');
    inputArea.classList.remove('show');
    var saved = loadSavedUser();
    if (saved) {
      patientInfo = saved;
      fillReturnCard(saved);
      showStep(stepReturn);
    } else {
      showStep(stepCat);
    }
  }
  function closeChat() { isOpen = false; win.classList.remove('open'); }

  function fillReturnCard(u) {
    document.getElementById('asthl-ret-name').textContent = u.name;
    var cat = u.category === 'doctor' ? '\u0921\u0949\u0915\u094D\u091F\u0930' : '\u092E\u0930\u0940\u095B';
    var html = '<div class="row"><span class="k">\u0928\u093E\u092E</span><span class="v">' + u.name + '</span></div>';
    html += '<div class="row"><span class="k">\u092E\u094B\u092C\u093E\u0907\u0932</span><span class="v green">+91-' + u.mobile + ' \u2713</span></div>';
    html += '<div class="row"><span class="k">\u0936\u094D\u0930\u0947\u0923\u0940</span><span class="v">' + cat + '</span></div>';
    if (u.category === 'doctor' && u.clinic) html += '<div class="row"><span class="k">\u0915\u094D\u0932\u093F\u0928\u093F\u0915</span><span class="v">' + u.clinic + '</span></div>';
    if (u.address) html += '<div class="row"><span class="k">\u092A\u0924\u093E</span><span class="v">' + u.address + '</span></div>';
    document.getElementById('asthl-ret-card').innerHTML = html;
  }

  // ===== Category selection =====
  var selectedCategory = null;

  document.getElementById('asthl-cat-patient').addEventListener('click', function() {
    selectedCategory = 'patient';
    document.getElementById('asthl-form-title').textContent = '\u092E\u0930\u0940\u095B \u2014 \u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902';
    document.getElementById('asthl-form-sub').textContent = '\u092A\u0922\u093C\u0947\u0947 \u0939\u0941\u090F \u0938\u0935\u093E\u0932\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F \u0938\u0930\u0932 \u091C\u0935\u093E\u092C \u092E\u093F\u0932\u0947\u0902\u0917\u0947';
    document.getElementById('asthl-clinic-group').style.display = 'none';
    showStep(stepForm);
  });

  document.getElementById('asthl-cat-doctor').addEventListener('click', function() {
    selectedCategory = 'doctor';
    document.getElementById('asthl-form-title').textContent = '\u0921\u0949\u0915\u094D\u091F\u0930 \u2014 \u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902';
    document.getElementById('asthl-form-sub').textContent = '\u0924\u0915\u0928\u0940\u0915\u0940 \u0935\u093F\u0938\u094D\u0924\u0943\u0924 \u0938\u092E\u091D \u092E\u093F\u0932\u0947\u0917\u0940 \u2014 rubric, Materia Medica \u0906\u0926\u093F';
    document.getElementById('asthl-clinic-group').style.display = 'block';
    showStep(stepForm);
  });

  document.getElementById('asthl-back-cat').addEventListener('click', function() {
    showStep(stepCat);
  });

  // ===== FIREBASE =====
  async function initFirebase() {
    try {
      const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      fbAuth = authMod.getAuth(app);
      fbAuthMod = authMod;
      return true;
    } catch (err) {
      console.error('Firebase init failed:', err);
      return false;
    }
  }

  async function sendOTP(mobile) {
    if (!fbAuth || !fbAuthMod) {
      const ok = await initFirebase();
      if (!ok) throw new Error('Firebase config error');
    }
    if (!recaptchaVerifier) {
      recaptchaVerifier = new fbAuthMod.RecaptchaVerifier(fbAuth, 'asthl-recaptcha-container', { size: 'invisible' });
      await recaptchaVerifier.render();
    }
    confirmationResult = await fbAuthMod.signInWithPhoneNumber(fbAuth, '+91' + mobile, recaptchaVerifier);
    return true;
  }

  async function verifyOTP(code) {
    if (!confirmationResult) throw new Error('Pehle OTP bhejein.');
    return await confirmationResult.confirm(code);
  }

  // ===== Form submit =====
  async function handleFormSubmit() {
    const name = document.getElementById('asthl-pname').value.trim();
    const age = document.getElementById('asthl-page').value.trim();
    const mobile = document.getElementById('asthl-pmobile').value.trim();
    const clinic = document.getElementById('asthl-pclinic').value.trim();
    const address = document.getElementById('asthl-paddress').value.trim();

    hideAllErrors();
    let valid = true;
    if (!name || name.length < 2) { showError('asthl-err-name', true); valid = false; }
    if (!age || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) { showError('asthl-err-age', true); valid = false; }
    if (!mobile || !/^\d{10}$/.test(mobile)) { showError('asthl-err-mobile', true); valid = false; }
    if (selectedCategory === 'doctor' && (!clinic || clinic.length < 2)) { showError('asthl-err-clinic', true); valid = false; }
    if (!address || address.length < 5) { showError('asthl-err-address', true); valid = false; }
    if (!valid) return;

    var newUser = { name: name, age: age, mobile: mobile, address: address, category: selectedCategory, clinic: selectedCategory === 'doctor' ? clinic : '', verified: false };

    if (!OTP_ENABLED || !window.isSecureContext) {
      // HTTP par Firebase OTP nahi chalta — insecure context.
      // Patient ko block karne ke bajaye unverified register kar do.
      // HTTPS aane par (Cloudflare) OTP apne aap active ho jayega.
      patientInfo = newUser;
      patientInfo.verified = window.isSecureContext ? false : false;
      saveUser(newUser);
      startChat();
      return;
    }

    formSubmit.disabled = true;
    formSubmit.textContent = 'OTP \u092D\u0947\u091C \u0930\u0939\u093E \u0939\u0948...';

    try {
      await sendOTP(mobile);
      patientInfo = newUser;
      otpStatus.textContent = '+91-' + mobile + ' \u092A\u0930 6 \u0905\u0902\u0915 \u0915\u093E OTP \u092D\u0947\u091C\u093E \u0917\u092F\u093E \u0939\u0948\u0964 SMS \u0926\u0947\u0916\u0915\u0930 \u0928\u0940\u091A\u0947 \u0921\u093E\u0932\u0947\u0902\u0964';
      otpErr.classList.remove('show');
      otpInput.value = '';
      showStep(stepOtp);
      startResendCooldown(60);
      setTimeout(function() { otpInput.focus(); }, 200);
    } catch (err) {
      console.error('OTP send failed:', err);
      var msg = 'OTP \u0928\u0939\u0940\u0902 \u092D\u0947\u091C \u092A\u093E \u0930\u0939\u093E\u0964 \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964';
      if (err.code === 'auth/too-many-requests') msg = '\u092C\u0939\u0941\u0924 \u091C\u094D\u092F\u093E\u0926\u093E OTP \u092D\u0947\u091C\u093E \u0917\u092F\u093E\u0964 \u0915\u0941\u091B \u0926\u0947\u0930 \u092C\u093E\u0926 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964';
      if (err.code === 'auth/invalid-phone-number') msg = '\u0917\u0932\u0924 \u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930\u0964';
      if (err.code === 'auth/unauthorized-domain') msg = '\u092F\u0939 domain Firebase mein authorized \u0928\u0939\u0940\u0902 \u0939\u0948\u0964';
      alert(msg);
    } finally {
      formSubmit.disabled = false;
      formSubmit.textContent = '\u0913\u091F\u0940\u092A\u0940 \u092D\u0947\u091C\u0947\u0902 \u2192';
    }
  }

  // ===== OTP verify =====
  async function handleOtpVerify() {
    const code = otpInput.value.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      otpErr.textContent = '\u0915\u0943\u092A\u092F\u093E 6 \u0905\u0902\u0915 \u0915\u093E OTP \u0921\u093E\u0932\u0947\u0902\u0964';
      otpErr.classList.add('show');
      return;
    }
    otpVerifyBtn.disabled = true;
    otpVerifyBtn.textContent = '\u091C\u093E\u0901\u091A \u0939\u094B \u0930\u0939\u0940 \u0939\u0948...';
    otpErr.classList.remove('show');

    try {
      await verifyOTP(code);
      patientInfo.verified = true;
      patientInfo.registeredAt = new Date().toISOString();
      saveUser(patientInfo);
      startChat();
    } catch (err) {
      if (err.code === 'auth/invalid-verification-code') {
        otpErr.textContent = '\u0917\u0932\u0924 OTP\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964';
      } else if (err.code === 'auth/code-expired') {
        otpErr.textContent = 'OTP \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u0917\u092F\u093E\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902\u0964';
      } else {
        otpErr.textContent = '\u0924\u094D\u0930\u0941\u091F\u093F: ' + (err.message || 'fail');
      }
      otpErr.classList.add('show');
      otpInput.value = '';
      otpInput.focus();
    } finally {
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.textContent = '\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0947\u0902 \u2713';
    }
  }

  function startResendCooldown(sec) {
    otpCooldown = sec;
    otpResendBtn.disabled = true;
    clearInterval(resendTimer);
    resendTimer = setInterval(function() {
      otpCooldown--;
      if (otpCooldown <= 0) {
        clearInterval(resendTimer);
        otpResendBtn.disabled = false;
        otpResendBtn.textContent = '\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902';
      } else {
        otpResendBtn.textContent = '\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902 (' + otpCooldown + 's)';
      }
    }, 1000);
    otpResendBtn.textContent = '\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902 (' + otpCooldown + 's)';
  }

  async function handleOtpResend() {
    try {
      await sendOTP(patientInfo.mobile);
      otpErr.classList.remove('show');
      otpInput.value = '';
      otpInput.focus();
      startResendCooldown(60);
    } catch (err) {
      alert('OTP \u0928\u0939\u0940\u0902 \u092D\u0947\u091C \u092A\u093E \u0930\u0939\u093E\u0964 \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964');
    }
  }

  function handleOtpBack() {
    showStep(stepForm);
    clearInterval(resendTimer);
  }

  // ===== Start chat =====
  function startChat() {
    chatStarted = true;
    newChatBtn.style.display = 'block';
    clearInterval(resendTimer);
    buildMessages();
    formScreen.style.display = 'none';
    msgContainer.classList.add('show');
    inputArea.classList.add('show');
    var cat = patientInfo.category === 'doctor' ? '\u0921\u0949\u0915\u094D\u091F\u0930' : '\u092E\u0930\u0940\u095B';
    var extra = patientInfo.category === 'doctor' && patientInfo.clinic ? '\u0905\u092A\u0928\u0947 \u0915\u094D\u0932\u093F\u0928\u093F\u0915 \u0938\u0947 \u092C\u093E\u0924 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964 ' : '';
    var welcome = '\u0928\u092E\u0938\u094D\u0924\u0947 ' + patientInfo.name + '! \u{1F64F} \u0906\u092A ' + cat + ' \u0930\u0942\u092A \u092E\u0947\u0902 \u0930\u091C\u093F\u0938\u094D\u091F\u0930 \u0939\u0948\u0902\u0964 ' + extra + '\u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902 \u2014 \u0930\u0942\u092C\u094D\u0930\u093F\u0915 \u090F\u0928\u093E\u0932\u093F\u0938\u093F\u0938, \u092E\u0948\u091F\u0947\u0930\u093F\u092F\u093E \u092E\u0947\u0921\u093F\u0915\u093E, \u0930\u0947\u092E\u0947\u0921\u0940 \u0924\u0941\u0932\u0928\u093E \u0906\u0926\u093F\u0964 r:, ias:, ai:, s+, m+, l+ \u092A\u094D\u0930\u0940\u092B\u093F\u0915\u094D\u0938 \u092D\u0940 \u0909\u092A\u092F\u094B\u0917 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964';
    addMsg(welcome, 'bot');
    setTimeout(function() { input.focus(); }, 300);
  }

  // ===== Returning user =====
  document.getElementById('asthl-ret-start').addEventListener('click', function() {
    startChat();
  });
  document.getElementById('asthl-ret-reset').addEventListener('click', function() {
    clearUser();
    patientInfo = null;
    showStep(stepCat);
  });

  // ===== Events =====
  btn.addEventListener('click', function() { if (isOpen) closeChat(); else openChat(); });
  document.getElementById('asthl-flash-close').addEventListener('click', hideFlash);
  document.getElementById('asthl-flash-cta').addEventListener('click', openChat);
  document.getElementById('asthl-chat-close').addEventListener('click', closeChat);
  var newChatBtn = document.getElementById('asthl-new-chat-btn');
  newChatBtn.addEventListener('click', function() {
    if (!chatStarted) return;
    var ok = confirm('\u0928\u0908 \u091a\u0948\u091f \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902?\n\n\u092a\u0941\u0930\u093e\u0928\u0940 \u092c\u093e\u0924\u091a\u0940\u0924 \u0915\u093e \u0938\u0902\u0926\u0930\u094d\u092d \u0939\u091f \u091c\u093e\u090f\u0917\u093e \u2014 AI \u0915\u094b \u0907\u0938 \u091a\u0948\u091f \u0915\u0940 \u092c\u093e\u0924\u0947\u0902 \u092f\u093e\u0926 \u0928\u0939\u0940\u0902 \u0930\u0939\u0947\u0902\u0917\u0940\u0964');
    if (!ok) return;
    SESSION_ID = 'P' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    buildMessages();
    msgContainer.innerHTML = '';
    addMsg('\u0928\u0908 \u091a\u0948\u091f \u0936\u0941\u0930\u0942 \u0939\u0941\u0908 \U0001F504\n\u0905\u092c \u092e\u0948\u0902 \u092a\u093f\u091b\u0932\u0940 \u092c\u093e\u0924\u091a\u0940\u0924 \u0928\u0939\u0940\u0902 \u091c\u093e\u0928\u0924\u093e \u2014 \u0905\u092a\u0928\u093e \u0928\u092f\u093e \u0938\u0935\u093e\u0932 \u092a\u0942\u091b\u0947\u0902\u0964', 'bot');
    input.focus();
  });
  formSubmit.addEventListener('click', handleFormSubmit);
  otpVerifyBtn.addEventListener('click', handleOtpVerify);
  otpResendBtn.addEventListener('click', handleOtpResend);
  otpBackBtn.addEventListener('click', handleOtpBack);

  document.getElementById('asthl-pmobile').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
  });
  otpInput.addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    otpErr.classList.remove('show');
  });
  otpInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleOtpVerify(); }
  });
  ['asthl-pname', 'asthl-page', 'asthl-pmobile', 'asthl-pclinic', 'asthl-paddress'].forEach(function(id) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && id !== 'asthl-paddress') { e.preventDefault(); handleFormSubmit(); }
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
      var payload = {
        messages: messages,
        sessionId: SESSION_ID,
        patientName: patientInfo ? patientInfo.name : '',
        patientAge: patientInfo ? patientInfo.age : '',
        patientMobile: patientInfo ? patientInfo.mobile : '',
        mobileVerified: patientInfo ? patientInfo.verified : false,
        category: patientInfo ? patientInfo.category : '',
        clinic: patientInfo ? patientInfo.clinic : '',
        address: patientInfo ? patientInfo.address : ''
      };
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  // ===== Fullpage mode (chat.html) =====
  if (FULLPAGE_MODE) {
    var fpStyle = document.createElement('style');
    fpStyle.textContent = '#asthl-chat-window{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;max-height:100dvh;border-radius:0;display:flex !important;border:none;}'
      + '#asthl-chat-btn,#asthl-flash,#asthl-chat-close{display:none !important;}'
      + '#asthl-chat-root{pointer-events:auto;}';
    document.head.appendChild(fpStyle);
    openChat();
  } else {
    setTimeout(showFlash, FLASH_DELAY);
  }
})();
